import {
  getCategorizationJob,
  getAccountsForActivitySummarization,
  updateCategorizationJobStatus,
  updateCategorizationJobProgress,
} from './db';
import { summarizeAccountActivities } from './activity-summarizer-agent';
import { logWorkerError, parseFilters, sleep } from './worker-error-utils';

// Global processing state to prevent concurrent processing
const activeJobs = new Set<number>();

/**
 * Check if an activity summarization job currently has an active processing loop.
 * Used to detect orphaned jobs after server restarts.
 */
export function isActivitySummarizationJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

export async function processActivitySummarizationJob(jobId: number): Promise<void> {
  if (activeJobs.has(jobId)) {
    console.log(`Activity summarization job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getCategorizationJob(jobId);
    if (!job) {
      throw new Error(`Activity summarization job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      console.log(`Activity summarization job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    console.log(`Starting activity summarization for job ${jobId}: ${job.name}`);
    updateCategorizationJobStatus(jobId, 'processing');

    // Parse filters
    const filters = parseFilters(job.filters, `Activity summarization job ${jobId} filters`);
    const unsummarizedOnly =
      typeof filters.unsummarizedOnly === 'boolean' ? filters.unsummarizedOnly : true;
    const limit = typeof filters.limit === 'number' ? filters.limit : undefined;

    // Get accounts to summarize
    const accounts = getAccountsForActivitySummarization({
      unsummarizedOnly,
      limit,
    });

    if (accounts.length === 0) {
      console.log(`No accounts found for activity summarization job ${jobId}`);
      updateCategorizationJobStatus(jobId, 'completed');
      return;
    }

    console.log(`Processing ${accounts.length} accounts for activity summarization job ${jobId}`);

    let processedCount = 0;
    let failedCount = 0;
    let wasCancelled = false;

    for (const account of accounts) {
      const currentJob = getCategorizationJob(jobId);
      if (currentJob?.status === 'failed') {
        console.log(`Activity summarization job ${jobId} was cancelled`);
        wasCancelled = true;
        break;
      }

      console.log(`Summarizing activities for account ${account.id}: ${account.company_name}`);

      // Update job to show current account
      updateCategorizationJobStatus(jobId, 'processing', account.id);

      try {
        await summarizeAccountActivities(account.id);

        processedCount++;
        console.log(`✓ Summarized activities for ${account.company_name}`);

        // Update job progress
        updateCategorizationJobProgress(jobId, processedCount, failedCount);

        // Add a small delay between accounts to avoid rate limiting
        await sleep(500);

      } catch (error) {
        logWorkerError(`Failed to summarize activities for ${account.company_name}`, error);
        failedCount++;

        // Update job progress
        updateCategorizationJobProgress(jobId, processedCount, failedCount);

        // Continue to next account even if this one failed
      }
    }

    if (wasCancelled) {
      console.log(`Activity summarization job ${jobId} cancelled. Processed: ${processedCount}, Failed: ${failedCount}`);
      return;
    }

    // Mark job as completed
    updateCategorizationJobStatus(jobId, 'completed');
    console.log(`Activity summarization job ${jobId} completed. Processed: ${processedCount}, Failed: ${failedCount}`);

  } catch (error) {
    logWorkerError(`Activity summarization job ${jobId} failed`, error);
    updateCategorizationJobStatus(jobId, 'failed');
  } finally {
    activeJobs.delete(jobId);
  }
}
