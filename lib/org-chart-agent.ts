import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import type { OrgChartPersonInput } from './org-chart-db';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});
setDefaultOpenAIClient(openai);

const ORG_CHART_MODEL = process.env.ORG_CHART_MODEL || 'gpt-5.2';

export interface OrgChartAgentResult {
  chartName: string;
  people: OrgChartPersonInput[];
  warnings: string[];
}

const SYSTEM_INSTRUCTIONS = `You are an organizational chart data analyst. Your job is to take raw CSV data containing people/employee information and produce a clean, validated organizational hierarchy.

## Your Tasks

1. **Parse the CSV** - Identify columns by their content, not just headers. Common aliases:
   - Name: "name", "full_name", "employee_name", "person", "employee", "first_name + last_name"
   - Title: "title", "job_title", "role", "position", "designation"
   - Department: "department", "dept", "team", "division", "group", "org"
   - Reports To: "reports_to", "manager", "supervisor", "reporting_to", "manager_name", "reports to"
   - Email: "email", "email_address", "work_email"
   - LinkedIn: "linkedin", "linkedin_url", "linkedin_profile"

2. **Resolve the hierarchy** - Match each person's "reports_to" value to another person's name. Use fuzzy matching if needed (e.g., "John" matching "John Smith"). People with no reports_to or who report to someone not in the list are root nodes (level 0).

3. **Assign levels** - Starting from root nodes (level 0), assign incrementing levels down the tree.

4. **Validate and warn** about:
   - People whose manager couldn't be resolved (they become root nodes)
   - Multiple root nodes (may be valid for multi-division charts)
   - Circular reporting relationships (break the cycle, warn about it)
   - Missing critical data (no name)
   - Duplicate names that make hierarchy ambiguous

5. **Infer a chart name** from the data (e.g., company name if apparent, or "Org Chart - [date]")

## Output Format

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "chartName": "string",
  "people": [
    {
      "name": "string",
      "title": "string or null",
      "department": "string or null",
      "email": "string or null",
      "linkedin_url": "string or null",
      "level": 0,
      "original_reports_to": "raw CSV value or null",
      "_manager_index": null or index_in_this_array
    }
  ],
  "warnings": ["string"]
}

The _manager_index is the 0-based index of the person's manager in the people array, or null for root nodes.

IMPORTANT: Return ONLY the JSON object. No prose before or after.`;

export async function validateAndBuildOrgChart(csvText: string): Promise<OrgChartAgentResult> {
  const agent = new Agent({
    model: ORG_CHART_MODEL,
    name: 'Org Chart Validator',
    instructions: SYSTEM_INSTRUCTIONS,
  });

  const prompt = `Parse and validate this CSV data into an organizational hierarchy:\n\n${csvText}`;
  const result = await run(agent, prompt);

  const output = result.finalOutput ?? '';

  // Extract JSON from the response (handle possible markdown wrapping)
  let jsonStr: string = output;
  const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr) as OrgChartAgentResult;

  // Validate the structure
  if (!parsed.people || !Array.isArray(parsed.people)) {
    throw new Error('Agent returned invalid structure: missing people array');
  }

  if (!parsed.chartName) {
    parsed.chartName = `Org Chart - ${new Date().toISOString().split('T')[0]}`;
  }

  if (!parsed.warnings) {
    parsed.warnings = [];
  }

  return parsed;
}
