import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

export interface HierarchyResult {
  hierarchy: Array<{ prospectId: number; parentProspectId: number | null }>;
  reasoning: string;
}

interface ExistingProspect {
  id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  department: string | null;
  seniority_level: string | null;
  role_type: string | null;
}

/**
 * Analyze existing prospects and infer reporting hierarchy.
 * No web search — purely analyzes titles/seniority to build org structure.
 */
export async function analyzeProspectHierarchy(
  companyName: string,
  industry: string,
  existingProspects: ExistingProspect[],
): Promise<HierarchyResult> {
  const agentModel = 'claude-4-6-opus';

  if (existingProspects.length <= 1) {
    return { hierarchy: [], reasoning: 'Not enough prospects to build hierarchy.' };
  }

  const existingRoster = existingProspects.map(p =>
    `[ID:${p.id}] ${p.first_name} ${p.last_name} — ${p.title || 'No title'} | Dept: ${p.department || 'Unknown'} | Seniority: ${p.seniority_level || 'unknown'}`
  ).join('\n');

  const agent = new Agent({
    model: agentModel,
    name: 'Prospect Hierarchy Analyzer',
    instructions: `You are an expert organizational analyst specializing in corporate reporting hierarchies. Given a list of people at a company with their titles, departments, and seniority levels, you infer who reports to whom to build an org chart.

Rules:
- C-suite (CEO, CTO, CFO, CISO, COO, CPO) report to no one (parentProspectId: null) or to the CEO
- "Chief" titles report to CEO or to no one
- "Head of X" / VP / SVP report to relevant C-suite
- Directors report to relevant VP/Head
- Managers report to relevant Director
- Individual contributors report to relevant Manager/Director
- When multiple people share the same level, use department alignment to determine hierarchy
- If you can't determine a clear reporting relationship, set parentProspectId to null (top-level)
- Every person must appear exactly once in the hierarchy array`,
    tools: [],
  });

  const prompt = `Analyze the following prospect roster at ${companyName} (industry: ${industry}) and infer the reporting hierarchy.

PROSPECTS:
${existingRoster}

For each prospect, determine who they most likely report to among the other prospects.

Return ONLY valid JSON:
{
  "hierarchy": [
    { "prospectId": 123, "parentProspectId": 456 },
    { "prospectId": 789, "parentProspectId": null }
  ],
  "reasoning": "Brief explanation of key hierarchy decisions"
}

Every prospect ID from the roster MUST appear exactly once in the hierarchy array.`;

  const result = await run(agent, prompt);

  try {
    let responseText = result.finalOutput || '{}';
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]) as HierarchyResult;
    if (!Array.isArray(parsed.hierarchy)) parsed.hierarchy = [];
    if (!parsed.reasoning) parsed.reasoning = 'Analysis completed';

    console.log(`[HierarchyAnalyzer] Inferred ${parsed.hierarchy.length} relationships`);
    return parsed;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[HierarchyAnalyzer] Failed to parse: ${errMsg}`);
    return { hierarchy: [], reasoning: `Parse error: ${errMsg}` };
  }
}
