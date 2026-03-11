import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export interface HqStateInput {
  id: number;
  company_name: string;
  domain: string | null;
  industry: string;
  research_summary: string | null;
}

export interface HqStateResult {
  id: number;
  hq_state: string | null;
}

const VALID_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT', 'NZ'];

/**
 * Assign HQ state/region to up to 50 accounts at once.
 * Uses GPT-5 nano for fast, cheap classification.
 */
export async function assignHqStates(
  accounts: HqStateInput[]
): Promise<HqStateResult[]> {
  if (accounts.length === 0) return [];

  const accountList = accounts
    .map((a, i) => {
      const summary = a.research_summary ? ` | summary: ${a.research_summary.slice(0, 200)}` : '';
      return `${i + 1}. id=${a.id} | "${a.company_name}" | domain: ${a.domain || 'unknown'} | industry: ${a.industry}${summary}`;
    })
    .join('\n');

  const prompt = `You are analysing a list of companies operating in Australia and New Zealand. For each company, determine which Australian state/territory or New Zealand their headquarters is located in.

Valid values: NSW, VIC, QLD, SA, WA, TAS, ACT, NT, NZ
Use null if you cannot determine the HQ location with reasonable confidence.

Use all available signals:
- Company name (e.g. "Sydney Water" → NSW, "Melbourne Airport" → VIC)
- Domain TLD (e.g. .nsw.gov.au → NSW, .vic.gov.au → VIC, .co.nz → NZ)
- Industry context (e.g. mining companies are often in WA or QLD)
- Research summary details (addresses, office locations mentioned)

Be conservative: only assign a state if you are reasonably confident. When unsure, return null.

Companies:
${accountList}

Respond with a JSON object containing a "results" array. Each entry must have: id (number), hq_state (string or null).`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const parsed = JSON.parse(content);
    const results: HqStateResult[] = [];

    if (Array.isArray(parsed.results)) {
      for (const item of parsed.results) {
        const account = accounts.find(a => a.id === item.id);
        if (!account) continue;

        const state = item.hq_state;
        const validState = VALID_STATES.includes(state) ? state : null;

        results.push({
          id: item.id,
          hq_state: validState,
        });
      }
    }

    // Ensure all input accounts are represented in the output
    for (const account of accounts) {
      if (!results.find(r => r.id === account.id)) {
        results.push({
          id: account.id,
          hq_state: null,
        });
      }
    }

    return results;
  } catch {
    // On parse failure, return null for all accounts
    return accounts.map(a => ({
      id: a.id,
      hq_state: null,
    }));
  }
}
