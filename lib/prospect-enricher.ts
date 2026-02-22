import { Prospect } from './db';
import { researchProspect } from './prospect-researcher';

/**
 * Model mapping per value tier.
 * HVT gets the most capable model, LVT gets the cheapest.
 */
const TIER_MODEL_MAP: Record<string, string> = {
  enrich_hvt: 'gpt-5.2',
  enrich_mvt: 'gpt-5.2',
  enrich_lvt: 'gpt-5-nano',
};

/**
 * Enrich a single prospect with AI research using a tier-appropriate model.
 * Calls researchProspect with the model determined by the job subtype.
 */
export async function enrichProspect(
  prospect: Prospect & {
    company_name: string;
    domain: string;
    account_industry: string;
  },
  jobSubtype: string
): Promise<{
  ai_summary: string;
  seniority_level: string;
  department_tag: string;
  value_tier_suggestion: string;
  key_signals: string[];
}> {
  const model = TIER_MODEL_MAP[jobSubtype] || 'gpt-5.2';

  const result = await researchProspect(
    `${prospect.first_name} ${prospect.last_name}`,
    prospect.company_name,
    prospect.domain,
    prospect.account_industry,
    model
  );

  return {
    ai_summary: result.summary,
    seniority_level: result.seniority_level,
    department_tag: result.department_tag,
    value_tier_suggestion: result.value_tier_suggestion,
    key_signals: result.key_signals,
  };
}
