import {
  getJob,
  getNextPendingAccount,
  updateAccountStatus,
  updateAccountAuth0Research,
  updateAccountOktaResearch,
  updateJobStatus,
  updateJobProgress,
  updateAccountMetadata,
  updateOktaAccountMetadata,
  updateAccountResearchModel,
} from './db';
import { researchCompanyDual, ResearchMode } from './dual-researcher';
import { analyzeAccountData } from './categorizer';
import { analyzeOktaAccountData } from './okta-categorizer';
import { PROCESSING_CONFIG } from './config';
import { processJobParallel } from './parallel-processor';

// Global processing state to prevent concurrent processing
const activeJobs = new Set<number>();

/**
 * Check if a job currently has an active processing loop in this server process.
 * Used to detect orphaned jobs after server restarts.
 */
export function isJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

/**
 * Process a job - routes to parallel or sequential based on configuration
 */
export async function processJob(
  jobId: number,
  options?: {
    mode?: 'parallel' | 'sequential';
    concurrency?: number;
    researchType?: ResearchMode;
    model?: string;
  }
): Promise<void> {
  // Check if job is already being processed
  if (activeJobs.has(jobId)) {
    console.log(`Job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    // Determine processing mode
    const mode = options?.mode || (PROCESSING_CONFIG.enableParallel ? 'parallel' : 'sequential');
    const concurrency = options?.concurrency || PROCESSING_CONFIG.concurrency;
    const researchType = options?.researchType || 'both';
    const model = options?.model;

    if (mode === 'parallel') {
      console.log(`Using PARALLEL processing mode (concurrency: ${concurrency}, research: ${researchType})`);
      await processJobParallel(jobId, concurrency, researchType, model);
    } else {
      console.log(`Using SEQUENTIAL processing mode (research: ${researchType})`);
      await processJobSequential(jobId, researchType, model);
    }
  } finally {
    activeJobs.delete(jobId);
  }
}

/**
 * Process job sequentially (one account at a time)
 * This is the original processing logic, kept as fallback
 */
export async function processJobSequential(
  jobId: number,
  researchType: ResearchMode = 'both',
  model?: string
): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (job.status !== 'pending' && job.status !== 'processing') {
    console.log(`Job ${jobId} is not pending or processing (status: ${job.status})`);
    return;
  }

  console.log(`Starting sequential processing for job ${jobId}`);
  if (job.status === 'pending') {
    updateJobStatus(jobId, 'processing');
  }

  let processedCount = 0;
  let failedCount = 0;

  while (true) {
    // Check if job is paused
    const currentJob = getJob(jobId);
    if (currentJob?.paused === 1) {
      console.log(`Job ${jobId} is paused. Waiting...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Check every 3 seconds
      continue;
    }

    // Check if job was cancelled
    if (currentJob?.status === 'failed') {
      console.log(`Job ${jobId} was cancelled`);
      break;
    }

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
      // Perform dual research (Auth0 and/or Okta)
      const dualResearch = await researchCompanyDual(
        {
          company_name: account.company_name,
          domain: account.domain,
          industry: account.industry,
        },
        researchType,
        model
      );

      // Update Auth0 research if available
      if (dualResearch.auth0) {
        updateAccountAuth0Research(account.id, dualResearch.auth0);
        console.log(`✓ Auth0 research completed for ${account.company_name}`);
      }

      // Update Okta research if available
      if (dualResearch.okta) {
        updateAccountOktaResearch(account.id, dualResearch.okta);
        console.log(`✓ Okta research completed for ${account.company_name}`);
      }

      console.log(`Completed research for ${account.company_name}, starting categorization...`);

      // Perform Auth0 AI categorization
      if (dualResearch.auth0) {
        try {
          const updatedAccount = {
            ...account,
            ...dualResearch.auth0,
            research_status: 'completed' as const,
          };
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

          console.log(
            `✓ Auth0 categorization: ${account.company_name} → Tier ${suggestions.tier} (Priority: ${suggestions.priorityScore})`
          );
        } catch (categorizationError) {
          console.error(`Failed to categorize Auth0 for ${account.company_name}:`, categorizationError);
          // Continue even if categorization fails - the research is still valuable
        }
      }

      // Perform Okta AI categorization
      if (dualResearch.okta) {
        try {
          const updatedAccount = {
            ...account,
            okta_current_iam_solution: dualResearch.okta.current_iam_solution,
            okta_workforce_info: dualResearch.okta.workforce_info,
            okta_security_incidents: dualResearch.okta.security_incidents,
            okta_news_and_funding: dualResearch.okta.news_and_funding,
            okta_tech_transformation: dualResearch.okta.tech_transformation,
            okta_ecosystem: dualResearch.okta.okta_ecosystem,
            okta_research_summary: dualResearch.okta.research_summary,
            okta_opportunity_type: dualResearch.okta.opportunity_type,
            okta_priority_score: dualResearch.okta.priority_score,
          };
          const oktaSuggestions = await analyzeOktaAccountData(updatedAccount);

          // Store Okta categorization
          updateOktaAccountMetadata(account.id, {
            okta_tier: oktaSuggestions.tier,
            okta_estimated_annual_revenue: oktaSuggestions.estimatedAnnualRevenue,
            okta_estimated_user_volume: oktaSuggestions.estimatedEmployeeCount,
            okta_use_cases: JSON.stringify(oktaSuggestions.useCases),
            okta_skus: JSON.stringify(oktaSuggestions.oktaSkus),
            okta_ai_suggestions: JSON.stringify(oktaSuggestions),
            okta_last_edited_at: new Date().toISOString(),
          });

          console.log(
            `✓ Okta categorization: ${account.company_name} → Tier ${oktaSuggestions.tier} (Priority: ${oktaSuggestions.priorityScore})`
          );
        } catch (categorizationError) {
          console.error(`Failed to categorize Okta for ${account.company_name}:`, categorizationError);
          // Continue even if categorization fails - the research is still valuable
        }
      }

      // Mark account as completed
      updateAccountStatus(account.id, 'completed');

      // Record which model was used for research
      if (model) {
        updateAccountResearchModel(account.id, model);
      }

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
}
