import {
  getJob,
  getNextPendingAccount,
  updateAccountStatus,
  updateAccountResearch,
  updateJobStatus,
  updateJobProgress,
  updateAccountMetadata,
} from './db';
import { researchCompany } from './agent-researcher';
import { analyzeAccountData } from './categorizer';

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

        console.log(`Completed research for ${account.company_name}, starting categorization...`);

        // Perform AI categorization
        try {
          const updatedAccount = { ...account, ...research, research_status: 'completed' as const };
          const suggestions = await analyzeAccountData(updatedAccount);

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

          console.log(`Categorized ${account.company_name} as Tier ${suggestions.tier} (Priority: ${suggestions.priorityScore})`);
        } catch (categorizationError) {
          console.error(`Failed to categorize ${account.company_name}:`, categorizationError);
          // Continue even if categorization fails - the research is still valuable
        }

        // Mark account as completed
        updateAccountStatus(account.id, 'completed');
        processedCount++;

        console.log(`Completed processing for ${account.company_name}`);

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
