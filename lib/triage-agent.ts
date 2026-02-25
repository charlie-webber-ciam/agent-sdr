/**
 * Triage Agent
 *
 * Lightweight triage agent for quick account categorization before full research.
 * Performs 2-3 web searches per company and returns Auth0 + Okta tier assignments.
 * Now patch-aware for Okta scoring.
 */

import { Agent, run, webSearchTool, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { OktaPatch, PATCH_CONFIGS } from './okta-categorizer';

// Disable tracing — it tries to hit api.openai.com directly, which fails with a custom base URL
setTracingDisabled(true);

// Configure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

export interface CompanyInput {
  company_name: string;
  domain?: string | null;
  industry: string;
  oktaPatch?: OktaPatch;
}

export interface TriageResult {
  auth0_tier: 'A' | 'B' | 'C';
  auth0_tier_reasoning: string;
  okta_tier: 'A' | 'B' | 'C' | 'DQ';
  okta_tier_reasoning: string;
  okta_score: number; // 0-100
  estimated_arr: string;
  estimated_employees: string;
  key_signals: string[];
  summary: string;
}

const DEFAULT_MODEL = 'gpt-5.2';

/**
 * Build patch-specific Okta triage criteria.
 * If a patch is provided, extract top 3 highest-weight dimensions and show tier thresholds.
 * Otherwise fall back to generic criteria.
 */
function buildOktaTriageCriteria(patch?: OktaPatch): string {
  if (!patch) {
    return `**Okta Workforce Identity Tier Criteria:**

- **Tier A** (Rare ~5-10%): $250K+ ARR potential. Must have at least 2 buying triggers:
  - 1000+ employees needing workforce identity management
  - Active digital transformation or cloud migration
  - Security incident or compliance requirement (SOX, HIPAA, etc.)
  - M&A activity requiring identity consolidation
  - Legacy IAM replacement initiative
  - Regulatory pressure for zero-trust architecture
  - Recent CISO/CTO hire driving security improvements

- **Tier B** (Default 60-70%): $50K-$250K ARR potential. Mid-size workforce, some identity needs but no urgent triggers.

- **Tier C** (20-30%): <$50K ARR potential. Small workforce, basic needs, limited budget.

**Scoring:** Provide an okta_score (0-100) where 75+ = Tier A, 50-74 = Tier B, 25-49 = Tier C.`;
  }

  const cfg = PATCH_CONFIGS[patch];

  // Sort dimensions by weight descending, take top 3
  const topDimensions = [...cfg.scoringDimensions]
    .sort((a, b) => b.maxPoints - a.maxPoints)
    .slice(0, 3);

  const dimText = topDimensions
    .map(d => `  - **${d.name}** (${d.maxPoints}pts): Top signals: ${d.topBandSignals.slice(0, 2).join('; ')}`)
    .join('\n');

  const thresholdText = Object.entries(cfg.tierThresholds)
    .map(([tier, { min, max }]) => `Tier ${tier}: ${min}-${max}`)
    .join(', ');

  return `**Okta Workforce Identity Tier Criteria (${cfg.label} — ${cfg.headcountRange}):**

Score accounts 0-100 across these key dimensions:
${dimText}

Tier thresholds: ${thresholdText}
Entry products: ${cfg.entryProducts.join(', ')}
ACV range: ${cfg.acvRange}
Key decision makers: ${cfg.decisionMakers.join(', ')}
Top competitors: ${cfg.topCompetitors.join(', ')}

${cfg.tierA.description}`;
}

/**
 * Quick triage for a company — 2-3 web searches, returns tier assignments
 */
export async function triageCompany(company: CompanyInput, model?: string): Promise<TriageResult> {
  const oktaCriteria = buildOktaTriageCriteria(company.oktaPatch);

  const agent = new Agent({
    model: model || DEFAULT_MODEL,
    name: 'Account Triage Agent',
    instructions: `You are a sales intelligence triage agent for Okta (Auth0 CIAM + Okta Workforce Identity). Your job is to quickly assess companies and assign preliminary tier classifications.

**Your Task:**
Perform 2-3 focused web searches to gather enough information to classify this company. Search for:
1. Company overview: size, revenue, employee count, industry position
2. Authentication/security/IAM posture: current solutions, recent security news, compliance needs

**Auth0 CIAM Tier Criteria:**

- **Tier A** (Rare ~5-10%): $250K+ ARR potential. Must have at least 2 buying triggers:
  - Recent significant funding ($20M+) or strong revenue growth
  - Active tech transformation/platform modernization
  - Security incident or compliance deadline
  - Current auth solution causing pain points
  - Rapidly scaling user base (500K+ users)
  - Public statements about security/identity priorities
  - Recent leadership changes (new CTO/CISO)
  - Migration from legacy systems
  Strong Auth0 fit: Enterprise scale, sophisticated CIAM needs

- **Tier B** (Default 60-70%): $50K-$250K ARR potential. Mid-market with moderate CIAM needs. Some growth indicators but no urgent buying triggers.

- **Tier C** (20-30%): <$50K ARR potential. Small companies, limited budget, basic auth needs.

${oktaCriteria}

**Response Format (JSON only):**
{
  "auth0_tier": "A|B|C",
  "auth0_tier_reasoning": "Brief explanation with specific evidence found",
  "okta_tier": "A|B|C|DQ",
  "okta_tier_reasoning": "Brief explanation with specific evidence found",
  "okta_score": 55,
  "estimated_arr": "Revenue range e.g. $50M-$100M or Unknown",
  "estimated_employees": "Employee count range e.g. 1000-5000 or Unknown",
  "key_signals": ["signal1", "signal2"],
  "summary": "1-2 sentence overview of the company and its identity/auth relevance"
}

**Important:**
- Be CONSERVATIVE with Tier A — most companies should be B
- Default to Tier B when evidence is limited
- Keep reasoning BRIEF (1-2 sentences max)
- key_signals should list specific buying triggers found (or empty array if none)
- okta_score must be 0-100; the tier is derived from score thresholds`,
    tools: [webSearchTool()],
  });

  try {
    const prompt = `Triage this company for Auth0 CIAM and Okta Workforce Identity sales potential:

Company Name: ${company.company_name}
${company.domain ? `Domain: ${company.domain}` : 'No domain provided'}
Industry: ${company.industry}

Perform 2-3 quick web searches and return your triage assessment in JSON format.`;

    const result = await run(agent, prompt);

    // Parse JSON response
    let triage: TriageResult;
    try {
      const jsonMatch = result.finalOutput?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        triage = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse triage JSON:', parseError);
      triage = {
        auth0_tier: 'B',
        auth0_tier_reasoning: 'Triage parsing failed — defaulted to Tier B',
        okta_tier: 'B',
        okta_tier_reasoning: 'Triage parsing failed — defaulted to Tier B',
        okta_score: 50,
        estimated_arr: 'Unknown',
        estimated_employees: 'Unknown',
        key_signals: [],
        summary: `Triage failed for ${company.company_name} — parsing error`,
      };
    }

    // Validate tier values
    if (!['A', 'B', 'C'].includes(triage.auth0_tier)) triage.auth0_tier = 'B';
    if (!['A', 'B', 'C', 'DQ'].includes(triage.okta_tier)) triage.okta_tier = 'B';
    if (!Array.isArray(triage.key_signals)) triage.key_signals = [];

    // Validate okta_score
    if (typeof triage.okta_score !== 'number' || triage.okta_score < 0 || triage.okta_score > 100) {
      triage.okta_score = 50;
    }
    triage.okta_score = Math.round(triage.okta_score);

    // Derive tier from score if patch thresholds available
    if (company.oktaPatch) {
      const thresholds = PATCH_CONFIGS[company.oktaPatch].tierThresholds;
      if (triage.okta_score >= thresholds.A.min) triage.okta_tier = 'A';
      else if (triage.okta_score >= thresholds.B.min) triage.okta_tier = 'B';
      else if (thresholds.DQ && triage.okta_score <= thresholds.DQ.max) triage.okta_tier = 'DQ';
      else triage.okta_tier = 'C';
    }

    return triage;
  } catch (error) {
    console.error(`Triage error for ${company.company_name}:`, error);
    return {
      auth0_tier: 'B',
      auth0_tier_reasoning: `Error during triage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      okta_tier: 'B',
      okta_tier_reasoning: `Error during triage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      okta_score: 50,
      estimated_arr: 'Unknown',
      estimated_employees: 'Unknown',
      key_signals: [],
      summary: `Triage failed for ${company.company_name}`,
    };
  }
}
