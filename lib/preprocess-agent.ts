/**
 * Preprocessing Agent
 *
 * Quick validation agent for bulk account cleaning before full research.
 * Validates company names, domains, and business status.
 */

import { Agent, run, webSearchTool, setDefaultOpenAIClient } from '@openai/agents';
import OpenAI from 'openai';

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
}

export interface ValidationResult {
  validated_company_name: string | null;
  validated_domain: string | null;
  is_active: boolean; // Still in business
  validation_notes: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Quick validation search for a company
 * Much faster than full research - only does one search query
 */
export async function validateCompany(company: CompanyInput): Promise<ValidationResult> {
  const agent = new Agent({
    model: 'gpt-5.2',
    name: 'Company Validator',
    instructions: `You are a company validation specialist. Your job is to quickly verify if a company exists, find its correct domain, and check if it's still in business.

**Your Task:**
For each company, perform ONE quick web search to:
1. Verify the company exists
2. Find the official domain/website
3. Check if still operating (look for "ceased operations", "acquired", "defunct", "out of business")
4. Confirm correct company name spelling

**Be concise and fast** - this is preprocessing, not deep research.

**Response Format (JSON only):**
{
  "validated_company_name": "Official Company Name" or null if not found,
  "validated_domain": "company.com" (domain only, no https://) or null,
  "is_active": true/false (false if defunct, acquired and ceased operations, or out of business),
  "validation_notes": "Brief note about findings (1-2 sentences max)",
  "confidence": "high|medium|low"
}

**Important:**
- If company is acquired but STILL OPERATES under new owner, mark as active=true
- If company ceased operations or website is gone, mark as active=false
- Domain should be just the domain (e.g., "stripe.com" not "https://stripe.com")
- Keep validation_notes VERY brief`,
    tools: [webSearchTool()],
  });

  try {
    const searchQuery = company.domain
      ? `${company.company_name} ${company.domain} official website`
      : `${company.company_name} ${company.industry} official website`;

    const prompt = `Validate this company:

Company Name: ${company.company_name}
${company.domain ? `Provided Domain: ${company.domain}` : 'No domain provided'}
Industry: ${company.industry}

Search the web and return validation results in JSON format. Be QUICK - only one search needed.`;

    const result = await run(agent, prompt);

    // Parse JSON response
    let validation: ValidationResult;
    try {
      const jsonMatch = result.finalOutput?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse validation JSON:', parseError);
      // Return default if parsing fails
      validation = {
        validated_company_name: company.company_name,
        validated_domain: company.domain || null,
        is_active: true,
        validation_notes: 'Validation failed - keeping original data',
        confidence: 'low',
      };
    }

    // Clean domain (remove protocol if present)
    if (validation.validated_domain) {
      validation.validated_domain = validation.validated_domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .split('/')[0]; // Take only domain part
    }

    return validation;
  } catch (error) {
    console.error(`Validation error for ${company.company_name}:`, error);
    // Return default on error
    return {
      validated_company_name: company.company_name,
      validated_domain: company.domain || null,
      is_active: true,
      validation_notes: `Error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      confidence: 'low',
    };
  }
}

/**
 * Detect if a company is a duplicate based on domain
 */
export function isDuplicateDomain(
  domain: string | null,
  seenDomains: Set<string>,
  existingDomains: string[]
): boolean {
  if (!domain) return false;

  const normalizedDomain = domain.toLowerCase().trim();

  // Check against seen domains in current batch
  if (seenDomains.has(normalizedDomain)) {
    return true;
  }

  // Check against existing domains in database
  if (existingDomains.includes(normalizedDomain)) {
    return true;
  }

  return false;
}
