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

/**
 * Find or correct the domain for an account via a single web search.
 * Skips accounts that already have a valid-looking domain.
 */
export async function findDomain(account: Account): Promise<EnrichmentResult> {
  const domain = account.domain as string | null;

  // Skip if domain already looks valid (not missing/placeholder)
  if (domain && !domain.startsWith('placeholder-') && domain.includes('.')) {
    return { success: true, updates: {}, notes: 'Domain already present' };
  }

  const agent = new Agent({
    model: 'gpt-5-mini',
    name: 'Domain Finder',
    instructions: `You are a domain finder specialist. Your job is to find the official website domain for a company.

Perform ONE quick web search to find the official domain.

**Response Format (JSON only):**
{
  "domain": "company.com" or null if not found,
  "confidence": "high|medium|low",
  "notes": "Brief finding (1 sentence max)"
}

**Rules:**
- Domain should be just the domain (e.g., "stripe.com" not "https://stripe.com" or "www.stripe.com")
- If company is known but no website found, return null
- Confidence: high = confident match, medium = partial match, low = unsure`,
    tools: [webSearchTool()],
  });

  try {
    const prompt = `Find the official website domain for:
Company Name: ${account.company_name}
${account.industry ? `Industry: ${account.industry}` : ''}

Search the web and return the domain in JSON format.`;

    const result = await run(agent, prompt);

    let parsed: { domain: string | null; confidence: string; notes: string } = {
      domain: null,
      confidence: 'low',
      notes: 'Failed to parse response',
    };

    try {
      const jsonMatch = result.finalOutput?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error(`Failed to parse domain JSON for ${account.company_name}`);
    }

    if (!parsed.domain) {
      return {
        success: false,
        updates: {},
        notes: parsed.notes || 'No domain found',
        error: 'No domain found via web search',
      };
    }

    // Clean domain
    const cleanedDomain = parsed.domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .split('/')[0]
      .toLowerCase();

    return {
      success: true,
      updates: { domain: cleanedDomain },
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
