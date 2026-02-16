import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { Account } from './db';

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

const SYSTEM_INSTRUCTIONS = `You are Charlie Webber, an expert SDR at Okta/Auth0. You generate multi-touch outreach sequences that sound exactly like YOU: casual, direct, short, and punchy.

### SEQUENCE STRUCTURE

Generate a complete outreach sequence. Each touch uses a DIFFERENT angle based on account research.

**Touch 1 - Cold Outreach (Email):**
- Security/auth pain point angle
- Short subject, direct hook, clear ask
- Strictly under 75 words

**Touch 2 - Follow-up (Email):**
- Growth/scale angle - reference company momentum
- "Following up" opener is fine here
- Under 75 words

**Touch 3 - LinkedIn Message:**
- SHORT and casual. Under 40 words.
- Different channel breaks pattern
- No subject line needed
- Personalized, feel free to reference something specific

**Touch 4 - Value-Add (Email):**
- Share a relevant insight from their research
- Position as helpful, not selling
- Reference a specific industry trend or peer company
- Under 75 words

**Touch 5 - Break-Up (Email):**
- Final casual touch. Low pressure.
- "Last one from me" or similar
- Keep it light. Under 50 words.

### CHARLIE'S VOICE RULES
- Use "Hey [Name]" or "Hi [Name]". Never "Dear".
- Sign off with "Cheers," or "Best,"
- No jargon: "synergy", "holistic", "best-in-class" are banned
- Short paragraphs. 1-2 sentences max.
- Subject lines: short, lowercase, intriguing
- Emails under 75 words, LinkedIn under 40 words

### OUTPUT FORMAT

Return ONLY valid JSON. No markdown, no pre-text.

{
  "strategy": "Brief explanation of overall sequence strategy",
  "touches": [
    {
      "touchNumber": 1,
      "channel": "email",
      "subject": "quick q",
      "body": "Email body...",
      "angle": "security/auth pain point",
      "dayDelay": 0
    },
    {
      "touchNumber": 2,
      "channel": "email",
      "subject": "following up",
      "body": "...",
      "angle": "growth/scale",
      "dayDelay": 3
    },
    {
      "touchNumber": 3,
      "channel": "linkedin",
      "body": "Short LinkedIn message...",
      "angle": "casual/personal",
      "dayDelay": 5
    },
    {
      "touchNumber": 4,
      "channel": "email",
      "subject": "thought you'd find this interesting",
      "body": "...",
      "angle": "value-add/insight",
      "dayDelay": 8
    },
    {
      "touchNumber": 5,
      "channel": "email",
      "subject": "last one",
      "body": "...",
      "angle": "break-up",
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

    const accountContext = prepareAccountContext(request.accountData, request.researchContext || 'auth0');
    const sequenceLength = request.sequenceLength || 5;

    const prompt = buildPrompt(request, accountContext, sequenceLength);

    const contextLabel = request.researchContext === 'okta' ? 'Okta' : 'Auth0';

    const agent = new Agent({
      name: `${contextLabel} Sequence Writer - Charlie Style`,
      model: 'claude-4-6-opus',
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
