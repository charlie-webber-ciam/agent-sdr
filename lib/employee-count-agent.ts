/**
 * Employee Count Agent
 *
 * Specialized agent for enriching account lists with employee count data
 * from LinkedIn and Dun & Bradstreet. Uses gpt-5-nano for cost efficiency.
 */

import { Agent, run, webSearchTool, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';

// Disable tracing — it tries to hit api.openai.com directly, which fails with a custom base URL
setTracingDisabled(true);

// Configure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

export interface EmployeeCountInput {
  account_name: string;
}

export interface EmployeeCountResult {
  account_name: string;
  linkedin_employee_count: string | null;
  dnb_employee_count: string | null;
  error_message?: string;
}

/**
 * Fetch employee counts from LinkedIn and Dun & Bradstreet
 */
export async function getEmployeeCounts(account: EmployeeCountInput): Promise<EmployeeCountResult> {
  const agent = new Agent({
    model: 'gpt-5-nano',
    name: 'Employee Count Researcher',
    instructions: `You are an employee count research specialist. Your ONLY job is to find the current employee count for a company from two specific sources:

1. **LinkedIn** - Search for the company's LinkedIn page and find the employee count listed
2. **Dun & Bradstreet (D&B)** - Search for the company's D&B business profile and find the employee count

**Important Instructions:**
- Perform TWO separate searches: one for LinkedIn, one for D&B
- Extract ONLY the employee count numbers (e.g., "500", "1,000-5,000", "10K+")
- If a source shows a range, return the range (e.g., "1,000-5,000")
- If a source is not found or doesn't show employee count, return "Not found"
- Be precise and fast - this is high-volume enrichment

**Response Format (JSON only):**
{
  "account_name": "Company Name",
  "linkedin_employee_count": "1,234" or "Not found",
  "dnb_employee_count": "1,200" or "Not found"
}

**Do NOT:**
- Research anything else about the company
- Make estimates or guesses
- Include explanations or notes
- Search other sources besides LinkedIn and D&B`,
    tools: [webSearchTool()],
  });

  try {
    const prompt = `Find employee counts for this company:

Company Name: ${account.account_name}

Search LinkedIn and Dun & Bradstreet for employee counts. Return results in JSON format.`;

    const result = await run(agent, prompt);

    // Parse JSON response
    let employeeData: EmployeeCountResult;
    try {
      const jsonMatch = result.finalOutput?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        employeeData = {
          account_name: account.account_name,
          linkedin_employee_count: parsed.linkedin_employee_count || null,
          dnb_employee_count: parsed.dnb_employee_count || null,
        };
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse employee count JSON:', parseError);
      // Return default if parsing fails
      employeeData = {
        account_name: account.account_name,
        linkedin_employee_count: null,
        dnb_employee_count: null,
        error_message: 'Failed to parse agent response',
      };
    }

    return employeeData;
  } catch (error) {
    console.error(`Employee count error for ${account.account_name}:`, error);
    // Return error result
    return {
      account_name: account.account_name,
      linkedin_employee_count: null,
      dnb_employee_count: null,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
