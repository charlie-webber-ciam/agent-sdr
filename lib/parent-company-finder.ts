import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export interface ParentCompanyInput {
  id: number;
  company_name: string;
  domain: string | null;
  industry: string;
}

export interface ParentCompanyResult {
  id: number;
  parent_company: string | null;
  parent_company_region: 'australia' | 'global' | null;
}

/**
 * Classify up to 25 accounts at once to detect parent/holding companies.
 * Uses GPT-5 nano for fast, cheap classification.
 */
export async function findParentCompanies(
  accounts: ParentCompanyInput[]
): Promise<ParentCompanyResult[]> {
  if (accounts.length === 0) return [];

  const accountList = accounts
    .map((a, i) => `${i + 1}. id=${a.id} | "${a.company_name}" | domain: ${a.domain || 'unknown'} | industry: ${a.industry}`)
    .join('\n');

  const prompt = `You are analysing a list of companies operating in Australia. For each company, determine:
1. Does this company have a parent or holding company (i.e. is it a subsidiary, division, or wholly-owned entity)?
2. If yes, is the parent company Australian (ASX-listed, ASIC-registered, headquartered in Australia) or global (headquartered in the US, UK, EU, Asia, or any non-Australian country)?

Rules:
- If the company IS the top-level entity (no parent), set parent_company to null and parent_company_region to null.
- If the company has an Australian parent, set parent_company_region to "australia".
- If the company has a non-Australian parent, set parent_company_region to "global".
- parent_company should be the name of the ultimate parent/holding company.
- Be conservative: only flag a parent company if you are reasonably confident. When unsure, return null.

Companies:
${accountList}

Respond with a JSON object containing a "results" array. Each entry must have: id (number), parent_company (string or null), parent_company_region ("australia" | "global" | null).`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    const results: ParentCompanyResult[] = [];

    if (Array.isArray(parsed.results)) {
      for (const item of parsed.results) {
        const account = accounts.find(a => a.id === item.id);
        if (!account) continue;

        const region = item.parent_company_region;
        const validRegion = region === 'australia' || region === 'global' ? region : null;

        results.push({
          id: item.id,
          parent_company: validRegion ? (item.parent_company || null) : null,
          parent_company_region: validRegion,
        });
      }
    }

    // Ensure all input accounts are represented in the output
    for (const account of accounts) {
      if (!results.find(r => r.id === account.id)) {
        results.push({
          id: account.id,
          parent_company: null,
          parent_company_region: null,
        });
      }
    }

    return results;
  } catch {
    // On parse failure, return null for all accounts
    return accounts.map(a => ({
      id: a.id,
      parent_company: null,
      parent_company_region: null,
    }));
  }
}
