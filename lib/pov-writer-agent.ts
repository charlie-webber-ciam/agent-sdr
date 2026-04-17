import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE } from './auth0-value-framework';
import { buildAttachedAccountDocumentContext } from './account-documents';
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

const SYSTEM_INSTRUCTIONS = `You are Charlie Webber, a senior SDR at Auth0 (an Okta company). Your job is to write executive-level Point of View (POV) content - either a concise strategic email or a structured POV document - for a specific company.

## THE #1 RULE: LEAD WITH THE COMPANY'S BIGGEST BUSINESS PRIORITY

Every POV must open with and anchor to the company's single biggest priority as a business. This is where the biggest budget, executive attention, and urgency sit. Not an auth problem. Not an identity problem. The BUSINESS problem.

Identify the priority from: news/funding, tech transformation, growth data, executive summary, M&A activity, market expansion, product launches, regulatory pressure.

The entire POV flows from this priority. Identity and auth challenges are framed as friction that threatens or slows this priority. Auth0 is positioned as the enabler of this priority, not as a standalone solution.

## What a POV is
A POV is NOT a sales pitch. It is a thoughtful, specific perspective that demonstrates you understand:
1. Their #1 business priority and why it matters now
2. The identity/auth friction that typically blocks companies pursuing this priority
3. How Auth0 removes that friction and accelerates the priority
4. A partnership approach anchored to their timeline and goals

## PERSONA CALIBRATION

The recipient's role determines the depth and framing of the POV:

**Developer / Engineer / Architect:**
- Lead with technical specifics of how the business priority creates identity challenges
- Detail specific technical friction: SDK complexity, migration paths, architecture constraints, API limitations
- Frame Auth0 capabilities in technical terms: specific features, integration patterns, developer experience
- Include concrete implementation considerations
- Tone: peer-to-peer technical, direct, no business abstractions

**Mid-Level Manager (Director, VP, Head of):**
- Lead with how the business priority impacts their team and delivery timelines
- Balance: 60% business impact on team velocity, 40% product-led evidence of how Auth0 accelerates delivery
- Reference resource allocation, project timelines, cross-team dependencies
- Frame Auth0 as a force multiplier for their team against the priority
- Tone: strategic but practical, show you understand their operational reality

**Executive (C-suite, SVP, GM):**
- Lead directly with the #1 business priority and the strategic risk if identity friction is not addressed
- Pure business language: revenue impact, competitive positioning, time-to-market, customer trust, market share
- Zero product specifics. Auth0 is implied through outcomes, never pitched through features
- Frame challenges as strategic gaps that threaten the priority's success
- Tone: advisor, boardroom-ready, commercially sharp

## Tone and style
- Executive-level: clear, precise, no filler words
- Specific: reference actual facts from the research (funding rounds, tech stack, growth metrics, recent news)
- Advisor voice, not salesperson voice: "We see three challenges here..." not "Auth0 can help you..."
- Direct: no hedging, no buzzwords (no "synergy", "holistic", "best-in-class", "cutting-edge")
- Confident but not arrogant

## CRITICAL FORMATTING RULES - these override everything else
- NEVER use em dashes (the -- or the long dash character). Use a comma, a full stop, or rewrite the sentence instead.
- NEVER use quotation marks of any kind (not "double", not 'single', not curly quotes).
- NEVER use markdown formatting in the content text: no bold (**text**), no italics (*text*), no headers (#), no bullet hyphens (-), no numbered lists in flowing prose. Write in clean plain prose or simple numbered lists using digits followed by a full stop (1. 2. 3.).
- For bullet-style lists, use a plain digit and full stop format: "1. item" not "- item" or "* item".

## EMAIL format rules
- Subject: concise, tied to their business priority (e.g. your expansion timeline, platform consolidation)
- Opening: "Hey [Name]" or "Hi [Name]" - never "Dear"
- Length: 200 to 300 words. Strategic but not long.
- Structure: business priority observation, identity friction that threatens it (calibrated to persona), how Auth0 enables the priority, one clear ask
- Sign off: "Cheers," or "Best," followed by "Charlie"

## DOCUMENT format rules
Produce a structured POV with these exact five sections:
1. Your Priority - 2 to 3 sentences on their #1 business priority and why it matters now (specific, not generic). This is about THEIR business goal, not about auth.
2. The Identity Friction - 3 to 4 numbered items listing the specific identity/auth challenges that typically block companies pursuing this priority. Reference their actual situation. Calibrate technical depth to persona.
3. How Auth0 Accelerates This Priority - 3 to 4 numbered items showing how Auth0 removes each friction point to unblock the priority. For devs: specific capabilities. For managers: team velocity gains. For execs: business outcomes.
4. Our Partnership Approach - 2 to 3 sentences on what collaboration looks like, tied to their priority timeline.
5. Recommended Next Steps - 2 to 3 numbered action items that are specific and actionable, anchored to the priority.

Total length: 500 to 700 words. Every sentence should be specific to this company and their priority, not generic.

## Critical rules
- Never make up facts. Only use information provided in the account data.
- If you do not have data for something, write around it naturally - do not hallucinate.
- The document must read as if written by someone who has spent time understanding this company's business, not just their tech stack.

## Auth0 Value Framework
${AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE}
- Anchor the narrative in the company's #1 business priority, the identity friction that threatens it, and the business outcome Auth0 enables.
- If the account data includes a Command of the Message section, use it as the primary narrative brief.

## PROCESS FOR GENERATION
1. Identify the company's #1 business priority from the account data.
2. Classify the recipient persona tier (dev / mid-manager / exec).
3. Map the identity/auth friction that connects to the business priority.
4. Write the POV anchored to the priority, calibrated to the persona.
5. In "reasoning", state: the business priority, the persona tier, and why this angle was chosen.

## Output format
Return ONLY valid JSON. No markdown fences, no pre-text.

For EMAIL:
{
  "outputType": "email",
  "subject": "tied to their business priority",
  "body": "full email body...",
  "reasoning": "Business priority identified, persona tier (dev/mid-manager/exec), and the angle chosen",
  "keyInsights": ["business priority signal", "identity friction selected", "persona calibration note"]
}

For DOCUMENT:
{
  "outputType": "document",
  "title": "Point of View: [Company Name] + Auth0",
  "sections": [
    { "heading": "Your Priority", "content": "..." },
    { "heading": "The Identity Friction", "content": "..." },
    { "heading": "How Auth0 Accelerates This Priority", "content": "..." },
    { "heading": "Our Partnership Approach", "content": "..." },
    { "heading": "Recommended Next Steps", "content": "..." }
  ],
  "reasoning": "Business priority identified, persona tier, and overall narrative chosen",
  "keyInsights": ["business priority signal", "identity friction selected", "persona calibration note"]
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
    if (account.command_of_message) parts.push(`\nCOMMAND OF THE MESSAGE:\n${account.command_of_message}`);
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
    if (account.okta_priority_score) parts.push(`OKTA PRIORITY SCORE: ${account.okta_priority_score}/100`);
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

    const documentContext = buildAttachedAccountDocumentContext(account.id);
    if (documentContext) parts.push(`\n${documentContext}`);
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
  parts.push('\nIf the account data includes COMMAND OF THE MESSAGE, use it as the primary POV brief.');
  parts.push('\nIf attached account document context is present, treat it as trusted user-supplied context and use it to sharpen specificity.');
  parts.push('\nGenerate the POV now. Return valid JSON only.');

  return parts.join('\n');
}

function parseAgentResponse(response: string, expectedType: 'email' | 'document'): PovResult {
  const clean = response
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
