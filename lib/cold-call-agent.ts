import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE } from './auth0-value-framework';
import { Account } from './db';
import { AccountOverviewRecord } from './account-overview';
import { buildEnhancedAgentContext } from './enhanced-agent-context';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

const COLD_CALL_MODEL = process.env.COLD_CALL_MODEL || 'claude-4-6-opus';

export interface ColdCallRequest {
  recipientName: string;
  recipientPersona: string;
  researchContext?: 'auth0' | 'okta';
  customInstructions?: string;
  accountData: Account;
  overview?: AccountOverviewRecord | null;
  notes?: Array<{ content: string; createdAt: string }>;
  model?: string;
}

export interface ColdCallResult {
  opener: string;
  transitionQuestion: string;
  discoveryQuestions: string[];
  objectionHandles: Array<{ objection: string; response: string }>;
  closingAsk: string;
  reasoning: string;
  keyInsights: string[];
}

const SYSTEM_INSTRUCTIONS = `You are Charlie Webber, an expert SDR at Okta/Auth0 based in Australia. You're preparing a cold call opener and script framework. Your phone style is influenced by Josh Braun's methodology - you lead with curiosity, not a pitch.

### CHARLIE'S PHONE STYLE
**1. TONE:**
- **Casual & Curious:** You sound like a colleague, not a salesperson. No scripts that sound read aloud.
- **Direct:** Get to why you're calling in under 10 seconds.
- **Australian English:** Natural, down-to-earth. "Cheers" to close.
- **Conversational:** Short sentences. Pauses. Questions that invite real answers.

**2. CALL STRUCTURE:**

**Opener (5-10 seconds):**
- Permission-based pattern: "Hey [Name], it's Charlie from Auth0. Did I catch you at a bad time?"
- OR observation-based: "Hey [Name], Charlie here from Auth0. I saw [specific trigger] and wanted to ask you a quick question."
- NEVER open with "How are you?" or long intros.

**Transition Question (10-15 seconds):**
- Bridge from opener to the specific problem hypothesis.
- Use "I saw X, and usually that means Y - is that something you're seeing?"
- This is the "Poke the Bear" moment on the phone.

**Discovery Questions (2-3 questions):**
- Open-ended questions that uncover pain.
- "How are you currently handling X?"
- "What happens when Y?"
- "Who else is involved in decisions around Z?"
- NEVER ask yes/no questions.

**Objection Handles (2-3 common ones):**
- "We already have something" → "Totally fair. Out of curiosity, what are you using? [Then probe for gaps]"
- "Not a priority right now" → "Makes sense. When you do look at this, what would trigger that?"
- "Send me an email" → "Happy to. So I send something relevant - what's the biggest thing on your plate with [topic]?"
- Keep handles conversational, not defensive.

**Closing Ask:**
- Soft close: "Would it make sense to grab 15 minutes next week to walk through how [peer company] handled this?"
- OR value offer: "I can send over a quick breakdown of what I'm seeing in your space. Would that be useful?"
- NEVER hard close on first call.

**3. CRITICAL RULES:**
- Total call target: 3-5 minutes max for first cold call
- Sound like a real person, not a script reader
- Reference specific account data - never generic
- If account priorities or POV are available, use them to sharpen the hook
- Adapt persona approach: CTO gets technical angles, CFO gets business impact, CISO gets risk angles

### AUTH0 VALUE FRAMEWORK
${AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE}

### OUTPUT FORMAT
Return ONLY valid JSON. No markdown, no pre-text.

{
  "opener": "The opening line (1-2 sentences)",
  "transitionQuestion": "The bridge question that pokes the bear (2-3 sentences)",
  "discoveryQuestions": ["Question 1", "Question 2", "Question 3"],
  "objectionHandles": [
    {"objection": "We already have something", "response": "Handle response..."},
    {"objection": "Not a priority", "response": "Handle response..."}
  ],
  "closingAsk": "The soft close (1-2 sentences)",
  "reasoning": "Why you chose this approach based on the account data",
  "keyInsights": ["Insight 1", "Insight 2"]
}`;

export async function generateColdCall(request: ColdCallRequest): Promise<ColdCallResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const accountContext = buildEnhancedAgentContext(
      request.accountData,
      request.overview ?? null,
      request.notes ?? [],
      request.researchContext || 'auth0'
    );

    const prompt = buildPrompt(request, accountContext);

    const contextLabel = request.researchContext === 'okta' ? 'Okta' : 'Auth0';

    const agent = new Agent({
      name: `${contextLabel} Cold Call Opener - Charlie Style`,
      model: request.model || COLD_CALL_MODEL,
      instructions: SYSTEM_INSTRUCTIONS,
      tools: [],
    });

    const response = await run(agent, prompt);
    return parseAgentResponse(response.finalOutput || '');
  } catch (error) {
    console.error('Cold call generation error:', error);
    throw new Error(`Failed to generate cold call script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function buildPrompt(request: ColdCallRequest, accountContext: string): string {
  const parts: string[] = [];

  parts.push('Generate a cold call opener and script framework with the following parameters:\n');
  parts.push(`RECIPIENT NAME: ${request.recipientName}`);
  parts.push(`RECIPIENT PERSONA: ${request.recipientPersona}`);

  if (request.customInstructions) {
    parts.push(`\nCUSTOM INSTRUCTIONS: ${request.customInstructions}`);
  }

  parts.push('\n--- ACCOUNT DATA ---\n');
  parts.push(accountContext);
  parts.push('\n--- END ACCOUNT DATA ---\n');
  parts.push('\nIf the account data includes COMMAND OF THE MESSAGE, use it as the primary angle for the call.');
  parts.push('\nIf ACCOUNT OVERVIEW data is present (priorities, value drivers, triggers, POV), use these to sharpen the hook and discovery questions.');
  parts.push('\nIf ACCOUNT TEAM NOTES are present, incorporate any relevant context into your approach.');
  parts.push('\nGenerate the cold call script now following Charlie Webber\'s phone style. Return valid JSON only.');

  return parts.join('\n');
}

function parseAgentResponse(response: string): ColdCallResult {
  try {
    let cleanResponse = response;
    cleanResponse = cleanResponse.replace(/```json\s*/g, '');
    cleanResponse = cleanResponse.replace(/```\s*/g, '');

    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.opener || !parsed.transitionQuestion || !parsed.closingAsk) {
      throw new Error('Missing required fields in response');
    }

    return {
      opener: parsed.opener,
      transitionQuestion: parsed.transitionQuestion,
      discoveryQuestions: Array.isArray(parsed.discoveryQuestions) ? parsed.discoveryQuestions : [],
      objectionHandles: Array.isArray(parsed.objectionHandles)
        ? parsed.objectionHandles.map((o: any) => ({ objection: o.objection || '', response: o.response || '' }))
        : [],
      closingAsk: parsed.closingAsk,
      reasoning: parsed.reasoning || '',
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
    };
  } catch (error) {
    console.error('Failed to parse cold call response:', error);
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON from agent response: ${error.message}`);
    }
    throw new Error('Failed to parse cold call script from agent response');
  }
}
