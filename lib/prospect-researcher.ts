import { Agent, run, webSearchTool, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';

// Disable tracing — it tries to hit api.openai.com directly, which fails with a custom base URL
setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

export interface ProspectResearchResult {
  summary: string; // markdown
  current_company_confirmed: boolean;
  seniority_level: string;
  department_tag: string;
  value_tier_suggestion: string;
  key_signals: string[];
}

/**
 * Research a single prospect using web search.
 * Used for on-demand enrichment from the research API route.
 */
export async function researchProspect(
  prospectName: string,
  companyName: string,
  domain: string | null,
  industry: string,
  model?: string
): Promise<ProspectResearchResult> {
  const agentModel = model || 'gpt-5.2';

  const agent = new Agent({
    model: agentModel,
    name: 'Prospect Researcher',
    instructions: `You are an expert SDR researcher. Your job is to research individual prospects to build a profile for sales outreach. You work for Auth0 in the ANZ market. Focus on finding:
- Their current role and responsibilities
- Their LinkedIn profile and professional background
- Conference talks, blog posts, or public statements
- Whether they are still at the company
- Their seniority and decision-making authority
- Signals that indicate they might be relevant for CIAM/identity discussions

Be factual and cite sources. If information is unavailable, say so clearly.`,
    tools: [webSearchTool()],
  });

  const companyIdentifier = domain ? `${companyName} (${domain})` : companyName;

  // Query 1: Professional background
  const backgroundPrompt = `Search for "${prospectName}" at ${companyIdentifier}. Find their current role, LinkedIn profile, and professional background. What is their title and department?`;
  const backgroundResult = await run(agent, backgroundPrompt);

  // Query 2: Public activity and signals
  const signalsPrompt = `Search for "${prospectName}" ${companyName} in the context of technology, security, identity management, or ${industry}. Look for conference talks, blog posts, interviews, or any public statements about authentication, identity, or security.`;
  const signalsResult = await run(agent, signalsPrompt);

  // Query 3: Synthesize into structured result
  const synthesisPrompt = `Based on the research about "${prospectName}" at ${companyIdentifier} (industry: ${industry}):

Background findings:
${backgroundResult.finalOutput || 'No information found'}

Activity/signals findings:
${signalsResult.finalOutput || 'No information found'}

Synthesize this into a JSON response with these fields:
{
  "summary": "A markdown-formatted summary (2-3 paragraphs) of this person's background, current role, and relevance to Auth0 CIAM sales",
  "current_company_confirmed": true/false,
  "seniority_level": "c_suite|vp|director|manager|individual_contributor|unknown",
  "department_tag": "Engineering|Security|IT|Product|Operations|Sales|Marketing|Finance|HR|Legal|Executive|Other",
  "value_tier_suggestion": "HVT|MVT|LVT|no_longer_with_company|recently_changed_roles|gatekeeper|technical_evaluator",
  "key_signals": ["signal1", "signal2", ...]
}

Respond with JSON only.`;

  const synthesisResult = await run(agent, synthesisPrompt);

  try {
    const parsed = JSON.parse(synthesisResult.finalOutput || '{}') as ProspectResearchResult;

    // Validate/default fields
    if (!parsed.summary) parsed.summary = `Research on ${prospectName} at ${companyName} returned limited results.`;
    if (typeof parsed.current_company_confirmed !== 'boolean') parsed.current_company_confirmed = true;
    if (!parsed.seniority_level) parsed.seniority_level = 'unknown';
    if (!parsed.department_tag) parsed.department_tag = 'Other';
    if (!parsed.value_tier_suggestion) parsed.value_tier_suggestion = 'MVT';
    if (!Array.isArray(parsed.key_signals)) parsed.key_signals = [];

    return parsed;
  } catch {
    // If JSON parsing fails, build a best-effort result from the raw output
    return {
      summary: synthesisResult.finalOutput || `Research on ${prospectName} at ${companyName} returned limited results.`,
      current_company_confirmed: true,
      seniority_level: 'unknown',
      department_tag: 'Other',
      value_tier_suggestion: 'MVT',
      key_signals: [],
    };
  }
}
