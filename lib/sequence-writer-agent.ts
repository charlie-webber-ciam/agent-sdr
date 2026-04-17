import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE } from './auth0-value-framework';
import { buildAttachedAccountDocumentContext } from './account-documents';
import { Account } from './db';
import { AccountOverviewRecord } from './account-overview';
import { buildActivityContext } from './activity-context';
import { buildEnhancedAgentContext } from './enhanced-agent-context';

// Disable tracing — it tries to hit api.openai.com directly, which fails with a custom base URL
setTracingDisabled(true);

// Configure OpenAI client with custom base URL for agents SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Set the OpenAI client for the agents SDK
setDefaultOpenAIClient(openai);

export interface SequenceRequest {
  recipientName: string;
  recipientPersona: string;
  researchContext?: 'auth0' | 'okta';
  customInstructions?: string;
  sequenceLength?: number; // 3-5, default 5
  accountData: Account;
  overview?: AccountOverviewRecord | null;
  notes?: Array<{ content: string; createdAt: string }>;
  model?: string;
}

export interface SequenceTouch {
  touchNumber: number;
  channel: 'email' | 'linkedin';
  subject?: string; // Only for email
  body: string;
  angle: string;
  dayDelay: number;
}

export interface SequenceResult {
  touches: SequenceTouch[];
  strategy: string;
}

const SYSTEM_INSTRUCTIONS = `You are Charlie Webber, an expert SDR at Okta/Auth0. You generate multi-touch outreach sequences where every touch is a mini-POV: a short, specific perspective that demonstrates you understand the company's biggest business priority and can connect it to an identity/auth angle.

Your sequences are casual, direct, short, and punchy. But they are strategically anchored.

### THE #1 RULE: ATTACH TO THE COMPANY'S BIGGEST BUSINESS PRIORITY

Before writing any touch, identify the company's single biggest priority as a business. This is where the biggest budget sits. The ENTIRE sequence must orbit this priority. Not an auth problem. Not an identity problem. The BUSINESS problem.

Examples: international expansion, platform consolidation post-M&A, hitting profitability targets, launching a new product line, scaling to IPO, regulatory compliance for market entry, digital transformation of core revenue stream.

Every touch connects their business priority to an identity/auth friction from a different angle. The identity angle is the enabler, not the headline.

### PERSONA CALIBRATION

The recipient's role determines HOW you frame every touch:

**Developer / Engineer / Architect:**
- Lead with product and technical specifics
- Reference SDK, API, migration, architecture friction
- Frame Auth0 as removing engineering drag on their priority
- Language: direct, technical, no business abstractions

**Mid-Level Manager (Director, VP, Head of):**
- Balance: 60% business impact, 40% how the product solves it
- Reference team velocity, project timelines, resource allocation
- Frame Auth0 as accelerating their team's delivery against the priority

**Executive (C-suite, SVP, GM):**
- Pure business language: revenue impact, competitive risk, time-to-market
- Zero product specifics. Auth0 is implied, never pitched
- Frame as a strategic gap that threatens the priority

### SEQUENCE STRUCTURE

Generate a complete outreach sequence. EVERY touch is anchored to the same business priority but approaches the identity/auth friction from a DIFFERENT angle. The sequence tells a coherent story.

**Touch 1 - The Observation (Email):**
- Lead with the business priority signal and the most obvious identity friction
- Calibrate to persona tier
- Short subject tied to the business priority, not auth
- Strictly under 75 words

**Touch 2 - The Deeper Cut (Email):**
- Same business priority, different angle: what typically goes wrong next
- Reference a second-order consequence (timeline slips, cost overruns, customer churn)
- Under 75 words

**Touch 3 - The Social Touch (LinkedIn):**
- SHORT and casual. Under 40 words.
- Reference something specific about the business priority from their profile or company news
- Different channel breaks pattern

**Touch 4 - The Evidence (Email):**
- Share a relevant insight about how similar companies hit the same wall
- Position as helpful perspective, not selling
- Still tied to their business priority
- Under 75 words

**Touch 5 - The Close (Email):**
- Final touch. Circle back to the original business priority.
- Restate the core friction simply.
- Low pressure. Under 50 words.

### CHARLIE'S VOICE RULES
- Use "Hey [Name]" or "Hi [Name]". Never "Dear".
- Sign off with "Cheers," or "Best,"
- No jargon: "synergy", "holistic", "best-in-class" are banned
- Short paragraphs. 1-2 sentences max.
- Subject lines: short, lowercase, tied to the business priority
- Emails under 75 words, LinkedIn under 40 words
- NO em dashes. Use hyphens or short sentences.
- No emojis.

### AUTH0 VALUE FRAMEWORK
${AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE}
- Keep the whole sequence anchored to the same primary value driver unless the research strongly supports a second one.
- If the account data includes a Command of the Message section, use it as the backbone for the sequence strategy.

### PROCESS FOR GENERATION
1. Identify the company's #1 business priority from account data.
2. Classify the recipient persona tier (dev / mid-manager / exec).
3. Map 5 different identity/auth friction angles that all connect back to the business priority.
4. Write each touch calibrated to the persona tier.
5. In "strategy", state: the business priority, persona tier, and the narrative arc across all touches.

### OUTPUT FORMAT

Return ONLY valid JSON. No markdown, no pre-text.

{
  "strategy": "Business priority identified, persona tier, and how the sequence narrative unfolds across touches",
  "touches": [
    {
      "touchNumber": 1,
      "channel": "email",
      "subject": "tied to business priority",
      "body": "Email body...",
      "angle": "business priority + primary friction",
      "dayDelay": 0
    },
    {
      "touchNumber": 2,
      "channel": "email",
      "subject": "second angle subject",
      "body": "...",
      "angle": "business priority + second-order consequence",
      "dayDelay": 3
    },
    {
      "touchNumber": 3,
      "channel": "linkedin",
      "body": "Short LinkedIn message...",
      "angle": "business priority + personal/social angle",
      "dayDelay": 5
    },
    {
      "touchNumber": 4,
      "channel": "email",
      "subject": "evidence angle subject",
      "body": "...",
      "angle": "business priority + peer company evidence",
      "dayDelay": 8
    },
    {
      "touchNumber": 5,
      "channel": "email",
      "subject": "closing angle subject",
      "body": "...",
      "angle": "business priority + simple restatement",
      "dayDelay": 12
    }
  ]
}`;

export async function generateSequence(request: SequenceRequest): Promise<SequenceResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const accountContext = (request.overview || request.notes)
      ? buildEnhancedAgentContext(request.accountData, request.overview ?? null, request.notes ?? [], request.researchContext || 'auth0')
      : prepareAccountContext(request.accountData, request.researchContext || 'auth0');
    const sequenceLength = request.sequenceLength || 5;

    const prompt = buildPrompt(request, accountContext, sequenceLength);

    const contextLabel = request.researchContext === 'okta' ? 'Okta' : 'Auth0';

    const agent = new Agent({
      name: `${contextLabel} Sequence Writer - Charlie Style`,
      model: request.model || 'claude-4-6-opus',
      instructions: SYSTEM_INSTRUCTIONS,
      tools: [],
    });

    const response = await run(agent, prompt);
    const result = parseAgentResponse(response.finalOutput || '', sequenceLength);
    return result;
  } catch (error) {
    console.error('Sequence generation error:', error);
    throw new Error(`Failed to generate sequence: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function prepareAccountContext(account: Account, researchContext: 'auth0' | 'okta' = 'auth0'): string {
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
    if (account.auth0_skus) parts.push(`RELEVANT SKUs: ${account.auth0_skus}`);
    if (account.current_auth_solution) parts.push(`\nCURRENT AUTH SOLUTION:\n${account.current_auth_solution}`);
    if (account.customer_base_info) parts.push(`\nCUSTOMER BASE & GROWTH:\n${account.customer_base_info}`);
    if (account.security_incidents) parts.push(`\nSECURITY & COMPLIANCE:\n${account.security_incidents}`);
    if (account.news_and_funding) parts.push(`\nRECENT NEWS & FUNDING:\n${account.news_and_funding}`);
    if (account.tech_transformation) parts.push(`\nTECH TRANSFORMATION:\n${account.tech_transformation}`);
    if (account.research_summary) parts.push(`\nEXECUTIVE SUMMARY:\n${account.research_summary}`);
  } else {
    if (account.okta_opportunity_type) parts.push(`\nOPPORTUNITY TYPE: ${account.okta_opportunity_type}`);
    if (account.okta_current_iam_solution) parts.push(`\nCURRENT IAM SOLUTION:\n${account.okta_current_iam_solution}`);
    if (account.okta_workforce_info) parts.push(`\nWORKFORCE & IT COMPLEXITY:\n${account.okta_workforce_info}`);
    if (account.okta_security_incidents) parts.push(`\nSECURITY & COMPLIANCE:\n${account.okta_security_incidents}`);
    if (account.okta_news_and_funding) parts.push(`\nRECENT NEWS & FUNDING:\n${account.okta_news_and_funding}`);
    if (account.okta_tech_transformation) parts.push(`\nTECH TRANSFORMATION:\n${account.okta_tech_transformation}`);
    if (account.okta_ecosystem) parts.push(`\nOKTA ECOSYSTEM:\n${account.okta_ecosystem}`);
    if (account.okta_research_summary) parts.push(`\nEXECUTIVE SUMMARY:\n${account.okta_research_summary}`);
  }

  // Append activity context if available
  if (account.id) {
    const actContext = buildActivityContext(account.id);
    if (actContext) {
      parts.push(`\n${actContext}`);
    }

    const documentContext = buildAttachedAccountDocumentContext(account.id);
    if (documentContext) {
      parts.push(`\n${documentContext}`);
    }
  }

  return parts.join('\n');
}

function buildPrompt(request: SequenceRequest, accountContext: string, sequenceLength: number): string {
  const parts: string[] = [];

  parts.push(`Generate a ${sequenceLength}-touch outreach sequence with the following parameters:\n`);
  parts.push(`RECIPIENT NAME: ${request.recipientName}`);
  parts.push(`RECIPIENT PERSONA: ${request.recipientPersona}`);

  if (request.customInstructions) {
    parts.push(`\nCUSTOM INSTRUCTIONS: ${request.customInstructions}`);
  }

  if (sequenceLength < 5) {
    parts.push(`\nNOTE: Only generate ${sequenceLength} touches. Skip touches ${sequenceLength + 1}-5 from the standard template.`);
  }

  parts.push('\n--- ACCOUNT RESEARCH DATA ---\n');
  parts.push(accountContext);
  parts.push('\n--- END ACCOUNT DATA ---\n');
  parts.push('\nIf the account data includes COMMAND OF THE MESSAGE, use it as the primary sequence brief.');
  parts.push('\nIf attached account document context is present, use it as trusted user-supplied context to sharpen the sequence angles.');
  parts.push(`\nGenerate a ${sequenceLength}-touch outreach sequence in Charlie Webber's style. Return valid JSON only.`);

  return parts.join('\n');
}

function parseAgentResponse(response: string, expectedLength: number): SequenceResult {
  try {
    let cleanResponse = response;
    cleanResponse = cleanResponse.replace(/```json\s*/g, '');
    cleanResponse = cleanResponse.replace(/```\s*/g, '');

    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.touches || !Array.isArray(parsed.touches)) {
      throw new Error('Missing touches array in response');
    }

    // Validate and normalize touches
    const touches: SequenceTouch[] = parsed.touches.slice(0, expectedLength).map((t: any, i: number) => ({
      touchNumber: t.touchNumber || i + 1,
      channel: t.channel === 'linkedin' ? 'linkedin' : 'email',
      subject: t.subject || undefined,
      body: t.body || '',
      angle: t.angle || '',
      dayDelay: t.dayDelay ?? (i * 3),
    }));

    return {
      strategy: parsed.strategy || '',
      touches,
    };
  } catch (error) {
    console.error('Failed to parse sequence response:', error);
    throw new Error('Failed to parse sequence from agent response');
  }
}
