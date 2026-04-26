import { Agent, run, webSearchTool, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import type { Account } from '../db';
import type { EnrichmentResult } from './types';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});
setDefaultOpenAIClient(openai);

const CANONICAL_INDUSTRIES = [
  'Software & Technology',
  'Financial Services',
  'Healthcare & Life Sciences',
  'Retail & E-Commerce',
  'Manufacturing',
  'Telecommunications',
  'Energy & Utilities',
  'Transportation & Logistics',
  'Hospitality & Travel',
  'Education',
  'Media & Entertainment',
  'Real Estate',
  'Construction & Engineering',
  'Agriculture',
  'Professional Services',
  'Government & Public Sector',
  'Non-Profit',
  'Automotive',
  'Aerospace & Defense',
  'Consumer Goods',
  'Insurance',
  'Legal',
  'Pharmaceuticals',
  'Mining & Metals',
  'Other',
];

/**
 * Standardize the industry for an account to a canonical category via web search.
 */
export async function standardizeIndustry(account: Account): Promise<EnrichmentResult> {
  const agent = new Agent({
    model: 'gpt-5-mini',
    name: 'Industry Standardizer',
    instructions: `You are an industry classification specialist. Classify a company into one of these canonical industries:

${CANONICAL_INDUSTRIES.join('\n')}

Perform ONE quick web search if needed to verify the company's industry.

**Response Format (JSON only):**
{
  "industry": "One of the canonical industries listed above",
  "confidence": "high|medium|low",
  "notes": "Brief finding (1 sentence max)"
}

**Rules:**
- Always return EXACTLY one of the canonical industries listed above
- Use web search to verify if the current industry label is ambiguous or generic
- Confidence: high = very certain, medium = reasonable match, low = unclear`,
    tools: [webSearchTool()],
  });

  try {
    const prompt = `Classify the industry for:
Company Name: ${account.company_name}
${account.domain ? `Domain: ${account.domain}` : ''}
Current Industry: ${account.industry || 'Unknown'}

Return the standardized industry in JSON format.`;

    const result = await run(agent, prompt);

    let parsed: { industry: string; confidence: string; notes: string } = {
      industry: account.industry || 'Other',
      confidence: 'low',
      notes: 'Failed to parse response',
    };

    try {
      const jsonMatch = result.finalOutput?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error(`Failed to parse industry JSON for ${account.company_name}`);
    }

    // Validate industry is canonical
    if (!CANONICAL_INDUSTRIES.includes(parsed.industry)) {
      parsed.industry = 'Other';
      parsed.confidence = 'low';
    }

    return {
      success: true,
      updates: { industry: parsed.industry },
      confidence: parsed.confidence as 'high' | 'medium' | 'low',
      notes: parsed.notes,
    };
  } catch (error) {
    return {
      success: false,
      updates: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
