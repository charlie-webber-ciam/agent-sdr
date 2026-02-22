import { Prospect } from './db';
import OpenAI from 'openai';

const openai = new OpenAI();

/**
 * Classify a single prospect using AI to determine value tier, seniority,
 * department, and relevant tags.
 */
export async function classifyProspect(
  prospect: Prospect & {
    company_name: string;
    domain: string;
    account_tier: string | null;
    account_industry: string;
  }
): Promise<{
  value_tier: string;
  seniority_level: string;
  department_tag: string;
  prospect_tags: string[];
}> {
  const prompt = `Classify this B2B prospect for an Auth0/Okta CIAM sales team.

Prospect:
- Name: ${prospect.first_name} ${prospect.last_name}
- Title: ${prospect.title || 'Unknown'}
- Company: ${prospect.company_name} (${prospect.account_industry})
- Account Tier: ${prospect.account_tier || 'Unknown'}
- Department: ${prospect.department || 'Unknown'}
- Role Type: ${prospect.role_type || 'Unknown'}
- Email: ${prospect.email || 'Unknown'}
- Phone: ${prospect.phone || 'None'}
- Mobile: ${prospect.mobile || 'None'}
- LinkedIn: ${prospect.linkedin_url || 'None'}

Classify into:
1. value_tier: One of "HVT" (high-value target - C-suite/VP at large accounts, decision makers), "MVT" (mid-value - directors/managers, champions/influencers), "LVT" (low-value - individual contributors, end users, gatekeepers), "no_longer_with_company", "recently_changed_roles", "gatekeeper", "technical_evaluator"
2. seniority_level: One of "c_suite", "vp", "director", "manager", "individual_contributor", "unknown"
3. department_tag: Normalized department like "engineering", "security", "it", "product", "sales", "marketing", "executive", "operations", "finance", "hr", "legal", "other"
4. prospect_tags: Array of 2-5 relevant tags like "budget_authority", "technical_buyer", "identity_expertise", "security_focus", "cloud_migration", "compliance_driven"

Respond in JSON format only.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    return {
      value_tier: parsed.value_tier || 'MVT',
      seniority_level: parsed.seniority_level || 'unknown',
      department_tag: parsed.department_tag || 'other',
      prospect_tags: Array.isArray(parsed.prospect_tags) ? parsed.prospect_tags : [],
    };
  } catch {
    return {
      value_tier: 'MVT',
      seniority_level: 'unknown',
      department_tag: 'other',
      prospect_tags: [],
    };
  }
}
