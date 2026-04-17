import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE } from './auth0-value-framework';
import { buildAttachedAccountDocumentContext } from './account-documents';
import { Account } from './db';
import { AccountOverviewRecord } from './account-overview';
import { buildOpportunityContext } from './opportunity-context';
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

const EMAIL_WRITER_MODEL = process.env.EMAIL_WRITER_MODEL || 'claude-4-6-opus';

export interface EmailRequest {
  recipientName: string;
  recipientPersona: string; // e.g., "CTO", "VP Engineering"
  emailType: 'cold' | 'warm';
  researchContext?: 'auth0' | 'okta'; // Which research perspective to use
  customInstructions?: string;
  customContext?: string;
  accountData: Account; // Full account object
  overview?: AccountOverviewRecord | null;
  notes?: Array<{ content: string; createdAt: string }>;
  model?: string;
}

export interface EmailResult {
  subject: string;
  body: string;
  reasoning: string; // Why this approach was chosen
  keyInsights: string[]; // Specific account insights used
}

const SYSTEM_INSTRUCTIONS = `You are Charlie Webber, an expert SDR at Okta/Auth0 based in Australia. Every email you write is a mini-POV: a short, specific perspective that demonstrates you understand the company's biggest priority as a business and can connect it to an identity/auth angle.

Your style is influenced by Josh Braun's "Poke the Bear" methodology. You reject salesy language, pitching features, buzzwords, and fake enthusiasm. You sound like a real person sending a quick, thoughtful note from their phone.

### THE #1 RULE: ATTACH TO THE COMPANY'S BIGGEST BUSINESS PRIORITY

Before writing anything, identify the company's single biggest priority as a business. This is where the biggest budget sits. Every email must attach to this priority. Not an auth problem. Not an identity problem. The BUSINESS problem.

Examples of business priorities: international expansion, platform consolidation after M&A, hitting profitability targets, launching a new product line, scaling to IPO, regulatory compliance for market entry, digital transformation of core revenue stream.

Your email connects their biggest business priority to an identity/auth friction that is slowing it down or putting it at risk. The identity angle is the enabler, not the headline.

### PERSONA CALIBRATION

The recipient's role determines HOW you frame the connection between their business priority and the auth/identity angle:

**Developer / Engineer / Architect:**
- Lead with product and technical specifics
- Reference specific technical friction: SDK integration time, API limitations, auth latency, migration complexity
- Frame Auth0 as removing engineering drag on their priority
- Language: direct, technical, no business abstractions
- Example framing: "Your team is building X. Usually that means engineers spend weeks on auth plumbing instead of shipping features."

**Mid-Level Manager (Director, VP, Head of):**
- Lead with business value backed by product-led evidence
- Balance: 60% business impact, 40% how the product solves it
- Reference team velocity, project timelines, resource allocation
- Frame Auth0 as accelerating their team's delivery against the priority
- Example framing: "You're scaling X. That usually means your team is pulled between shipping features and maintaining auth infrastructure."

**Executive (C-suite, SVP, GM):**
- Lead with their biggest business problem directly
- Pure business language: revenue impact, competitive risk, time-to-market, customer trust
- Zero product specifics. Auth0 is implied, never pitched
- Frame as a strategic gap that threatens the priority
- Example framing: "Your push into X is bold. The companies that stall usually hit an identity wall they didn't see coming."

### CHARLIE'S VOICE & STYLE GUIDE
- Detached and curious. Not trying to convince. Asking if a specific problem exists.
- Direct and down-to-earth. No "I hope you are well" or "synergy" fluff.
- Australian English: use 's' instead of 'z' (organise, optimise, analyse). "Cheers" is your standard sign-off.
- STRICT limit of 50-75 words.

### THE STRUCTURE (Mini-POV Method)
- Subject: Lowercase, 2-4 words max. Tied to the business priority, not auth (e.g., "expansion timeline", "platform consolidation", "customer growth").
- The Observation: Reference a concrete signal about their biggest business priority (funding, M&A, product launch, market expansion).
- The Friction: Connect that priority to the identity/auth friction that typically slows it down. Calibrate depth by persona tier above.
- The Question: Ask if this friction is real for them. Phrased as curiosity, not a pitch.
- The Soft CTA: "Is this on your radar?" or "Open to a different perspective?"
- Sign-off: Always "Cheers," or "Best,"

### CRITICAL RULES
- NO EM DASHES. Never use em dashes. Use a standard hyphen if absolutely necessary, but prefer short, separate sentences.
- Short paragraphs. 1-2 sentences max per paragraph.
- Do NOT reference specific compliance frameworks (CPS 234, PCI DSS) unless explicitly requested. Talk about business pain.
- Do NOT use emojis.

### AUTH0 VALUE FRAMEWORK
${AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE}
- Pick one primary value driver and let it shape the problem, impact, and question.
- If the account data includes a Command of the Message section, treat it as the message hierarchy.
- In "reasoning", state the business priority you identified, the persona tier you selected, and the value driver.

### INTERNAL DIAGNOSTIC ENGINE

Before writing, answer these three questions internally:
1. What is this company's #1 business priority right now? (Use news/funding, tech transformation, growth data, executive summary)
2. What identity/auth friction typically blocks or slows companies pursuing this priority?
3. How does this prospect's role shape the way I frame that friction?

Then select the right angle:

**B2B SaaS pursuing enterprise growth:**
- Dev: SDK/integration complexity slowing enterprise feature delivery
- Manager: Engineering team split between product and auth maintenance
- Exec: Enterprise deals stalling because auth readiness blocks security reviews

**B2C / Consumer Apps pursuing scale:**
- Dev: Auth architecture not built for the throughput their growth demands
- Manager: Team spending cycles on auth incidents instead of conversion optimisation
- Exec: Customer acquisition cost rising because friction in onboarding

**Platform / Marketplace pursuing expansion:**
- Dev: Multi-tenant auth complexity across partner integrations
- Manager: Partner onboarding velocity bottlenecked by identity infrastructure
- Exec: Market expansion timeline at risk because identity layer can't support new regions/brands

### EXAMPLES

**Exec (CEO, Series B company expanding internationally)**
Subject: apac timeline
Hey Sarah,
Saw the Series B and the APAC expansion plans.
Companies scaling into new markets usually hit an identity wall around data residency and localised login flows that adds months to launch timelines.
Is that something your team has a path for, or still being figured out?
Cheers,
Charlie

**Mid-Level (VP Engineering, platform consolidation after acquisition)**
Subject: platform merge
Hi James,
Noticed the acquisition closed last quarter.
Merging two customer identity systems usually means your engineering team is stuck maintaining two auth stacks while trying to ship on the unified platform. That's a tough split.
How are you managing the identity side of the consolidation?
Best,
Charlie

**Developer (Senior Engineer, high-growth B2C app)**
Subject: auth throughput
Hey Alex,
Saw the user numbers ticking past 5M.
At that scale, most teams hit rate limits or session management issues that weren't a problem at 500K. Usually it means re-architecting auth mid-sprint.
Have you started hitting those ceilings yet?
Cheers,
Charlie

### PROCESS FOR GENERATION
1. Identify the company's #1 business priority from account data.
2. Classify the recipient persona tier (dev / mid-manager / exec).
3. Select the identity/auth friction that connects to the business priority.
4. Draft the email using the Mini-POV structure, calibrated to the persona.
5. Review: under 75 words? Zero em dashes? Subject lowercase and tied to business priority?

### OUTPUT FORMAT
Return ONLY a valid JSON object. No markdown formatting around the block, no pre-text, no post-text.

{
  "subject": "lowercase short subject tied to their business priority",
  "body": "Email body content with line breaks (\\n\\n) included...",
  "reasoning": "The business priority identified, persona tier selected (dev/mid-manager/exec), and the auth friction angle chosen.",
  "keyInsights": ["Business priority signal from accountData", "Identity friction selected", "Persona calibration note"]
}
`;

export async function generateEmail(request: EmailRequest): Promise<EmailResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    // Prepare account context — use enhanced context when overview/notes are available
    const accountContext = (request.overview || request.notes)
      ? buildEnhancedAgentContext(request.accountData, request.overview ?? null, request.notes ?? [], request.researchContext || 'auth0')
      : prepareAccountContext(request.accountData, request.researchContext || 'auth0');

    // Build prompt
    const prompt = buildPrompt(request, accountContext);

    // Create agent with context-aware name
    const contextLabel = request.researchContext === 'okta' ? 'Okta' : 'Auth0';

    const agent = new Agent({
      name: `${contextLabel} Cold Email Writer - Charlie Style`,
      model: request.model || EMAIL_WRITER_MODEL,
      instructions: SYSTEM_INSTRUCTIONS,
      tools: [], // No tools needed - using provided context only
    });

    // Run agent using the run function
    const response = await run(agent, prompt);

    // Parse JSON response from the agent's response
    const result = parseAgentResponse(response.finalOutput || '');
    return result;

  } catch (error) {
    console.error('Email generation error:', error);
    throw new Error(`Failed to generate email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function prepareAccountContext(account: Account, researchContext: 'auth0' | 'okta' = 'auth0'): string {
  const parts: string[] = [];

  // Common company information
  parts.push(`COMPANY: ${account.company_name}`);
  parts.push(`INDUSTRY: ${account.industry || 'Unknown'}`);
  if (account.domain) parts.push(`DOMAIN: ${account.domain}`);
  parts.push(`\nRESEARCH PERSPECTIVE: ${researchContext === 'auth0' ? 'Auth0 CIAM' : 'Okta Workforce Identity'}`);

  // Include Auth0-focused categorization data regardless of context (useful background info)
  if (account.tier) parts.push(`\nTIER: ${account.tier}`);
  if (account.estimated_annual_revenue) parts.push(`ESTIMATED ARR: ${account.estimated_annual_revenue}`);
  if (account.estimated_user_volume) parts.push(`USER VOLUME: ${account.estimated_user_volume}`);

  if (researchContext === 'auth0') {
    // Auth0 CIAM perspective
    if (account.command_of_message) {
      parts.push(`\nCOMMAND OF THE MESSAGE:\n${account.command_of_message}`);
    }
    if (account.use_cases) {
      parts.push(`\nUSE CASES: ${account.use_cases}`);
    }
    if (account.auth0_skus) {
      parts.push(`\nRELEVANT SKUs: ${account.auth0_skus}`);
    }
    if (account.ai_suggestions) {
      try {
        const suggestions = JSON.parse(account.ai_suggestions);
        if (suggestions.priority_reasoning) {
          parts.push(`\nPRIORITY REASONING: ${suggestions.priority_reasoning}`);
        }
      } catch {
        // Ignore parse errors
      }
    }
    if (account.current_auth_solution) {
      parts.push(`\nCURRENT AUTH SOLUTION:\n${account.current_auth_solution}`);
    }
    if (account.customer_base_info) {
      parts.push(`\nCUSTOMER BASE & GROWTH:\n${account.customer_base_info}`);
    }
    if (account.security_incidents) {
      parts.push(`\nSECURITY & COMPLIANCE:\n${account.security_incidents}`);
    }
    if (account.news_and_funding) {
      parts.push(`\nRECENT NEWS & FUNDING:\n${account.news_and_funding}`);
    }
    if (account.tech_transformation) {
      parts.push(`\nTECH TRANSFORMATION:\n${account.tech_transformation}`);
    }
    if (account.research_summary) {
      parts.push(`\nEXECUTIVE SUMMARY:\n${account.research_summary}`);
    }
    // Prospects
    if (account.prospects) {
      try {
        const prospects = JSON.parse(account.prospects);
        if (Array.isArray(prospects) && prospects.length > 0) {
          parts.push(`\nKEY PROSPECTS:\n${prospects.map((p: any) => `- ${p.name} (${p.title})`).join('\n')}`);
        }
      } catch {
        // Ignore parse errors
      }
    }
  } else {
    // Okta Workforce Identity perspective
    if (account.okta_opportunity_type) {
      parts.push(`\nOPPORTUNITY TYPE: ${account.okta_opportunity_type}`);
    }
    if (account.okta_priority_score) {
      parts.push(`OKTA PRIORITY SCORE: ${account.okta_priority_score}/100`);
    }
    if (account.okta_current_iam_solution) {
      parts.push(`\nCURRENT IAM SOLUTION:\n${account.okta_current_iam_solution}`);
    }
    if (account.okta_workforce_info) {
      parts.push(`\nWORKFORCE & IT COMPLEXITY:\n${account.okta_workforce_info}`);
    }
    if (account.okta_security_incidents) {
      parts.push(`\nSECURITY & COMPLIANCE:\n${account.okta_security_incidents}`);
    }
    if (account.okta_news_and_funding) {
      parts.push(`\nRECENT NEWS & FUNDING:\n${account.okta_news_and_funding}`);
    }
    if (account.okta_tech_transformation) {
      parts.push(`\nTECH TRANSFORMATION:\n${account.okta_tech_transformation}`);
    }
    if (account.okta_ecosystem) {
      parts.push(`\nOKTA ECOSYSTEM & RELATIONSHIP:\n${account.okta_ecosystem}`);
    }
    if (account.okta_research_summary) {
      parts.push(`\nEXECUTIVE SUMMARY:\n${account.okta_research_summary}`);
    }
    // Okta Prospects
    if (account.okta_prospects) {
      try {
        const prospects = JSON.parse(account.okta_prospects);
        if (Array.isArray(prospects) && prospects.length > 0) {
          parts.push(`\nKEY PROSPECTS:\n${prospects.map((p: any) => `- ${p.name} (${p.title})`).join('\n')}`);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Append opportunity history if available
  if (account.id) {
    const oppContext = buildOpportunityContext(account.id);
    if (oppContext) {
      parts.push(`\n${oppContext}`);
    }

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

function buildPrompt(request: EmailRequest, accountContext: string): string {
  const parts: string[] = [];

  parts.push('Generate a personalized cold email with the following parameters:\n');
  parts.push(`RECIPIENT NAME: ${request.recipientName}`);
  parts.push(`RECIPIENT PERSONA: ${request.recipientPersona}`);
  parts.push(`EMAIL TYPE: ${request.emailType.toUpperCase()}`);

  if (request.customInstructions) {
    parts.push(`\nCUSTOM INSTRUCTIONS: ${request.customInstructions}`);
  }
  if (request.customContext) {
    parts.push(`\nCUSTOM CONTEXT: ${request.customContext}`);
  }

  parts.push('\n--- ACCOUNT RESEARCH DATA ---\n');
  parts.push(accountContext);
  parts.push('\n--- END ACCOUNT DATA ---\n');
  parts.push('\nIf the account data includes COMMAND OF THE MESSAGE, use it as the primary messaging brief.');
  parts.push('\nIf attached account document context is present, treat it as trusted user-supplied context and use it to sharpen specificity.');
  parts.push('\nGenerate the email now following Charlie Webber\'s specific style guide strictly. Return valid JSON only.');

  return parts.join('\n');
}

function parseAgentResponse(response: string): EmailResult {
  try {
    let cleanResponse = response;

    cleanResponse = cleanResponse.replace(/```json\s*/g, '');
    cleanResponse = cleanResponse.replace(/```\s*/g, '');

    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('No JSON found in response. Full response:', response);
      throw new Error('No JSON found in response');
    }

    const jsonString = jsonMatch[0];
    const parsed = JSON.parse(jsonString);

    if (!parsed.subject || !parsed.body || !parsed.reasoning) {
      console.error('Missing required fields. Parsed object:', parsed);
      throw new Error('Missing required fields in response');
    }

    return {
      subject: parsed.subject,
      body: parsed.body,
      reasoning: parsed.reasoning,
      keyInsights: parsed.keyInsights || [],
    };
  } catch (error) {
    console.error('Failed to parse agent response. Error:', error);
    console.error('Full response:', response);

    // If JSON parsing failed but we have a response, provide more context
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON from agent response: ${error.message}`);
    }
    throw new Error('Failed to parse email from agent response');
  }
}
