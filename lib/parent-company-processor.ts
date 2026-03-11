import {
  getCategorizationJob,
  getAccountsForParentCompanyFinder,
  updateCategorizationJobStatus,
  updateCategorizationJobProgress,
  updateAccountParentCompany,
} from './db';
import { findParentCompanies } from './parent-company-finder';
import { logWorkerError, parseFilters, sleep } from './worker-error-utils';

// Global processing state to prevent concurrent processing
const activeJobs = new Set<number>();

/**
 * Check if a parent company finder job currently has an active processing loop.
 */
export function isParentCompanyJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

export async function processParentCompanyJob(jobId: number): Promise<void> {
  if (activeJobs.has(jobId)) {
    console.log(`Parent company job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getCategorizationJob(jobId);
    if (!job) {
      throw new Error(`Parent company job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      console.log(`Parent company job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    console.log(`Starting parent company detection for job ${jobId}: ${job.name}`);
    updateCategorizationJobStatus(jobId, 'processing');

    // Parse filters
    const filters = parseFilters(job.filters, `Parent company job ${jobId} filters`);
    const unprocessedOnly =
      typeof filters.unprocessedOnly === 'boolean' ? filters.unprocessedOnly : true;
    const limit = typeof filters.limit === 'number' ? filters.limit : undefined;

    // Get accounts to process
    const accounts = getAccountsForParentCompanyFinder({
      unprocessedOnly,
      limit,
    });

    if (accounts.length === 0) {
      console.log(`No accounts found for parent company job ${jobId}`);
      updateCategorizationJobStatus(jobId, 'completed');
      return;
    }

    console.log(`Processing ${accounts.length} accounts for parent company job ${jobId}`);

    let processedCount = 0;
    let failedCount = 0;
    let wasCancelled = false;

    // Process in batches of 25
    const BATCH_SIZE = 25;
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const currentJob = getCategorizationJob(jobId);
      if (currentJob?.status === 'failed') {
        console.log(`Parent company job ${jobId} was cancelled`);
        wasCancelled = true;
        break;
      }

      const batch = accounts.slice(i, i + BATCH_SIZE);

      // Update job to show current account (first in batch)
      updateCategorizationJobStatus(jobId, 'processing', batch[0].id);

      try {
        const inputs = batch.map(a => ({
          id: a.id,
          company_name: a.company_name,
          domain: a.domain,
          industry: a.industry,
        }));

        const results = await findParentCompanies(inputs);

        // Save each result
        for (const result of results) {
          updateAccountParentCompany(result.id, {
            parent_company: result.parent_company,
            parent_company_region: result.parent_company_region,
          });
        }

        processedCount += batch.length;
        console.log(`✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: processed ${batch.length} accounts`);
      } catch (error) {
        logWorkerError(`Batch failed for parent company job ${jobId}`, error);
        failedCount += batch.length;
      }

      // Update job progress
      updateCategorizationJobProgress(jobId, processedCount, failedCount);

      // Small delay between batches
      if (i + BATCH_SIZE < accounts.length) {
        await sleep(200);
      }
    }

    if (wasCancelled) {
      console.log(`Parent company job ${jobId} cancelled. Processed: ${processedCount}, Failed: ${failedCount}`);
      return;
    }

    // Mark job as completed
    updateCategorizationJobStatus(jobId, 'completed');
    console.log(`Parent company job ${jobId} completed. Processed: ${processedCount}, Failed: ${failedCount}`);

  } catch (error) {
    logWorkerError(`Parent company job ${jobId} failed`, error);
    updateCategorizationJobStatus(jobId, 'failed');
  } finally {
    activeJobs.delete(jobId);
  }
}
