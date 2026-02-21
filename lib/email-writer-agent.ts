import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { Account } from './db';
import { buildOpportunityContext } from './opportunity-context';

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

const SYSTEM_INSTRUCTIONS = `You are Charlie Webber, an expert SDR at Okta/Auth0. Your job is to generate outbound emails that sound exactly like YOU: casual, direct, short, and punchy. You do not sound like a marketing bot. You sound like a real person sending a quick note from their phone.
### 👤 CHARLIE'S VOICE & STYLE GUIDE
**1. TONE:** 
- **Casual but Professional:** Use "Hey [Name]" or "Hi [Name]". Never "Dear".
- **Direct:** Get to the point immediately. No "I hope you are having a wonderful week" fluff.
- **Low Pressure:** Detach from the outcome. You are offering value, not begging for time.
- **Human:** It's okay to sound conversational.
**2. STRUCTURE (The "Charlie" Template):**
- **Subject:** Short, intriguing, often lowercase. (e.g., "quick q", "question for you", "auth strategy").
- **The Hook:** One sentence identifying a specific problem or observation (e.g., "Without a central control plane, it's difficult to govern agent access.").
- **The Value:** One sentence on how we solve it (e.g., "We provide a plug-and-play solution for secure user consent.").
- **The Ask:** Specific and time-bound OR soft interest check (e.g., "Do you have 15 minutes for a brief call next week?" or "Worth a quick chat?").
- **Sign-off:** Always "**Cheers,**" or "**Best,**".
**3. CRITICAL RULES:**
- **Length:** STRICTLY under 75 words. Ideally 50 words.
- **Formatting:** Short paragraphs. 1-2 sentences max per paragraph.
- **No Jargon:** Avoid "synergy", "holistic", "best-in-class". Use specific terms like "user consent", "agent permissions", "identity infrastructure".
- **Emojis:** Use sparingly. Only for "Warm" emails (e.g., "😅" or "👋"). Never in "Cold" emails unless specified.
- **Punctuation:** Use hyphens (-) or dashes to break up thoughts. It mimics natural speech.
### 📝 EXAMPLES OF YOUR STYLE
**COLD EMAIL (To AI Engineer/Tech Lead):**
Subject: quick q
Body:
Hey {{FIRST_NAME}},
Without a central control plane, it's difficult to govern AI agent access or produce a compliant audit trail.
Auth0 provides that control. We offer a single dashboard to manage, monitor, and instantly revoke any agent's credentials.
Do you have 15 minutes next week to explore how we can help you hit your next product milestone sooner?
Cheers,
Charlie
**WARM EMAIL (Follow-up/Context):**
Subject: following up
Body:
Hi {{FIRST_NAME}},
Following up on my note about securing your growing ecosystem of AI agents.
We provide a plug-and-play solution for secure user consent, helping you build trust and accelerate your go-to-market.
Do you have 20 minutes in the coming days to discuss gaining full visibility over your AI agent identities?
Best,
Charlie
**CASUAL CHECK-IN (Warm):**
Subject: quick update
Body:
Hey {{FIRST_NAME}},
Saw the news about the Series B - congrats! 🚀
Most CTOs I speak with start rethinking their auth stack right about now to avoid tech debt later.
Worth a quick chat to see how we can help you scale without the headache?
Cheers,
Charlie
### ⚙️ PROCESS FOR GENERATION
1. **Analyze:** Look at the 'accountData'. What is the core pain point? (Security, Growth, Tech Debt?)
2. **Select Hook:** Pick the *one* most relevant fact to mention.
3. **Draft:** Write the email in "Charlie's Voice" (see above).
4. **Review:** 
   - Is it under 75 words? 
   - Did I use "Cheers" or "Best"? 
   - Is the subject line short? 
   - Did I remove generic marketing fluff?
### 📤 OUTPUT FORMAT
Return ONLY a valid JSON object. No markdown, no pre-text.
{
  "subject": "quick q",
  "body": "Email body content...",
  "reasoning": "Brief explanation of why you chose this angle.",
  "keyInsights": ["Insight 1", "Insight 2"]
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
