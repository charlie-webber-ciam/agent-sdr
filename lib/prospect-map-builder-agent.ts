import { Agent, run, webSearchTool, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

export interface MapBuilderResult {
  hierarchy: Array<{ prospectId: number; parentProspectId: number | null }>;
  newProspects: Array<{
    first_name: string;
    last_name: string;
    title: string;
    department: string;
    linkedin_url: string | null;
    role_type: string;
    seniority_level: string;
    relevance_reason: string;
    reportsToName: string | null;
  }>;
  search_notes: string;
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

export async function buildProspectMap(
  companyName: string,
  domain: string | null,
  industry: string,
  existingProspects: ExistingProspect[],
): Promise<MapBuilderResult> {
  const agentModel = 'claude-4-6-opus';
  const companyIdentifier = domain ? `${companyName} (${domain})` : companyName;

  const existingRoster = existingProspects.map(p =>
    `[ID:${p.id}] ${p.first_name} ${p.last_name} — ${p.title || 'No title'} | Dept: ${p.department || 'Unknown'} | Seniority: ${p.seniority_level || 'unknown'}`
  ).join('\n');

  // Agent without web search for analysis steps
  const analysisAgent = new Agent({
    model: agentModel,
    name: 'Prospect Map Builder (Analysis)',
    instructions: `You are an expert organizational analyst specializing in corporate reporting hierarchies, especially within technology, security, and identity teams. You help SDR teams understand org charts at target companies.`,
    tools: [],
  });

  // Agent with web search for discovery steps
  const searchAgent = new Agent({
    model: agentModel,
    name: 'Prospect Map Builder (Search)',
    instructions: `You are an expert SDR researcher specializing in finding key personnel at target companies. Your goal is to identify real people with their actual names, titles, and LinkedIn profiles. Focus on identity, security, authentication, and IT infrastructure roles.

CRITICAL RECENCY RULES:
- Only include people who CURRENTLY work at the target company as of 2024-2025.
- If a LinkedIn profile or article shows someone left the company, moved to a different company, or their tenure ended — EXCLUDE them.
- Look for present-tense indicators: "is the CTO at", "works at", current LinkedIn headline showing the company.
- EXCLUDE anyone whose profile says "Former", "Ex-", "Previously at", or shows a different current employer.
- When in doubt about whether someone still works there, EXCLUDE them. False positives (stale contacts) are worse than missing someone.

GEOGRAPHIC FOCUS:
- Only include prospects based in Australia or New Zealand (ANZ region).
- Look for location indicators: Sydney, Melbourne, Brisbane, Perth, Adelaide, Auckland, Wellington, etc.
- If a person is clearly based outside ANZ (e.g. San Francisco, London, Singapore), EXCLUDE them.
- When the company has global offices, focus specifically on ANZ-based staff.`,
    tools: [webSearchTool()],
  });

  // ── Step 1: Hierarchy Analysis ──
  const hierarchyPrompt = `Analyze the following prospect roster at ${companyIdentifier} (industry: ${industry}) and infer the most likely reporting hierarchy based on titles and seniority.

EXISTING PROSPECTS:
${existingRoster || '(none)'}

For each prospect, determine who they most likely report to among the other prospects. Use title/seniority logic:
- C-suite reports to no one (null parent)
- VPs report to relevant C-suite
- Directors report to relevant VP
- Managers report to relevant Director
- Individual contributors report to relevant Manager/Director

Return ONLY valid JSON:
{
  "hierarchy": [
    { "prospectId": 123, "parentProspectId": 456 },
    { "prospectId": 789, "parentProspectId": null }
  ],
  "reasoning": "Brief explanation of hierarchy decisions"
}

If no prospects exist or there's only one, return {"hierarchy": [], "reasoning": "..."}.`;

  const hierarchyResult = await run(analysisAgent, hierarchyPrompt);

  // ── Step 2: Gap Analysis ──
  const gapPrompt = `Given the existing prospect roster at ${companyIdentifier} (${industry}), identify missing key personas that an SDR targeting identity/security/authentication solutions should map.

EXISTING PROSPECTS:
${existingRoster || '(none)'}

Key personas for identity/auth/security sales typically include:
- CISO / VP Security
- CTO / VP Engineering
- Head of IAM / Identity
- IT Director / VP IT
- Security Architect
- Platform Engineering Lead
- Head of Compliance / GRC
- VP Product (if B2C/B2B identity relevant)

Which of these roles are MISSING from the current roster? Only list roles that are relevant given the company's industry (${industry}) and likely size.

Return ONLY valid JSON:
{
  "missingRoles": [
    { "title": "CISO", "department": "Security", "priority": "high", "reason": "No security leadership mapped" }
  ],
  "analysis": "Brief summary"
}`;

  const gapResult = await run(analysisAgent, gapPrompt);

  // ── Step 3: Targeted Search ──
  const targetedPrompt = `Based on this gap analysis for ${companyIdentifier}:

${gapResult.finalOutput || 'No gap analysis available'}

Search for specific people CURRENTLY filling these missing roles at ${companyIdentifier}. For each gap role, search LinkedIn and the web for real people at this company.

Search queries to try:
- "${companyName} CISO Australia site:linkedin.com"
- "${companyName} Head of Identity Australia New Zealand site:linkedin.com"
- "${companyName} VP Security Australia${domain ? ' ' + domain : ''}"
- "${companyName} IAM Director ANZ${domain ? ' ' + domain : ''}"

IMPORTANT: Only include people who CURRENTLY work at ${companyName} right now AND are based in Australia or New Zealand. Verify by checking:
- Their LinkedIn headline/current position shows ${companyName}
- Their location is in Australia or New Zealand
- Articles or pages from the last 12 months confirm they are there
- EXCLUDE anyone who has moved on, shows "Former" or "Ex-${companyName}", or whose LinkedIn shows a different current employer
- EXCLUDE anyone based outside Australia/New Zealand

For each person found, note their full name, exact current title, department, location, and LinkedIn URL if available.`;

  const targetedResult = await run(searchAgent, targetedPrompt);

  // ── Step 4: Discovery Search ──
  const discoveryPrompt = `Do a broader search for identity, authentication, and security-adjacent people CURRENTLY at ${companyIdentifier} (${industry}) who may not have obvious titles.

Search for:
- "${companyName} authentication engineer Australia site:linkedin.com"
- "${companyName} identity platform ANZ${domain ? ' ' + domain : ''}"
- "${companyName} security operations Australia${domain ? ' ' + domain : ''}"
- "${companyName} cloud infrastructure director Australia New Zealand${domain ? ' ' + domain : ''}"

Look for people in roles like: Security Operations, Cloud Infrastructure, DevSecOps, Platform Engineering, Developer Experience, IT Operations. These are people who influence identity/auth purchasing decisions even if they're not the primary buyer.

IMPORTANT: Only include people who CURRENTLY work at ${companyName} AND are based in Australia or New Zealand. EXCLUDE anyone who:
- Shows a different current employer on LinkedIn
- Is described as "Former" or "Ex-" employee
- Left the company more than 6 months ago
- You cannot verify is still there
- Is based outside Australia or New Zealand

For each person found, note their full name, exact current title, department, location, and LinkedIn URL.`;

  const discoveryResult = await run(searchAgent, discoveryPrompt);

  // ── Step 5: Synthesis ──
  const synthesisPrompt = `Synthesize all research into a structured prospect map for ${companyIdentifier}.

EXISTING PROSPECTS (already in the system — do NOT include these as new):
${existingRoster || '(none)'}

HIERARCHY ANALYSIS:
${hierarchyResult.finalOutput || 'No analysis'}

GAP ANALYSIS:
${gapResult.finalOutput || 'No analysis'}

TARGETED SEARCH RESULTS:
${targetedResult.finalOutput || 'No results'}

DISCOVERY SEARCH RESULTS:
${discoveryResult.finalOutput || 'No results'}

Produce a final JSON result that:
1. Defines hierarchy for EXISTING prospects (using their IDs) — who reports to whom
2. Lists NEW prospects found via search (not duplicating anyone already in the roster)
3. For each new prospect, indicates who they report to by full name (can be an existing or another new prospect)

DEDUPLICATION, RECENCY & GEOGRAPHIC RULES:
- If a search result matches an existing prospect by name, skip it
- If two search results match each other, keep only one
- ONLY include people you're confident CURRENTLY work at ${companyName} right now
- EXCLUDE anyone who has left, shows "Former"/"Ex-", or whose current employer is different
- ONLY include people based in Australia or New Zealand — exclude anyone in other regions
- When in doubt, leave them out — stale contacts are worse than a smaller list

Return ONLY valid JSON:
{
  "hierarchy": [
    { "prospectId": 123, "parentProspectId": 456 }
  ],
  "newProspects": [
    {
      "first_name": "Jane",
      "last_name": "Smith",
      "title": "Chief Information Security Officer",
      "department": "Security",
      "linkedin_url": "https://linkedin.com/in/janesmith",
      "role_type": "decision_maker",
      "seniority_level": "c_suite",
      "relevance_reason": "CISO — primary decision maker for identity/security solutions",
      "reportsToName": "John Doe"
    }
  ],
  "search_notes": "Summary of search quality and findings"
}

Valid role_type values: decision_maker, champion, influencer, end_user, unknown
Valid seniority_level values: c_suite, vp, director, manager, individual_contributor
Valid department values: Engineering, Security, IT, Product, Executive, Compliance, Other

If reportsToName is null, the person is treated as a top-level node.`;

  const synthesisResult = await run(analysisAgent, synthesisPrompt);

  try {
    let responseText = synthesisResult.finalOutput || '{}';
    console.log(`[MapBuilder] Raw synthesis output (first 500 chars): ${responseText.substring(0, 500)}`);
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in synthesis response');

    const parsed = JSON.parse(jsonMatch[0]) as MapBuilderResult;

    if (!Array.isArray(parsed.hierarchy)) parsed.hierarchy = [];
    if (!Array.isArray(parsed.newProspects)) parsed.newProspects = [];
    if (!parsed.search_notes) parsed.search_notes = 'Search completed';

    // Validate new prospects
    parsed.newProspects = parsed.newProspects.filter(p =>
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
      reportsToName: p.reportsToName || null,
    }));

    console.log(`[MapBuilder] Hierarchy updates: ${parsed.hierarchy.length}, New prospects: ${parsed.newProspects.length}`);
    return parsed;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[MapBuilder] Failed to parse synthesis: ${errMsg}`);
    console.error(`[MapBuilder] Raw output: ${(synthesisResult.finalOutput || '').substring(0, 500)}`);
    return {
      hierarchy: [],
      newProspects: [],
      search_notes: `Failed to parse synthesis results: ${errMsg}`,
    };
  }
}
