import { Agent, run, webSearchTool, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

export interface MappedProspect {
  first_name: string;
  last_name: string;
  title: string;
  department: string;
  linkedin_url: string | null;
  role_type: 'decision_maker' | 'champion' | 'influencer' | 'end_user' | 'unknown';
  seniority_level: string;
  relevance_reason: string;
}

export interface ProspectMapResult {
  prospects: MappedProspect[];
  search_notes: string;
}

export async function mapAccountProspects(
  companyName: string,
  domain: string | null,
  industry: string,
  userContext: string | null,
  opportunityContext: string,
  researchSummary: string | null,
  model?: string
): Promise<ProspectMapResult> {
  const agentModel = model || 'gpt-5.2';
  const companyIdentifier = domain ? `${companyName} (${domain})` : companyName;

  const agent = new Agent({
    model: agentModel,
    name: 'Prospect Mapper',
    instructions: `You are an expert SDR researcher specializing in finding key personnel at target companies. Your goal is to identify real people with their actual names, titles, and LinkedIn profiles. Focus on finding decision-makers and influencers relevant to identity/security/authentication solutions.

Be precise with names - only include people you can confirm work at or recently worked at the target company. Include LinkedIn URLs when found.`,
    tools: [webSearchTool()],
  });

  // Query 1: Executive/C-Suite
  const execPrompt = `Search for executives at ${companyIdentifier} in ${industry}. Find their CEO, CTO, CISO, CPO, VP Engineering. Search: "${companyName} CEO CTO CISO CPO VP Engineering site:linkedin.com". For each person found, note their full name, exact title, and LinkedIn URL.`;
  const execResult = await run(agent, execPrompt);

  // Query 2: Engineering & Security
  const engPrompt = `Search for engineering and security leaders at ${companyIdentifier}. Search: "${companyName} Head of Engineering Director Security Identity Platform${domain ? ' ' + domain : ''}". Find people with titles like Head of Engineering, Director of Security, Principal Engineer, Security Architect. Note full names, titles, and LinkedIn URLs.`;
  const engResult = await run(agent, engPrompt);

  // Query 3: IT & Operations
  const itPrompt = `Search for IT and operations leaders at ${companyIdentifier}. Search: "${companyName} IT Director Head IT Infrastructure Cloud Operations${domain ? ' ' + domain : ''}". Find people responsible for IT infrastructure, cloud operations, and technology operations. Note full names, titles, and LinkedIn URLs.`;
  const itResult = await run(agent, itPrompt);

  // Query 4: Product
  const productPrompt = `Search for product leaders at ${companyIdentifier}. Search: "${companyName} VP Product Director Product Management${domain ? ' ' + domain : ''}". Find people in product leadership roles. Note full names, titles, and LinkedIn URLs.`;
  const productResult = await run(agent, productPrompt);

  // Synthesis step
  const userContextSection = userContext ? `\nUSER CONTEXT / SPECIAL INSTRUCTIONS:\n${userContext}\n` : '';
  const researchSection = researchSummary ? `\nACCOUNT RESEARCH SUMMARY:\n${researchSummary}\n` : '';
  const oppSection = opportunityContext ? `\n${opportunityContext}\n` : '';

  const synthesisPrompt = `You have research results from 4 searches about personnel at ${companyIdentifier} (industry: ${industry}).
${userContextSection}${researchSection}${oppSection}
SEARCH RESULTS:

=== Executive/C-Suite ===
${execResult.finalOutput || 'No results'}

=== Engineering & Security ===
${engResult.finalOutput || 'No results'}

=== IT & Operations ===
${itResult.finalOutput || 'No results'}

=== Product ===
${productResult.finalOutput || 'No results'}

Synthesize all findings into a deduplicated list of prospects. For each person:
1. Confirm they are a real person at this company (not a generic title)
2. Assign a department: Engineering | Security | IT | Product | Executive | Other
3. Assign a role_type: decision_maker | champion | influencer | end_user | unknown
4. Assign seniority_level: c_suite | vp | director | manager | individual_contributor
5. Write a 1-2 sentence relevance_reason explaining why they matter for identity/auth sales

Remove duplicates. Filter out low-confidence matches (people you aren't sure actually work there).

Return ONLY valid JSON:
{
  "prospects": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "title": "Chief Technology Officer",
      "department": "Executive",
      "linkedin_url": "https://linkedin.com/in/johndoe" or null,
      "role_type": "decision_maker",
      "seniority_level": "c_suite",
      "relevance_reason": "As CTO, directly oversees technology decisions including authentication infrastructure."
    }
  ],
  "search_notes": "Brief summary of search quality and any notable findings"
}`;

  const synthesisResult = await run(agent, synthesisPrompt);

  try {
    let responseText = synthesisResult.finalOutput || '{}';
    console.log(`[ProspectMapper] Raw synthesis output (first 500 chars): ${responseText.substring(0, 500)}`);
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in synthesis response');

    const parsed = JSON.parse(jsonMatch[0]) as ProspectMapResult;

    if (!Array.isArray(parsed.prospects)) parsed.prospects = [];
    if (!parsed.search_notes) parsed.search_notes = 'Search completed';

    const beforeFilter = parsed.prospects.length;
    // Validate each prospect has required fields
    parsed.prospects = parsed.prospects.filter(p =>
      p.first_name && p.last_name && p.title
    ).map(p => ({
      first_name: p.first_name,
      last_name: p.last_name,
      title: p.title,
      department: p.department || 'Other',
      linkedin_url: p.linkedin_url || null,
      role_type: p.role_type || 'unknown',
      seniority_level: p.seniority_level || 'unknown',
      relevance_reason: p.relevance_reason || '',
    }));
    console.log(`[ProspectMapper] Parsed ${beforeFilter} prospects, ${parsed.prospects.length} passed validation`);

    return parsed;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ProspectMapper] Failed to parse synthesis results: ${errMsg}`);
    console.error(`[ProspectMapper] Raw output: ${(synthesisResult.finalOutput || '').substring(0, 500)}`);
    return {
      prospects: [],
      search_notes: `Failed to parse synthesis results: ${errMsg}. Raw output: ${(synthesisResult.finalOutput || '').substring(0, 200)}`,
    };
  }
}
