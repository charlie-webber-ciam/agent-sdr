import {
  getCategorizationJob,
  getAccountsForCategorization,
  updateCategorizationJobStatus,
  updateCategorizationJobProgress,
  updateAccountMetadata,
} from './db';
import { analyzeAccountData } from './categorizer';
import { logWorkerError, parseFilters, sleep } from './worker-error-utils';

// Global processing state to prevent concurrent processing
const activeJobs = new Set<number>();

/**
 * Check if a categorization job currently has an active processing loop in this server process.
 * Used to detect orphaned jobs after server restarts.
 */
export function isCategorizationJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

export async function processCategorizationJob(jobId: number): Promise<void> {
  // Check if job is already being processed
  if (activeJobs.has(jobId)) {
    console.log(`Categorization job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getCategorizationJob(jobId);
    if (!job) {
      throw new Error(`Categorization job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      console.log(`Categorization job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    console.log(`Starting categorization for job ${jobId}: ${job.name}`);
    updateCategorizationJobStatus(jobId, 'processing');

    // Parse filters
    const filters = parseFilters(job.filters, `Categorization job ${jobId} filters`) as Parameters<
      typeof getAccountsForCategorization
    >[0];

    // Get accounts to categorize
    const accounts = getAccountsForCategorization(filters);

    if (accounts.length === 0) {
      console.log(`No accounts found for categorization job ${jobId}`);
      updateCategorizationJobStatus(jobId, 'completed');
      return;
    }

    console.log(`Processing ${accounts.length} accounts for job ${jobId}`);

    let processedCount = 0;
    let failedCount = 0;
    let wasCancelled = false;

    for (const account of accounts) {
      const currentJob = getCategorizationJob(jobId);
      if (currentJob?.status === 'failed') {
        console.log(`Categorization job ${jobId} was cancelled`);
        wasCancelled = true;
        break;
      }

      console.log(`Categorizing account ${account.id}: ${account.company_name}`);

      // Update job to show current account
      updateCategorizationJobStatus(jobId, 'processing', account.id);

      try {
        // Perform AI categorization
        const suggestions = await analyzeAccountData(account);

        // Store both the suggestions and apply the categorization
        updateAccountMetadata(account.id, {
          tier: suggestions.tier,
          estimated_annual_revenue: suggestions.estimatedAnnualRevenue,
          estimated_user_volume: suggestions.estimatedUserVolume,
          use_cases: JSON.stringify(suggestions.useCases),
          auth0_skus: JSON.stringify(suggestions.auth0Skus),
          priority_score: suggestions.priorityScore,
          ai_suggestions: JSON.stringify(suggestions),
          last_edited_at: new Date().toISOString(),
        });

        processedCount++;
        console.log(`✓ Categorized ${account.company_name} as Tier ${suggestions.tier} (Priority: ${suggestions.priorityScore})`);

        // Update job progress
        updateCategorizationJobProgress(jobId, processedCount, failedCount);

        // Add a small delay between accounts to avoid rate limiting
        await sleep(500);

      } catch (error) {
        logWorkerError(`Failed to categorize ${account.company_name}`, error);
        failedCount++;

        // Update job progress
        updateCategorizationJobProgress(jobId, processedCount, failedCount);

        // Continue to next account even if this one failed
      }
    }

    if (wasCancelled) {
      console.log(`Categorization job ${jobId} cancelled. Processed: ${processedCount}, Failed: ${failedCount}`);
      return;
    }

    // Mark job as completed
    updateCategorizationJobStatus(jobId, 'completed');
    console.log(`Categorization job ${jobId} completed. Processed: ${processedCount}, Failed: ${failedCount}`);

  } catch (error) {
    logWorkerError(`Categorization job ${jobId} failed`, error);
    updateCategorizationJobStatus(jobId, 'failed');
  } finally {
    activeJobs.delete(jobId);
  }
}
