/**
 * Account Worker
 *
 * Handles processing of a single account:
 * 1. Research the company
 * 2. Categorize results
 * 3. Update database
 * 4. Handle errors with retry logic
 */

import {
  Account,
  updateAccountStatusSafe as updateAccountStatus,
  updateAccountAuth0ResearchSafe as updateAccountAuth0Research,
  updateAccountOktaResearchSafe as updateAccountOktaResearch,
  updateAccountMetadataSafe as updateAccountMetadata,
  updateOktaAccountMetadataSafe as updateOktaAccountMetadata,
  updateAccountResearchModel,
} from './db';
import { researchCompanyDual, ResearchMode } from './dual-researcher';
import { hasSubstantiveResearchData } from './agent-researcher';
import { hasSubstantiveOktaResearchData } from './okta-agent-researcher';
import { analyzeAccountData } from './categorizer';
import { analyzeOktaAccountData, OktaPatch } from './okta-categorizer';
import { PROCESSING_CONFIG } from './config';
import { buildOpportunityContext } from './opportunity-context';
import { logWorkerError, sleep } from './worker-error-utils';
import { indexAccountResearchVectorsBestEffort } from './account-vectors';
import { generateOverviewsBestEffort } from './generate-account-overviews';

export interface AccountProcessingResult {
  accountId: number;
  companyName: string;
  success: boolean;
  error?: string;
  retries?: number;
}

/**
 * Process a single account with retry logic
 */
export async function processAccountWithRetry(
  account: Account,
  jobId: number,
  researchType: ResearchMode = 'both',
  model?: string,
  oktaPatch?: OktaPatch
): Promise<AccountProcessingResult> {
  const { maxRetries, retryDelay } = PROCESSING_CONFIG;
  let lastError: Error | null = null;
  let retries = 0;

  // Mark account as processing
  updateAccountStatus(account.id, 'processing');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Research the company using dual-researcher
      console.log(
        `[Account ${account.id}] Researching (${researchType}): ${account.company_name} (attempt ${
          attempt + 1
        }/${maxRetries + 1})`
      );

      // Fetch opportunity context for this account
      const opportunityContext = buildOpportunityContext(account.id) || undefined;

      const dualResearch = await researchCompanyDual(
        {
          company_name: account.company_name,
          domain: account.domain,
          industry: account.industry,
        },
        researchType,
        model,
        opportunityContext,
        undefined, // onStep — not used in parallel worker
        oktaPatch,
        account.id
      );

      // Update Auth0 research if available
      if (dualResearch.auth0) {
        updateAccountAuth0Research(account.id, dualResearch.auth0);
        console.log(`[Account ${account.id}] ✓ Auth0 research completed`);
      }

      // Update Okta research if available
      if (dualResearch.okta) {
        updateAccountOktaResearch(account.id, dualResearch.okta);
        console.log(`[Account ${account.id}] ✓ Okta research completed`);
      }

      console.log(
        `[Account ${account.id}] Research completed for ${account.company_name}, starting categorization...`
      );

      // Perform Auth0 AI categorization
      if (dualResearch.auth0) {
        try {
          const updatedAccount = {
            ...account,
            ...dualResearch.auth0,
            research_status: 'completed' as const,
          };
          const suggestions = await analyzeAccountData(updatedAccount, opportunityContext);

          // Store categorization data
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
            `[Account ${account.id}] ✓ Auth0 categorization: Tier ${suggestions.tier} (Priority: ${suggestions.priorityScore})`
          );
        } catch (categorizationError) {
          logWorkerError(`[Account ${account.id}] Auth0 categorization failed for ${account.company_name}`, categorizationError);
          // Continue even if categorization fails - research is still valuable
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
          const oktaSuggestions = await analyzeOktaAccountData(updatedAccount, opportunityContext, oktaPatch);

          // Store Okta categorization data
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
            `[Account ${account.id}] ✓ Okta categorization: Tier ${oktaSuggestions.tier} (Priority: ${oktaSuggestions.priorityScore})`
          );
        } catch (categorizationError) {
          logWorkerError(`[Account ${account.id}] Okta categorization failed for ${account.company_name}`, categorizationError);
          // Continue even if categorization fails - research is still valuable
        }
      }

      // Validate research quality before marking completed
      const auth0HasData = dualResearch.auth0 ? hasSubstantiveResearchData(dualResearch.auth0) : false;
      const oktaHasData = dualResearch.okta ? hasSubstantiveOktaResearchData(dualResearch.okta) : false;

      if (auth0HasData || oktaHasData) {
        updateAccountStatus(account.id, 'completed');
      } else {
        console.warn(`[Account ${account.id}] Research for ${account.company_name} returned no substantive data — marking as failed`);
        updateAccountStatus(account.id, 'failed', 'Research returned no substantive data — possible token budget exhaustion. Re-process this account.');
      }

      // Record which model was used for research
      if (model) {
        updateAccountResearchModel(account.id, model);
      }

      await indexAccountResearchVectorsBestEffort(account.id);

      // Generate overview drafts for both Auth0 and Okta (best-effort, non-fatal)
      await generateOverviewsBestEffort(account.id);

      console.log(`[Account ${account.id}] ✓ Completed processing for ${account.company_name}`);

      return {
        accountId: account.id,
        companyName: account.company_name,
        success: true,
        retries: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retries = attempt;

      // Check if it's a rate limit error
      const isRateLimitError =
        lastError.message.includes('429') ||
        lastError.message.toLowerCase().includes('rate limit');

      if (isRateLimitError && attempt < maxRetries) {
        // Exponential backoff for rate limit errors
        const delay = retryDelay * Math.pow(2, attempt);
        console.warn(
          `[Account ${account.id}] Rate limit hit for ${account.company_name}. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
        );
        logWorkerError(`[Account ${account.id}] Rate limit error details for ${account.company_name} (attempt ${attempt + 1})`, error);
        await sleep(delay);
        continue;
      } else if (attempt < maxRetries) {
        // Regular retry with shorter delay
        console.warn(
          `[Account ${account.id}] Error processing ${account.company_name}. Retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`
        );
        logWorkerError(`[Account ${account.id}] Retry error details for ${account.company_name} (attempt ${attempt + 1})`, error);
        await sleep(retryDelay);
        continue;
      } else {
        // Max retries exceeded
        logWorkerError(
          `[Account ${account.id}] FINAL FAILURE for ${account.company_name} after ${maxRetries + 1} attempts (domain: ${account.domain || 'none'}, industry: ${account.industry})`,
          lastError
        );
        break;
      }
    }
  }

  // Mark account as failed
  const errorMessage = lastError?.message || 'Unknown error';
  updateAccountStatus(account.id, 'failed', errorMessage);

  return {
    accountId: account.id,
    companyName: account.company_name,
    success: false,
    error: errorMessage,
    retries,
  };
}
