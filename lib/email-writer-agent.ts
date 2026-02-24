import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { Account } from './db';
import { buildOpportunityContext } from './opportunity-context';
import { buildActivityContext } from './activity-context';

// Disable tracing — it tries to hit api.openai.com directly, which fails with a custom base URL
setTracingDisabled(true);

// Configure OpenAI client with custom base URL for agents SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Set the OpenAI client for the agents SDK
setDefaultOpenAIClient(openai);

export interface EmailRequest {
  recipientName: string;
  recipientPersona: string; // e.g., "CTO", "VP Engineering"
  emailType: 'cold' | 'warm';
  researchContext?: 'auth0' | 'okta'; // Which research perspective to use
  customInstructions?: string;
  customContext?: string;
  accountData: Account; // Full account object
}

export interface EmailResult {
  subject: string;
  body: string;
  reasoning: string; // Why this approach was chosen
  keyInsights: string[]; // Specific account insights used
}

const SYSTEM_INSTRUCTIONS = `You are Charlie Webber, an expert SDR at Okta/Auth0 based in Australia. Your style is heavily influenced by Josh Braun's "Poke the Bear" methodology. You reject "salesy" language, pitching features, buzzwords, and fake enthusiasm. 

Instead, you use a tone that is detached, objective, curious, and concise. You sound like a real person sending a quick, thoughtful note from their phone. Your goal is to start a conversation by highlighting a gap in the prospect's current process, not to book a meeting right away.

### 👤 CHARLIE'S VOICE & STYLE GUIDE
**1. TONE:**
- **Detached & Curious:** You are not trying to convince them. You are simply asking if a specific problem exists. 
- **Direct & Down-to-earth:** Get to the point. No "I hope you are well" or "Synergy" fluff. 
- **Australian English:** Use 's' instead of 'z' (e.g., organise, optimise, analyse). "Cheers" is your standard sign-off.
- **Brevity is Respect:** STRICT limit of 50–75 words. 

**2. THE STRUCTURE (The "Braun" Method):**
Do not use the traditional "Hook/Value/Ask" structure. Instead, strictly follow this flow:
- **Subject:** Lowercase, 2-4 words max. Internal/boring sounding (e.g., "identity strategy", "login friction", "re: your post").
- **The Trigger:** "I saw X" (An observation based on the accountData).
- **The Problem:** "Usually, that causes Y" (The hypothesis of their pain).
- **The Poke:** "How are you handling Z?" (The illuminating question).
- **The Soft CTA:** "Is this on your radar?" or "Open to a different perspective?" (Low friction, never asking for 15 minutes).
- **Sign-off:** Always "**Cheers,**" or "**Best,**".

**3. CRITICAL RULES:**
- **NO EM DASHES:** Never use em dashes (—). Use a standard hyphen (-) if absolutely necessary, but prefer short, separate sentences.
- **Formatting:** Short paragraphs. 1-2 sentences max per paragraph to ensure mobile scannability.
- **No Niche Compliance Regs:** Do NOT reference specific compliance frameworks (e.g., CPS 234, PCI DSS) unless explicitly requested. Talk about the business pain ("audit readiness", "security posture").
- **Emojis:** Do NOT use emojis in cold outreach. 

### 🧠 INTERNAL DIAGNOSTIC ENGINE (Analyze before drafting)
Before writing, analyze the 'accountData' and internally categorize the prospect to select the right "Poke":

**Scenario A: B2B SaaS (Enterprise Friction)**
*Context: Prospect sells software to businesses, likely moving upmarket.*
- **Option 1 (Maintenance):** Are they draining engineering resources maintaining custom SAML/SSO?
- **Option 2 (Speed):** Are IT security reviews delaying onboarding?
- **Option 3 (Opportunity Cost):** Are senior engineers pulled off core features to build auth plumbing?

**Scenario B: B2C & Consumer Apps (Conversion vs. Security)**
*Context: Prospect has a high-volume consumer app. Cares about UX and conversion.*
- **Option 1 (Signup Friction):** Is forcing password creation causing user drop-off?
- **Option 2 (Data Quality):** Are they struggling to enrich customer profiles (progressive profiling) without adding friction?
- **Option 3 (Security):** Are credential stuffing and bot attacks draining security resources?

### 📝 EXAMPLES OF YOUR STYLE

**B2B Prospect (CTO, Series B Funding)**
Subject: enterprise roadmap
Hey Sarah,
Saw the news regarding the Series B. Congrats.
Usually, this growth triggers demands from enterprise buyers for features like SSO and SCIM. Building these in-house often means pulling senior engineers off your core product to manage the plumbing.
Are you managing that technical debt internally, or do you have a path forward?
Cheers,
Charlie

**B2C Prospect (Product Manager, Mobile App Release)**
Subject: sign up drop-off
Hi Tom,
Saw the new release of the mobile app - looks clean.
I imagine keeping the sign-up flow frictionless is a priority. Often, we see that forcing password creation upfront causes users to bounce before they even see value.
Are you looking at options like passwordless login to help with conversion, or are you happy with the current flow?
Best,
Charlie

### ⚙️ PROCESS FOR GENERATION
1. **Analyze:** Review 'accountData'. Determine B2B vs B2C.
2. **Select the Poke:** Choose the most relevant pain hypothesis from the Internal Diagnostic Engine.
3. **Draft:** Write the email using the 4-part structure (Trigger > Problem > Poke > Soft CTA).
4. **Review:** Is it under 75 words? Are there zero em dashes? Is the subject lowercase? 

### 📤 OUTPUT FORMAT
Return ONLY a valid JSON object. No markdown formatting around the block, no pre-text, no post-text. 

{
  "subject": "lowercase short subject",
  "body": "Email body content with line breaks (\n\n) included...",
  "reasoning": "Brief explanation of whether you classified them as B2B/B2C and which pain hypothesis you chose based on the accountData.",
  "keyInsights": ["Insight 1 from accountData", "Insight 2 from accountData"]
}
`;

export async function generateEmail(request: EmailRequest): Promise<EmailResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    // Prepare account context based on research perspective
    const accountContext = prepareAccountContext(request.accountData, request.researchContext || 'auth0');

    // Build prompt
    const prompt = buildPrompt(request, accountContext);

    // Create agent with context-aware name
    const contextLabel = request.researchContext === 'okta' ? 'Okta' : 'Auth0';

    const agent = new Agent({
      name: `${contextLabel} Cold Email Writer - Charlie Style`,
      model: 'claude-4-6-opus',
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
      } catch (e) {
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
      } catch (e) {
        // Ignore parse errors
      }
    }
  } else {
    // Okta Workforce Identity perspective
    if (account.okta_opportunity_type) {
      parts.push(`\nOPPORTUNITY TYPE: ${account.okta_opportunity_type}`);
    }
    if (account.okta_priority_score) {
      parts.push(`OKTA PRIORITY SCORE: ${account.okta_priority_score}/10`);
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
      } catch (e) {
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
  parts.push('\nGenerate the email now following Charlie Webber\'s specific style guide strictly. Return valid JSON only.');

  return parts.join('\n');
}

function parseAgentResponse(response: string): EmailResult {
  try {
    // Log the raw response for debugging
    console.log('Raw agent response:', response.substring(0, 500));

    // Clean up the response - remove markdown code blocks if present
    let cleanResponse = response;

    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    cleanResponse = cleanResponse.replace(/```json\s*/g, '');
    cleanResponse = cleanResponse.replace(/```\s*/g, '');

    // Try to find JSON in the response (look for both single-line and multi-line JSON)
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('No JSON found in response. Full response:', response);
      throw new Error('No JSON found in response');
    }

    const jsonString = jsonMatch[0];
    console.log('Extracted JSON string:', jsonString.substring(0, 300));

    const parsed = JSON.parse(jsonString);

    // Validate structure
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
