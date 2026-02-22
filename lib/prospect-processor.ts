import pLimit from 'p-limit';
import {
  getProspectProcessingJob,
  getProspectsForProcessing,
  updateProspectProcessingJobStatus,
  updateProspectProcessingJobProgress,
  updateProspectAIData,
  appendProspectProcessingJobError,
} from './db';
import { classifyProspect } from './prospect-classifier';
import { enrichProspect } from './prospect-enricher';
import { assessContactReadiness } from './prospect-contact-readiness';

const CONCURRENCY = 10;

// Global processing state to prevent concurrent processing
const activeProspectJobs = new Set<number>();

/**
 * Check if a prospect processing job currently has an active processing loop.
 */
export function isProspectJobActive(jobId: number): boolean {
  return activeProspectJobs.has(jobId);
}

/**
 * Process a prospect job in the background with parallel execution.
 * Supports three modes via job_subtype:
 * - 'contact_readiness': runs assessContactReadiness on each, writes contact_readiness field
 * - 'classify': runs classifyProspect on each, writes value_tier/seniority/tags
 * - 'enrich_hvt'|'enrich_mvt'|'enrich_lvt': runs enrichProspect with tier-specific model
 */
export async function processProspectJob(jobId: number): Promise<void> {
  if (activeProspectJobs.has(jobId)) {
    console.log(`Prospect processing job ${jobId} is already being processed`);
    return;
  }

  activeProspectJobs.add(jobId);

  try {
    const job = getProspectProcessingJob(jobId);
    if (!job) throw new Error(`Prospect processing job ${jobId} not found`);

    if (job.status !== 'pending') {
      console.log(`Prospect processing job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    console.log(`Starting prospect processing job ${jobId}: ${job.name} (${job.job_subtype}), concurrency: ${CONCURRENCY}`);
    updateProspectProcessingJobStatus(jobId, 'processing');

    const filters = job.filters ? JSON.parse(job.filters) : {};
    const prospects = getProspectsForProcessing(filters);

    if (prospects.length === 0) {
      console.log(`No prospects found for job ${jobId}`);
      updateProspectProcessingJobStatus(jobId, 'completed');
      return;
    }

    console.log(`Processing ${prospects.length} prospects for job ${jobId}`);

    let processedCount = 0;
    let failedCount = 0;

    const limit = pLimit(CONCURRENCY);

    const promises = prospects.map((prospect) =>
      limit(async () => {
        const name = `${prospect.first_name} ${prospect.last_name}`;
        updateProspectProcessingJobStatus(jobId, 'processing', prospect.id);

        try {
          if (job.job_subtype === 'contact_readiness') {
            const readiness = assessContactReadiness(prospect);
            updateProspectAIData(prospect.id, {
              contact_readiness: readiness,
            });
            console.log(`✓ Assessed ${name} as ${readiness}`);
          } else if (job.job_subtype === 'classify') {
            const result = await classifyProspect(prospect);

            updateProspectAIData(prospect.id, {
              value_tier: result.value_tier,
              seniority_level: result.seniority_level,
              department_tag: result.department_tag,
              prospect_tags: JSON.stringify(result.prospect_tags),
              ai_processed_at: new Date().toISOString(),
            });

            console.log(`✓ Classified ${name} as ${result.value_tier} (${result.seniority_level})`);
          } else {
            const result = await enrichProspect(prospect, job.job_subtype);

            updateProspectAIData(prospect.id, {
              ai_summary: result.ai_summary,
              seniority_level: result.seniority_level,
              department_tag: result.department_tag,
              prospect_tags: JSON.stringify(result.key_signals),
              ai_processed_at: new Date().toISOString(),
            });

            console.log(`✓ Enriched ${name} with ${job.job_subtype} model`);
          }

          processedCount++;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`Failed to process prospect ${name}:`, errMsg);
          failedCount++;
          appendProspectProcessingJobError(jobId, `[${name}] ${errMsg}`);
        }

        updateProspectProcessingJobProgress(jobId, processedCount, failedCount);
      })
    );

    await Promise.all(promises);

    updateProspectProcessingJobStatus(jobId, 'completed');
    console.log(`Prospect processing job ${jobId} completed. Processed: ${processedCount}, Failed: ${failedCount}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Prospect processing job ${jobId} failed:`, errMsg);
    appendProspectProcessingJobError(jobId, `[JOB FATAL] ${errMsg}`);
    updateProspectProcessingJobStatus(jobId, 'failed');
  } finally {
    activeProspectJobs.delete(jobId);
  }
}
