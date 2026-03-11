import {
  getCategorizationJob,
  getAccountsForHqStateAssignment,
  updateCategorizationJobStatus,
  updateCategorizationJobProgress,
  updateAccountHqState,
} from './db';
import { assignHqStates } from './hq-state-agent';
import { logWorkerError, parseFilters, sleep } from './worker-error-utils';

// Global processing state to prevent concurrent processing
const activeJobs = new Set<number>();

/**
 * Check if an HQ state assignment job currently has an active processing loop.
 */
export function isHqStateJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

export async function processHqStateJob(jobId: number): Promise<void> {
  if (activeJobs.has(jobId)) {
    console.log(`HQ state job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getCategorizationJob(jobId);
    if (!job) {
      throw new Error(`HQ state job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      console.log(`HQ state job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    console.log(`Starting HQ state assignment for job ${jobId}: ${job.name}`);
    updateCategorizationJobStatus(jobId, 'processing');

    // Parse filters
    const filters = parseFilters(job.filters, `HQ state job ${jobId} filters`);
    const unassignedOnly =
      typeof filters.unassignedOnly === 'boolean' ? filters.unassignedOnly : true;
    const limit = typeof filters.limit === 'number' ? filters.limit : undefined;

    // Get accounts to process
    const accounts = getAccountsForHqStateAssignment({
      unassignedOnly,
      limit,
    });

    if (accounts.length === 0) {
      console.log(`No accounts found for HQ state job ${jobId}`);
      updateCategorizationJobStatus(jobId, 'completed');
      return;
    }

    console.log(`Processing ${accounts.length} accounts for HQ state job ${jobId}`);

    let processedCount = 0;
    let failedCount = 0;
    let wasCancelled = false;

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const currentJob = getCategorizationJob(jobId);
      if (currentJob?.status === 'failed') {
        console.log(`HQ state job ${jobId} was cancelled`);
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
          research_summary: a.research_summary,
        }));

        const results = await assignHqStates(inputs);

        // Save each result
        for (const result of results) {
          updateAccountHqState(result.id, result.hq_state);
        }

        processedCount += batch.length;
        console.log(`✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: processed ${batch.length} accounts`);
      } catch (error) {
        logWorkerError(`Batch failed for HQ state job ${jobId}`, error);
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
      console.log(`HQ state job ${jobId} cancelled. Processed: ${processedCount}, Failed: ${failedCount}`);
      return;
    }

    // Mark job as completed
    updateCategorizationJobStatus(jobId, 'completed');
    console.log(`HQ state job ${jobId} completed. Processed: ${processedCount}, Failed: ${failedCount}`);

  } catch (error) {
    logWorkerError(`HQ state job ${jobId} failed`, error);
    updateCategorizationJobStatus(jobId, 'failed');
  } finally {
    activeJobs.delete(jobId);
  }
}
