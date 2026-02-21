import {
  researchCompany as researchAuth0,
  ResearchResult as Auth0ResearchResult,
  CompanyInfo,
} from './agent-researcher';
import {
  researchCompany as researchOkta,
  ResearchResult as OktaResearchResult,
} from './okta-agent-researcher';
import { logDetailedError } from './error-logger';

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
  model?: string,
  opportunityContext?: string,
  onStep?: (source: 'auth0' | 'okta', step: string, stepIndex: number, total: number) => void
): Promise<DualResearchResult> {
  console.log(`[Dual Researcher] Starting ${mode} research for ${company.company_name}${model ? ` (model: ${model})` : ''}${opportunityContext ? ' (with opportunity context)' : ''}`);

  const result: DualResearchResult = {};

  try {
    if (mode === 'both') {
      const auth0OnStep = onStep
        ? (step: string, i: number, total: number) => onStep('auth0', step, i, total)
        : undefined;
      const oktaOnStep = onStep
        ? (step: string, i: number, total: number) => onStep('okta', step, i, total)
        : undefined;

      // Run both agents in parallel
      const [auth0Result, oktaResult] = await Promise.allSettled([
        researchAuth0(company, model, opportunityContext, auth0OnStep),
        researchOkta(company, model, opportunityContext, oktaOnStep),
      ]);

      // Handle Auth0 result
      if (auth0Result.status === 'fulfilled') {
        result.auth0 = auth0Result.value;
        console.log(`[Dual Researcher] ✓ Auth0 research completed for ${company.company_name}`);
      } else {
        logDetailedError(`[Dual Researcher] Auth0 research failed for ${company.company_name} (domain: ${company.domain || 'none'}, industry: ${company.industry})`, auth0Result.reason);
      }

      // Handle Okta result
      if (oktaResult.status === 'fulfilled') {
        result.okta = oktaResult.value;
        console.log(`[Dual Researcher] ✓ Okta research completed for ${company.company_name}`);
      } else {
        logDetailedError(`[Dual Researcher] Okta research failed for ${company.company_name} (domain: ${company.domain || 'none'}, industry: ${company.industry})`, oktaResult.reason);
      }

      // If both failed, throw an error
      if (!result.auth0 && !result.okta) {
        throw new Error('Both Auth0 and Okta research agents failed');
      }
    } else if (mode === 'auth0') {
      const auth0OnStep = onStep
        ? (step: string, i: number, total: number) => onStep('auth0', step, i, total)
        : undefined;
      // Run Auth0 agent only
      result.auth0 = await researchAuth0(company, model, opportunityContext, auth0OnStep);
      console.log(`[Dual Researcher] ✓ Auth0 research completed for ${company.company_name}`);
    } else if (mode === 'okta') {
      const oktaOnStep = onStep
        ? (step: string, i: number, total: number) => onStep('okta', step, i, total)
        : undefined;
      // Run Okta agent only
      result.okta = await researchOkta(company, model, opportunityContext, oktaOnStep);
      console.log(`[Dual Researcher] ✓ Okta research completed for ${company.company_name}`);
    }

    return result;
  } catch (error) {
    logDetailedError(`[Dual Researcher] Research error for ${company.company_name} (domain: ${company.domain || 'none'}, industry: ${company.industry})`, error);
    throw error;
  }
}
