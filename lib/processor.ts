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
  updateAccountParentCompany,
  insertJobEvent,
  updateJobCurrentStep,
  resetStuckProcessingAccountsByJob,
} from './db';
import { findParentCompanies } from './parent-company-finder';
import { researchCompanyDual, ResearchMode } from './dual-researcher';
import { hasSubstantiveResearchData } from './agent-researcher';
import { hasSubstantiveOktaResearchData } from './okta-agent-researcher';
import { analyzeAccountData } from './categorizer';
import { analyzeOktaAccountData, OktaPatch } from './okta-categorizer';
import { PROCESSING_CONFIG } from './config';
import { processJobParallel } from './parallel-processor';
import { buildOpportunityContext } from './opportunity-context';
import { buildActivityContext } from './activity-context';
import { logWorkerError, sleep } from './worker-error-utils';
import { indexAccountResearchVectorsBestEffort } from './account-vectors';
import { generateOverviewsBestEffort } from './generate-account-overviews';

// Global processing state to prevent concurrent processing
// Stores jobId -> start timestamp so stale entries can be detected
const activeJobs = new Map<number, number>();

// Jobs running longer than 6 hours are considered stale (likely orphaned by HMR/crash)
const STALE_JOB_THRESHOLD_MS = 6 * 60 * 60 * 1000;

/**
 * Check if a job currently has an active processing loop in this server process.
 * Automatically cleans up stale entries from orphaned jobs.
 */
export function isJobActive(jobId: number): boolean {
  const startTime = activeJobs.get(jobId);
  if (startTime === undefined) return false;
  if (Date.now() - startTime > STALE_JOB_THRESHOLD_MS) {
    console.warn(`Clearing stale activeJobs entry for job ${jobId} (started ${new Date(startTime).toISOString()})`);
    activeJobs.delete(jobId);
    return false;
  }
  return true;
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
    oktaPatch?: OktaPatch;
  }
): Promise<void> {
  // Check if job is already being processed
  if (isJobActive(jobId)) {
    console.log(`Job ${jobId} is already being processed`);
    return;
  }

  activeJobs.set(jobId, Date.now());

  try {
    // Determine processing mode
    const mode = options?.mode || (PROCESSING_CONFIG.enableParallel ? 'parallel' : 'sequential');
    const concurrency = options?.concurrency || PROCESSING_CONFIG.concurrency;
    const researchType = options?.researchType || 'both';
    const model = options?.model;
    const oktaPatch = options?.oktaPatch;

    if (mode === 'parallel') {
      console.log(`Using PARALLEL processing mode (concurrency: ${concurrency}, research: ${researchType})`);
      await processJobParallel(jobId, concurrency, researchType, model, oktaPatch);
    } else {
      console.log(`Using SEQUENTIAL processing mode (research: ${researchType})`);
      await processJobSequential(jobId, researchType, model, oktaPatch);
    }
  } catch (error) {
    logWorkerError(`[Job ${jobId}] processJob failed`, error);
    throw error;
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
  model?: string,
  oktaPatch?: OktaPatch
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
  let wasCancelled = false;

  while (true) {
    // Check if job is paused
    const currentJob = getJob(jobId);
    if (currentJob?.paused === 1) {
      console.log(`Job ${jobId} is paused. Waiting...`);
      await sleep(3000); // Check every 3 seconds
      continue;
    }

    // Check if job was cancelled
    if (currentJob?.status === 'failed') {
      console.log(`Job ${jobId} was cancelled`);
      wasCancelled = true;
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

    // Emit account_start event
    insertJobEvent(jobId, 'processing', 'account_start', {
      accountId: account.id,
      companyName: account.company_name,
      message: `Starting: ${account.company_name}`,
    });
    updateJobCurrentStep(jobId, 'Researching...');

    try {
      // Fetch opportunity and activity context for this account
      const opportunityContext = buildOpportunityContext(account.id) || '';
      const activityContext = buildActivityContext(account.id) || '';

      // Combine opportunity + activity context into a single string for the researcher
      const combinedContext = [opportunityContext, activityContext].filter(Boolean).join('\n\n') || undefined;

      // Build onStep callback that writes events to DB
      const onStep = (source: 'auth0' | 'okta', step: string, i: number, total: number) => {
        const label = source === 'auth0' ? '[Auth0]' : '[Okta]';
        insertJobEvent(jobId, 'processing', 'research_step', {
          accountId: account.id,
          companyName: account.company_name,
          message: `${label} ${step}`,
          stepIndex: i,
          totalSteps: total,
        });
        updateJobCurrentStep(jobId, `${label} ${step} (${i}/${total})`);
      };

      // Perform dual research (Auth0 and/or Okta)
      const dualResearch = await researchCompanyDual(
        {
          company_name: account.company_name,
          domain: account.domain,
          industry: account.industry,
        },
        researchType,
        model,
        combinedContext,
        onStep,
        oktaPatch,
        account.id
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

      // Emit categorizing event
      insertJobEvent(jobId, 'processing', 'categorizing', {
        accountId: account.id,
        companyName: account.company_name,
        message: `Categorizing: ${account.company_name}`,
      });
      updateJobCurrentStep(jobId, 'Categorizing...');

      // Perform Auth0 AI categorization
      if (dualResearch.auth0) {
        try {
          const updatedAccount = {
            ...account,
            ...dualResearch.auth0,
            research_status: 'completed' as const,
          };
          const suggestions = await analyzeAccountData(updatedAccount, combinedContext);

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
          logWorkerError(`[Job ${jobId}] Auth0 categorization failed for account ${account.id} (${account.company_name})`, categorizationError);
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
          const oktaSuggestions = await analyzeOktaAccountData(updatedAccount, combinedContext, oktaPatch);

          // Store Okta categorization
          updateOktaAccountMetadata(account.id, {
            okta_tier: oktaSuggestions.tier,
            okta_estimated_annual_revenue: oktaSuggestions.estimatedAnnualRevenue,
            okta_estimated_user_volume: oktaSuggestions.estimatedEmployeeCount,
            okta_use_cases: JSON.stringify(oktaSuggestions.useCases),
            okta_skus: JSON.stringify(oktaSuggestions.oktaSkus),
            okta_ai_suggestions: JSON.stringify(oktaSuggestions),
            okta_last_edited_at: new Date().toISOString(),
            okta_patch: oktaPatch || null,
          });

          console.log(
            `✓ Okta categorization: ${account.company_name} → Tier ${oktaSuggestions.tier} (Priority: ${oktaSuggestions.priorityScore})`
          );
        } catch (categorizationError) {
          logWorkerError(`[Job ${jobId}] Okta categorization failed for account ${account.id} (${account.company_name})`, categorizationError);
          // Continue even if categorization fails - the research is still valuable
        }
      }

      // Detect parent company
      try {
        insertJobEvent(jobId, 'processing', 'research_step', {
          accountId: account.id,
          companyName: account.company_name,
          message: 'Detecting parent company...',
        });
        updateJobCurrentStep(jobId, 'Detecting parent company...');

        const parentResults = await findParentCompanies([{
          id: account.id,
          company_name: account.company_name,
          domain: account.domain,
          industry: account.industry,
        }]);

        if (parentResults.length > 0) {
          const result = parentResults[0];
          updateAccountParentCompany(account.id, {
            parent_company: result.parent_company,
            parent_company_region: result.parent_company_region,
          });
          if (result.parent_company) {
            console.log(`✓ Parent company: ${account.company_name} → ${result.parent_company} (${result.parent_company_region})`);
          }
        }
      } catch (parentError) {
        logWorkerError(`[Job ${jobId}] Parent company detection failed for account ${account.id} (${account.company_name})`, parentError);
        // Non-fatal: continue processing
      }

      // Validate research quality before marking completed
      const auth0HasData = dualResearch.auth0 ? hasSubstantiveResearchData(dualResearch.auth0) : false;
      const oktaHasData = dualResearch.okta ? hasSubstantiveOktaResearchData(dualResearch.okta) : false;

      if (auth0HasData || oktaHasData) {
        updateAccountStatus(account.id, 'completed');
      } else {
        console.warn(`[Job ${jobId}] Research for ${account.company_name} returned no substantive data — marking as failed`);
        updateAccountStatus(account.id, 'failed', 'Research returned no substantive data — possible token budget exhaustion. Re-process this account.');
      }

      // Record which model was used for research
      if (model) {
        updateAccountResearchModel(account.id, model);
      }

      await indexAccountResearchVectorsBestEffort(account.id);

      // Generate overview drafts for both Auth0 and Okta (best-effort, non-fatal)
      insertJobEvent(jobId, 'processing', 'research_step', {
        accountId: account.id,
        companyName: account.company_name,
        message: 'Generating account overview...',
      });
      updateJobCurrentStep(jobId, 'Generating overview...');
      await generateOverviewsBestEffort(account.id);

      // Emit account_complete event
      insertJobEvent(jobId, 'processing', 'account_complete', {
        accountId: account.id,
        companyName: account.company_name,
        message: `Done: ${account.company_name}`,
      });

      processedCount++;

      console.log(`Completed processing for ${account.company_name}`);

      // Update job progress
      updateJobProgress(jobId, processedCount, failedCount);

      // Add a small delay between accounts to avoid rate limiting
      await sleep(1000);

    } catch (error) {
      const errorMessage = logWorkerError(
        `[Job ${jobId}] Failed to process account ${account.id} (${account.company_name}, domain: ${account.domain || 'none'}, industry: ${account.industry})`,
        error
      );

      // Mark account as failed
      updateAccountStatus(account.id, 'failed', errorMessage);

      // Emit account_failed event
      insertJobEvent(jobId, 'processing', 'account_failed', {
        accountId: account.id,
        companyName: account.company_name,
        message: `Failed: ${account.company_name} — ${errorMessage}`,
      });

      failedCount++;

      // Update job progress
      updateJobProgress(jobId, processedCount, failedCount);

      // Continue to next account even if this one failed
    }
  }

  if (wasCancelled) {
    // Reset any accounts that were mid-processing back to pending
    const resetCount = resetStuckProcessingAccountsByJob(jobId);
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} stuck 'processing' account(s) for cancelled job ${jobId}`);
    }
    insertJobEvent(jobId, 'processing', 'job_cancelled', {
      message: `Job cancelled. Processed: ${processedCount}, Failed: ${failedCount}`,
    });
    return;
  }

  // Mark job as completed
  updateJobStatus(jobId, 'completed');
  insertJobEvent(jobId, 'processing', 'job_complete', {
    message: `Job completed. Processed: ${processedCount}, Failed: ${failedCount}`,
  });
  console.log(`Job ${jobId} completed. Processed: ${processedCount}, Failed: ${failedCount}`);
}
