/**
 * Enrichment Processor
 *
 * Generic parallel processor for enrichment agents.
 * Routes to the correct agent handler based on job type via the registry.
 * Processes accounts with p-limit concurrency control (default: 50).
 */

import pLimit from 'p-limit';
import {
  getEnrichmentJob,
  getAccountsForEnrichment,
  updateEnrichmentJobStatus,
  updateEnrichmentJobProgress,
  updateAccountFields,
} from './db';
import { getEnrichmentAgent } from './enrichment-agents/registry';
import { logWorkerError, parseFilters, sleep } from './worker-error-utils';

const ENRICHMENT_CONCURRENCY = 50;
const BATCH_DELAY_MS = 200;

// Global processing state to prevent concurrent processing
const activeJobs = new Map<number, number>();
const STALE_JOB_THRESHOLD_MS = 6 * 60 * 60 * 1000;

export function isEnrichmentJobActive(jobId: number): boolean {
  const startTime = activeJobs.get(jobId);
  if (startTime === undefined) return false;
  if (Date.now() - startTime > STALE_JOB_THRESHOLD_MS) {
    console.warn(`Clearing stale enrichment activeJobs entry for job ${jobId}`);
    activeJobs.delete(jobId);
    return false;
  }
  return true;
}

export async function processEnrichmentJob(jobId: number): Promise<void> {
  if (isEnrichmentJobActive(jobId)) {
    console.log(`Enrichment job ${jobId} is already being processed`);
    return;
  }

  activeJobs.set(jobId, Date.now());

  try {
    const job = getEnrichmentJob(jobId);
    if (!job) {
      throw new Error(`Enrichment job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      console.log(`Enrichment job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    const agentConfig = getEnrichmentAgent(job.type);
    if (!agentConfig) {
      throw new Error(`No enrichment agent registered for type: ${job.type}`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting ENRICHMENT: ${agentConfig.name} (Job ${jobId})`);
    console.log(`  Total accounts: ${job.total_accounts}`);
    console.log(`  Concurrency: ${ENRICHMENT_CONCURRENCY}`);
    console.log(`${'='.repeat(60)}\n`);

    updateEnrichmentJobStatus(jobId, 'processing');

    // Load all accounts for this job upfront (same pattern as categorization processor)
    const filters = parseFilters(job.filters, `Enrichment job ${jobId} filters`) as Record<string, any>;
    const accounts = getAccountsForEnrichment(filters);

    if (accounts.length === 0) {
      console.log(`No accounts found for enrichment job ${jobId}`);
      updateEnrichmentJobStatus(jobId, 'completed');
      return;
    }

    let processedCount = 0;
    let failedCount = 0;

    const limit = pLimit(ENRICHMENT_CONCURRENCY);

    // Process in chunks to allow cancellation checks between batches
    const chunkSize = ENRICHMENT_CONCURRENCY * 2;

    for (let i = 0; i < accounts.length; i += chunkSize) {
      // Check if job was cancelled
      const currentJob = getEnrichmentJob(jobId);
      if (currentJob?.status === 'failed') {
        console.log(`\nEnrichment job ${jobId} was cancelled`);
        return;
      }

      const chunk = accounts.slice(i, i + chunkSize);
      console.log(`\nProcessing batch ${Math.floor(i / chunkSize) + 1} (${chunk.length} accounts)...`);

      const promises = chunk.map((account) =>
        limit(async () => {
          try {
            updateEnrichmentJobStatus(jobId, 'processing', account.id);

            const result = await agentConfig.handler(account);

            if (result.success && Object.keys(result.updates).length > 0) {
              updateAccountFields(account.id, result.updates);
              processedCount++;
              console.log(`  [${account.company_name}] updated: ${Object.keys(result.updates).join(', ')}`);
            } else if (result.success) {
              processedCount++;
            } else {
              failedCount++;
              console.log(`  [${account.company_name}] failed: ${result.error || 'unknown'}`);
            }
          } catch (error) {
            failedCount++;
            logWorkerError(`[Enrichment] Failed: ${account.company_name}`, error);
          }
        })
      );

      await Promise.allSettled(promises);
      updateEnrichmentJobProgress(jobId, processedCount, failedCount);

      console.log(`  Progress: ${processedCount + failedCount}/${accounts.length} (${failedCount} failed)`);

      // Small delay between batches
      if (i + chunkSize < accounts.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    updateEnrichmentJobStatus(jobId, 'completed');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Enrichment job ${jobId} completed`);
    console.log(`  Processed: ${processedCount}`);
    console.log(`  Failed: ${failedCount}`);
    console.log(`  Success Rate: ${((processedCount / accounts.length) * 100).toFixed(1)}%`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    logWorkerError(`Enrichment job ${jobId} failed`, error);
    try {
      updateEnrichmentJobStatus(jobId, 'failed');
    } catch {
      // ignore
    }
  } finally {
    activeJobs.delete(jobId);
  }
}
