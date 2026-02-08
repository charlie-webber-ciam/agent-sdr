import {
  getJob,
  getNextPendingAccount,
  updateAccountStatus,
  updateAccountResearch,
  updateJobStatus,
  updateJobProgress,
} from './db';
import { researchCompany } from './agent-researcher';

// Global processing state to prevent concurrent processing
const activeJobs = new Set<number>();

export async function processJob(jobId: number): Promise<void> {
  // Check if job is already being processed
  if (activeJobs.has(jobId)) {
    console.log(`Job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      console.log(`Job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    console.log(`Starting processing for job ${jobId}`);
    updateJobStatus(jobId, 'processing');

    let processedCount = 0;
    let failedCount = 0;

    while (true) {
      // Get next pending account
      const account = getNextPendingAccount(jobId);

      if (!account) {
        // No more pending accounts
        console.log(`No more pending accounts for job ${jobId}`);
        break;
      }

      console.log(`Processing account ${account.id}: ${account.company_name}`);

      // Update job to show current account
      updateJobStatus(jobId, 'processing', account.id);

      // Mark account as processing
      updateAccountStatus(account.id, 'processing');

      try {
        // Perform research
        const research = await researchCompany({
          company_name: account.company_name,
          domain: account.domain,
          industry: account.industry,
        });

        // Update account with research results
        updateAccountResearch(account.id, research);

        // Mark account as completed
        updateAccountStatus(account.id, 'completed');
        processedCount++;

        console.log(`Completed research for ${account.company_name}`);

        // Update job progress
        updateJobProgress(jobId, processedCount, failedCount);

        // Add a small delay between accounts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Failed to research ${account.company_name}:`, error);

        // Mark account as failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        updateAccountStatus(account.id, 'failed', errorMessage);
        failedCount++;

        // Update job progress
        updateJobProgress(jobId, processedCount, failedCount);

        // Continue to next account even if this one failed
      }
    }

    // Mark job as completed
    updateJobStatus(jobId, 'completed');
    console.log(`Job ${jobId} completed. Processed: ${processedCount}, Failed: ${failedCount}`);

  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    updateJobStatus(jobId, 'failed');
  } finally {
    activeJobs.delete(jobId);
  }
}
