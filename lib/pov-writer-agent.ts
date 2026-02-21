import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { Account } from './db';
import { buildOpportunityContext } from './opportunity-context';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

export interface PovRequest {
  recipientName?: string;
  recipientTitle: string;
  outputType: 'email' | 'document';
  researchContext?: 'auth0' | 'okta';
  customInstructions?: string;
  accountData: Account;
}

export interface PovSection {
  heading: string;
  content: string;
}

export interface PovResult {
  outputType: 'email' | 'document';
  // Email fields
  subject?: string;
  body?: string;
  // Document fields
  title?: string;
  sections?: PovSection[];
  // Shared
  reasoning: string;
  keyInsights: string[];
}

const SYSTEM_INSTRUCTIONS = `You are Charlie Webber, a senior SDR at Auth0 (an Okta company). Your job is to write executive-level Point of View (POV) content — either a concise strategic email or a structured POV document — for a specific company.

## What a POV is
A POV is NOT a sales pitch. It is a thoughtful, specific perspective that demonstrates you understand:
1. **Their vision and strategic direction** — where they are trying to go as a business
2. **The challenges standing in their way** — concrete obstacles they face, especially around identity, authentication, security, or scale
3. **How Auth0 fits into that vision** — not as a product sale, but as a genuine enabler of their goals
4. **A partnership approach** — what working together actually looks like in practice

## Tone and style
- Executive-level: clear, precise, no filler words
- Specific: reference actual facts from the research (funding rounds, tech stack, growth metrics, recent news)
- Advisor voice, not salesperson voice: "We see three challenges here..." not "Auth0 can help you..."
- Direct: no hedging, no buzzwords (no "synergy", "holistic", "best-in-class", "cutting-edge")
- Confident but not arrogant

## EMAIL format rules
- Subject: concise, specific to their situation (e.g. "your identity strategy as you scale past 10M users")
- Opening: "Hey [Name]" or "Hi [Name]" — never "Dear"
- Length: 200–300 words. Strategic but not long.
- Structure: vision observation → key challenge → how Auth0 fits → one clear ask
- Sign off: "Cheers," or "Best," followed by "Charlie"

## DOCUMENT format rules
Produce a structured POV with these exact five sections:
1. **Your Vision** — 2–3 sentences on what they're building/trying to achieve (specific, not generic)
2. **Key Challenges We See** — 3–4 bullet points of concrete obstacles. Reference their actual situation.
3. **How Auth0 Fits** — 3–4 bullet points showing how Auth0 addresses each challenge directly
4. **Our Partnership Approach** — 2–3 sentences on what collaboration looks like in practice
5. **Recommended Next Steps** — 2–3 numbered action items that are specific and actionable

Total length: 500–700 words. Every sentence should be specific to this company, not generic.

## Critical rules
- Never make up facts. Only use information provided in the account data.
- If you don't have data for something, write around it naturally — don't hallucinate.
- The document must read as if written by someone who has spent time understanding this company.
- Use the executive's title to calibrate the angle (a CTO cares about tech debt and scale; a CISO cares about compliance and breach risk; a CEO cares about growth velocity and competitive moats).

## Output format
Return ONLY valid JSON. No markdown fences, no pre-text.

For EMAIL:
{
  "outputType": "email",
  "subject": "...",
  "body": "full email body...",
  "reasoning": "brief explanation of the angle chosen and why",
  "keyInsights": ["specific fact used 1", "specific fact used 2"]
}

For DOCUMENT:
{
  "outputType": "document",
  "title": "Point of View: [Company Name] + Auth0",
  "sections": [
    { "heading": "Your Vision", "content": "..." },
    { "heading": "Key Challenges We See", "content": "..." },
    { "heading": "How Auth0 Fits", "content": "..." },
    { "heading": "Our Partnership Approach", "content": "..." },
    { "heading": "Recommended Next Steps", "content": "..." }
  ],
  "reasoning": "brief explanation of the overall narrative chosen",
  "keyInsights": ["specific fact used 1", "specific fact used 2"]
}`;

export async function generatePov(request: PovRequest): Promise<PovResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const accountContext = prepareAccountContext(request.accountData, request.researchContext || 'auth0');
  const prompt = buildPrompt(request, accountContext);

  const agent = new Agent({
    name: 'Auth0 POV Writer',
    model: 'claude-4-6-opus',
    instructions: SYSTEM_INSTRUCTIONS,
    tools: [],
  });

  try {
    const response = await run(agent, prompt);
    return parseAgentResponse(response.finalOutput || '', request.outputType);
  } catch (error) {
    console.error('POV generation error:', error);
    throw new Error(`Failed to generate POV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function prepareAccountContext(account: Account, researchContext: 'auth0' | 'okta'): string {
  const parts: string[] = [];

  parts.push(`COMPANY: ${account.company_name}`);
  parts.push(`INDUSTRY: ${account.industry || 'Unknown'}`);
  if (account.domain) parts.push(`DOMAIN: ${account.domain}`);
  parts.push(`\nRESEARCH PERSPECTIVE: ${researchContext === 'auth0' ? 'Auth0 CIAM' : 'Okta Workforce Identity'}`);

  if (account.tier) parts.push(`\nTIER: ${account.tier}`);
  if (account.estimated_annual_revenue) parts.push(`ESTIMATED ARR: ${account.estimated_annual_revenue}`);
  if (account.estimated_user_volume) parts.push(`USER VOLUME: ${account.estimated_user_volume}`);

  if (researchContext === 'auth0') {
    if (account.use_cases) parts.push(`\nUSE CASES: ${account.use_cases}`);
    if (account.auth0_skus) parts.push(`\nRELEVANT SKUs: ${account.auth0_skus}`);
    if (account.ai_suggestions) {
      try {
        const suggestions = JSON.parse(account.ai_suggestions);
        if (suggestions.priority_reasoning) {
          parts.push(`\nPRIORITY REASONING: ${suggestions.priority_reasoning}`);
        }
      } catch { /* ignore */ }
    }
    if (account.current_auth_solution) parts.push(`\nCURRENT AUTH SOLUTION:\n${account.current_auth_solution}`);
    if (account.customer_base_info) parts.push(`\nCUSTOMER BASE & GROWTH:\n${account.customer_base_info}`);
    if (account.security_incidents) parts.push(`\nSECURITY & COMPLIANCE:\n${account.security_incidents}`);
    if (account.news_and_funding) parts.push(`\nRECENT NEWS & FUNDING:\n${account.news_and_funding}`);
    if (account.tech_transformation) parts.push(`\nTECH TRANSFORMATION:\n${account.tech_transformation}`);
    if (account.research_summary) parts.push(`\nEXECUTIVE SUMMARY:\n${account.research_summary}`);
    if (account.prospects) {
      try {
        const prospects = JSON.parse(account.prospects);
        if (Array.isArray(prospects) && prospects.length > 0) {
          parts.push(`\nKEY PROSPECTS:\n${prospects.map((p: any) => `- ${p.name} (${p.title})`).join('\n')}`);
        }
      } catch { /* ignore */ }
    }
  } else {
    if (account.okta_opportunity_type) parts.push(`\nOPPORTUNITY TYPE: ${account.okta_opportunity_type}`);
    if (account.okta_priority_score) parts.push(`OKTA PRIORITY SCORE: ${account.okta_priority_score}/10`);
    if (account.okta_current_iam_solution) parts.push(`\nCURRENT IAM SOLUTION:\n${account.okta_current_iam_solution}`);
    if (account.okta_workforce_info) parts.push(`\nWORKFORCE & IT COMPLEXITY:\n${account.okta_workforce_info}`);
    if (account.okta_security_incidents) parts.push(`\nSECURITY & COMPLIANCE:\n${account.okta_security_incidents}`);
    if (account.okta_news_and_funding) parts.push(`\nRECENT NEWS & FUNDING:\n${account.okta_news_and_funding}`);
    if (account.okta_tech_transformation) parts.push(`\nTECH TRANSFORMATION:\n${account.okta_tech_transformation}`);
    if (account.okta_ecosystem) parts.push(`\nECOSYSTEM:\n${account.okta_ecosystem}`);
    if (account.okta_research_summary) parts.push(`\nEXECUTIVE SUMMARY:\n${account.okta_research_summary}`);
    if (account.okta_prospects) {
      try {
        const prospects = JSON.parse(account.okta_prospects);
        if (Array.isArray(prospects) && prospects.length > 0) {
          parts.push(`\nKEY PROSPECTS:\n${prospects.map((p: any) => `- ${p.name} (${p.title})`).join('\n')}`);
        }
      } catch { /* ignore */ }
    }
  }

  if (account.id) {
    const oppContext = buildOpportunityContext(account.id);
    if (oppContext) parts.push(`\n${oppContext}`);
  }

  return parts.join('\n');
}

function buildPrompt(request: PovRequest, accountContext: string): string {
  const parts: string[] = [];

  parts.push(`Generate a ${request.outputType === 'email' ? 'POV email' : 'POV document'} with the following parameters:\n`);
  parts.push(`OUTPUT TYPE: ${request.outputType.toUpperCase()}`);
  if (request.recipientName) parts.push(`RECIPIENT NAME: ${request.recipientName}`);
  parts.push(`RECIPIENT TITLE: ${request.recipientTitle}`);

  if (request.customInstructions) {
    parts.push(`\nCUSTOM INSTRUCTIONS: ${request.customInstructions}`);
  }

  parts.push('\n--- ACCOUNT RESEARCH DATA ---\n');
  parts.push(accountContext);
  parts.push('\n--- END ACCOUNT DATA ---\n');
  parts.push('\nGenerate the POV now. Return valid JSON only.');

  return parts.join('\n');
}

function parseAgentResponse(response: string, expectedType: 'email' | 'document'): PovResult {
  let clean = response
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '');

  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No JSON found in agent response');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    throw new Error(`Failed to parse JSON from agent response: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed.outputType) parsed.outputType = expectedType;
  if (!parsed.reasoning) throw new Error('Missing required field: reasoning');

  if (parsed.outputType === 'email') {
    if (!parsed.subject || !parsed.body) {
      throw new Error('Email POV missing required fields: subject, body');
    }
    return {
      outputType: 'email',
      subject: parsed.subject,
      body: parsed.body,
      reasoning: parsed.reasoning,
      keyInsights: parsed.keyInsights || [],
    };
  } else {
    if (!parsed.title || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      throw new Error('Document POV missing required fields: title, sections');
    }
    return {
      outputType: 'document',
      title: parsed.title,
      sections: parsed.sections,
      reasoning: parsed.reasoning,
      keyInsights: parsed.keyInsights || [],
    };
  }
}
