import {
  researchCompany as researchAuth0,
  ResearchResult as Auth0ResearchResult,
  CompanyInfo,
} from './agent-researcher';
import {
  researchCompany as researchOkta,
  ResearchResult as OktaResearchResult,
} from './okta-agent-researcher';

export interface DualResearchResult {
  auth0?: Auth0ResearchResult;
  okta?: OktaResearchResult;
}

export type ResearchMode = 'both' | 'auth0' | 'okta';

/**
 * Research a company using Auth0, Okta, or both agents
 * Runs agents in parallel when mode is 'both' for maximum efficiency
 * Handles individual agent failures gracefully
 */
export async function researchCompanyDual(
  company: CompanyInfo,
  mode: ResearchMode = 'both',
  model?: string
): Promise<DualResearchResult> {
  console.log(`[Dual Researcher] Starting ${mode} research for ${company.company_name}${model ? ` (model: ${model})` : ''}`);

  const result: DualResearchResult = {};

  try {
    if (mode === 'both') {
      // Run both agents in parallel
      const [auth0Result, oktaResult] = await Promise.allSettled([
        researchAuth0(company, model),
        researchOkta(company, model),
      ]);

      // Handle Auth0 result
      if (auth0Result.status === 'fulfilled') {
        result.auth0 = auth0Result.value;
        console.log(`[Dual Researcher] ✓ Auth0 research completed for ${company.company_name}`);
      } else {
        console.error(`[Dual Researcher] ✗ Auth0 research failed for ${company.company_name}:`, auth0Result.reason);
      }

      // Handle Okta result
      if (oktaResult.status === 'fulfilled') {
        result.okta = oktaResult.value;
        console.log(`[Dual Researcher] ✓ Okta research completed for ${company.company_name}`);
      } else {
        console.error(`[Dual Researcher] ✗ Okta research failed for ${company.company_name}:`, oktaResult.reason);
      }

      // If both failed, throw an error
      if (!result.auth0 && !result.okta) {
        throw new Error('Both Auth0 and Okta research agents failed');
      }
    } else if (mode === 'auth0') {
      // Run Auth0 agent only
      result.auth0 = await researchAuth0(company, model);
      console.log(`[Dual Researcher] ✓ Auth0 research completed for ${company.company_name}`);
    } else if (mode === 'okta') {
      // Run Okta agent only
      result.okta = await researchOkta(company, model);
      console.log(`[Dual Researcher] ✓ Okta research completed for ${company.company_name}`);
    }

    return result;
  } catch (error) {
    console.error(`[Dual Researcher] Research error for ${company.company_name}:`, error);
    throw error;
  }
}
