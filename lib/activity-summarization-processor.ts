import {
  getCategorizationJob,
  getAccountsForActivitySummarization,
  updateCategorizationJobStatus,
  updateCategorizationJobProgress,
  getAccount,
} from './db';
import { summarizeAccountActivities } from './activity-summarizer-agent';

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
    const filters = job.filters ? JSON.parse(job.filters) : {};

    // Get accounts to summarize
    const accounts = getAccountsForActivitySummarization({
      unsummarizedOnly: filters.unsummarizedOnly ?? true,
      limit: filters.limit,
    });

    if (accounts.length === 0) {
      console.log(`No accounts found for activity summarization job ${jobId}`);
      updateCategorizationJobStatus(jobId, 'completed');
      return;
    }

    console.log(`Processing ${accounts.length} accounts for activity summarization job ${jobId}`);

    let processedCount = 0;
    let failedCount = 0;

    for (const account of accounts) {
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
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Failed to summarize activities for ${account.company_name}:`, error);
        failedCount++;

        // Update job progress
        updateCategorizationJobProgress(jobId, processedCount, failedCount);

        // Continue to next account even if this one failed
      }
    }

    // Mark job as completed
    updateCategorizationJobStatus(jobId, 'completed');
    console.log(`Activity summarization job ${jobId} completed. Processed: ${processedCount}, Failed: ${failedCount}`);

  } catch (error) {
    console.error(`Activity summarization job ${jobId} failed:`, error);
    updateCategorizationJobStatus(jobId, 'failed');
  } finally {
    activeJobs.delete(jobId);
  }
}
