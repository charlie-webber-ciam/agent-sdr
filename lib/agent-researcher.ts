import { Agent, run, webSearchTool, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import {
  AUTH0_COMMAND_OF_MESSAGE_OUTPUT_GUIDANCE,
  AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE,
} from './auth0-value-framework';
import { logDetailedError } from './error-logger';

// Disable tracing — it tries to hit api.openai.com directly, which fails with a custom base URL
setTracingDisabled(true);

// Configure OpenAI client with custom base URL for agents SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Set the OpenAI client for the agents SDK
setDefaultOpenAIClient(openai);


export interface ResearchResult {
  command_of_message: string;
  current_auth_solution: string;
  customer_base_info: string;
  security_incidents: string;
  news_and_funding: string;
  tech_transformation: string;
  prospects: string; // JSON string
  research_summary: string;
}

export interface CompanyInfo {
  company_name: string;
  domain: string | null;
  industry: string;
}

// ─── Auth0 Agent Instructions ────────────────────────────────────────────────

const AUTH0_AGENT_INSTRUCTIONS = `You are an expert SDR (Sales Development Representative) researcher working for Auth0 in the Australia/New Zealand region. Your role is to build comprehensive account profiles for CIAM (Customer Identity and Access Management) opportunities.

**Your Perspective:**
- You work for Auth0, a leading CIAM platform
- You're focused on the ANZ (Australia/New Zealand) market
- You're building detailed account intelligence for SDR outreach and sales strategy
- You understand regional compliance requirements (Australian Privacy Act, NZ Privacy Act)
- You're aware of ANZ tech ecosystem, funding landscape, and business culture

**Research Focus Areas:**
1. Current authentication and identity management solutions
2. Customer base size, scale, and B2C/B2B model
3. Security incidents, breaches, and compliance requirements (especially ANZ-relevant)
4. Recent company news, funding rounds, annual reports, and tech transformation initiatives
5. Key decision-makers in security, identity, engineering, and product roles

**Research Guidelines:**
- Prioritize ANZ-specific information (local operations, regional leadership, compliance)
- Consider time zone context (AEDT/AEST/NZST)
- Note if company has ANZ headquarters or significant regional presence
- Identify regional pain points that Auth0 CIAM could address
- Always provide factual, detailed findings with specific data points and sources
- Run focused web research for each section. Prefer official company, investor, trust, help, documentation, engineering, and careers pages before secondary sources.
- Preserve clickable markdown links to the strongest sources. Do not strip URLs out of the answer.
- Distinguish observed fact from inference. If you are inferring, say so directly.
- Include dates or timing windows whenever they are available and material.
- Be thorough and professional; if information is not publicly available, state that clearly

**Auth0 Value Framework Messaging Lens:**
${AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE}

Format all responses in markdown with bold text, bullet points, and links to sources.`;

// ─── Research Section Definitions ────────────────────────────────────────────

export const AUTH0_RESEARCH_SECTIONS: Record<string, {
  label: string;
  dbColumn: string;
  buildPrompt: (companyIdentifier: string, companyName: string, industry: string, extraContext?: string) => string;
}> = {
  command_of_message: {
    label: 'Command of the Message: Auth0 Value Framework',
    dbColumn: 'command_of_message',
    buildPrompt: (companyIdentifier, companyName, industry, extraContext) => {
      let prompt = `Research ${companyIdentifier} and build a seller-ready **Command of the Message: Auth0 Value Framework** section for Auth0 CIAM outreach.

Search plan:
- Search the official site for product pages, signup/login flows, trust/security pages, investor or annual-report content, and help/docs pages.
- Search recent press releases, interviews, annual reports, and reputable news from the last 12-18 months.
- Search engineering, developer, careers, and documentation pages for platform, identity, developer-velocity, and modernisation clues.
- Use reputable secondary sources only to fill gaps or validate what first-party sources suggest.

Focus on:
- The most likely company objectives and priorities visible in public signals
- What those objectives imply about identity, customer experience, security, scale, or developer velocity
- Which Auth0 value drivers, differentiators, capabilities, and proof points fit best
- Messaging angles an SDR can use immediately

Company context:
- Company name: ${companyName}
- Industry: ${industry}

${AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE}

Rules:
- Run enough targeted searches to support each major claim with evidence.
- Tie recommendations to public evidence. Do not invent internal priorities or metrics.
- Prefer business outcomes and execution pressure over generic Auth0 copy.
- If evidence is thin, say that clearly and lower confidence in the wording.
- Keep the messaging practical for SDR outreach and early discovery.
- Preserve clickable markdown links inline where they sharpen the point.
- In Core Messaging Pieces, explicitly follow: observed signal -> likely problem -> business impact -> Auth0 angle.
- In Source Links, favour first-party sources when available.

${AUTH0_COMMAND_OF_MESSAGE_OUTPUT_GUIDANCE}`;
      if (extraContext) prompt += `\n\n**Additional context from user:** ${extraContext}`;
      return prompt;
    },
  },
  current_auth_solution: {
    label: 'Current Auth Solution',
    dbColumn: 'current_auth_solution',
    buildPrompt: (companyIdentifier, _companyName, _industry, extraContext) => {
      let prompt = `Research ${companyIdentifier} and identify their current authentication and identity management solution. Look for:
- What authentication providers or platforms they use (Auth0, Okta, Firebase, custom, etc.)
- How they handle user authentication (SSO, MFA, social login)
- Any public information about their identity infrastructure
- Tech stack mentions that indicate their auth approach

Search plan:
- Search the public login, signup, support, documentation, status, or help surfaces.
- Search engineering blogs, API docs, release notes, mobile app listings, and careers pages for auth stack clues.
- Search third-party tech-detection or partner references only if first-party evidence is thin.

Return your findings in MARKDOWN using these exact headings:
## Likely Current Approach
## Evidence
## Gaps / Unknowns
## Identity Implications

Rules:
- Put the strongest observed conclusion in Likely Current Approach, and clearly mark any inference.
- In Evidence, use bullets and end each substantive bullet with a clickable markdown link.
- In Gaps / Unknowns, say exactly what could not be verified.
- In Identity Implications, connect the evidence to what it likely means for identity complexity or pain.
- Use **bold** for important platform names, standards, or login patterns.

Provide detailed, well-formatted findings.`;
      if (extraContext) prompt += `\n\n**Additional context from user:** ${extraContext}`;
      return prompt;
    },
  },
  customer_base_info: {
    label: 'Customer Base',
    dbColumn: 'customer_base_info',
    buildPrompt: (_companyIdentifier, companyName, _industry, extraContext) => {
      let prompt = `Research ${companyName}'s customer base and scale:
- Approximate number of users/customers they serve
- B2C vs B2B model
- Growth indicators and user base trends
- Geographic reach
- Any public metrics about their user scale

Search plan:
- Search the official site, investor materials, annual reports, press releases, and app-store profiles for user or customer metrics.
- Search product, pricing, customer, or case-study pages for who they serve and how they monetise.
- Search recent news or interviews for growth signals, regional expansion, or customer-scale commentary.

Return your findings in MARKDOWN using these exact headings:
## Customer / User Scale
## Business Model / Customer Motion
## Growth / Geography Signals
## Identity Implications

Rules:
- Use **bold** for key numbers, percentages, revenue clues, and scale metrics.
- End each substantive bullet with a clickable markdown link.
- If scale is unclear, provide a bounded hypothesis and label it as inference.
- In Identity Implications, explain what their scale or motion suggests about signup, login, or customer identity complexity.

Provide specific, well-formatted findings with data.`;
      if (extraContext) prompt += `\n\n**Additional context from user:** ${extraContext}`;
      return prompt;
    },
  },
  security_incidents: {
    label: 'Security & Compliance',
    dbColumn: 'security_incidents',
    buildPrompt: (_companyIdentifier, companyName, _industry, extraContext) => {
      let prompt = `Search for security incidents, data breaches, and compliance information for ${companyName}:
- Any reported security incidents or breaches (especially affecting ANZ customers)
- Compliance requirements (Australian Privacy Act, NZ Privacy Act, GDPR, SOC2, HIPAA, etc.)
- Security certifications
- Public statements about security priorities
- Recent security-related news
- ANZ-specific data sovereignty or regulatory requirements

Search plan:
- Search trust centres, security pages, privacy policies, annual reports, and compliance pages on the official site.
- Search recent news, regulatory notices, and reputable coverage for incidents or security pressure.
- Search region-specific privacy or sovereignty references that affect ANZ operations.

Return your findings in MARKDOWN using these exact headings:
## Security / Compliance Signals
## Incidents / Risk Events
## Current Pressure
## Identity Implications

Rules:
- Use **bold** for dates, standards, certifications, incidents, and regulatory references.
- End each substantive bullet with a clickable markdown link.
- Keep incidents chronological when possible.
- If no public incidents are found, say that clearly instead of implying one.
- In Identity Implications, explain what the security or compliance pressure likely means for customer identity, fraud, or access controls.

Provide detailed, chronological findings from an Auth0 ANZ SDR perspective.`;
      if (extraContext) prompt += `\n\n**Additional context from user:** ${extraContext}`;
      return prompt;
    },
  },
  news_and_funding: {
    label: 'News & Funding',
    dbColumn: 'news_and_funding',
    buildPrompt: (_companyIdentifier, companyName, _industry, extraContext) => {
      let prompt = `Find recent news and funding information for ${companyName}:
- Recent funding rounds (amounts, investors, dates) - prioritize ANZ market activity
- Annual reports or financial highlights
- ANZ expansion plans or regional growth initiatives
- Tech transformation initiatives
- Product launches or major announcements (especially ANZ-relevant)
- Strategic partnerships
Focus on news from the last 12-18 months, with emphasis on ANZ market presence.

Search plan:
- Search press releases, investor pages, annual reports, and newsroom content on the official site first.
- Search reputable business/news coverage for funding, acquisitions, launches, and regional expansion.
- Search for ANZ-specific partnerships, hiring, product rollout, or transformation announcements.

Return your findings in MARKDOWN using these exact headings:
## Timeline
## Strategic Moves
## Why It Matters Now
## Source Links

Rules:
- Use **bold** for funding amounts, dates, product launches, and partnership names.
- In Timeline, keep items in reverse chronological order and end each bullet with a clickable markdown link.
- In Strategic Moves, explain the most commercially relevant moves, not every minor announcement.
- In Why It Matters Now, connect the timeline to possible identity urgency, customer experience change, or platform pressure.
- In Source Links, list the strongest 2-5 markdown links used in the section.

Provide chronological, well-formatted news with sources from an Auth0 ANZ SDR perspective.`;
      if (extraContext) prompt += `\n\n**Additional context from user:** ${extraContext}`;
      return prompt;
    },
  },
  tech_transformation: {
    label: 'Tech Transformation',
    dbColumn: 'tech_transformation',
    buildPrompt: (_companyIdentifier, companyName, _industry, extraContext) => {
      let prompt = `Research ${companyName}'s technology transformation and modernization efforts:
- Cloud migration initiatives
- Digital transformation projects
- Platform modernization
- Customer experience improvements
- Engineering culture and tech blog insights
- Developer-facing products or APIs

Search plan:
- Search engineering blogs, developer docs, release notes, API or platform pages, and careers pages for architecture clues.
- Search official press releases or annual reports for transformation, cloud, platform, or digital program references.
- Search reputable coverage for modernisation initiatives if first-party sources are sparse.

Return your findings in MARKDOWN using these exact headings:
## Modernisation Signals
## Platform / Architecture Clues
## Customer Experience / Developer Motion
## Identity Implications

Rules:
- Use **bold** for technology names, clouds, developer platforms, and initiatives.
- End each substantive bullet with a clickable markdown link.
- Prefer concrete examples over vague claims about transformation.
- In Identity Implications, explain what these initiatives likely mean for login, customer identity, extensibility, or developer velocity.

Provide specific, well-formatted examples.`;
      if (extraContext) prompt += `\n\n**Additional context from user:** ${extraContext}`;
      return prompt;
    },
  },
  prospects: {
    label: 'Prospects',
    dbColumn: 'prospects',
    buildPrompt: (_companyIdentifier, companyName, industry, extraContext) => {
      let prompt = `Find key decision-makers at ${companyName} for Auth0 CIAM sales outreach in the ANZ market.

**CRITICAL REQUIREMENT: You MUST provide EXACTLY 5 entries.**

Search plan:
- Search leadership, management, careers, newsroom, and team pages on the official site.
- Search public bios, conference pages, and reputable business profiles for current titles.
- Prioritise people with explicit ANZ, APAC, Australia, or New Zealand scope when available.

**Prioritize ANZ-based decision makers** (Australia/New Zealand offices). If you cannot find 5 specific named individuals, fill remaining slots with IDEAL PERSONAS based on the company's industry, size, and ANZ presence.

**For real people found (search these roles, prioritize ANZ-based):**
- VP/Director of Engineering (ANZ or APAC)
- Chief Security Officer (CSO/CISO) - ANZ region
- VP/Director of Product (ANZ or APAC)
- Chief Technology Officer (CTO) - ANZ region
- Head of Identity/Authentication (ANZ or APAC)
- General Manager/Managing Director (Australia/New Zealand)

**For personas (when real names unavailable):**
- Create realistic role-based personas relevant to ANZ market
- Format name as: "Persona: [Role Title]"
- Example: {"name": "Persona: VP of Engineering (ANZ)", "title": "VP Engineering ANZ", "background": "Typical persona for ${industry} in ANZ: Leads regional engineering team, manages local compliance requirements (AU Privacy Act), reports to APAC/Global CTO"}

**Return as JSON array with EXACTLY 5 entries:**
[{"name": "...", "title": "...", "background": "..."}]

Mix real people and personas as needed to reach exactly 5 entries. For real individuals, note if they are ANZ-based or global. Only include publicly available information.`;
      if (extraContext) prompt += `\n\n**Additional context from user:** ${extraContext}`;
      return prompt;
    },
  },
};

/**
 * Research a single section for a company.
 */
export async function researchSection(
  company: CompanyInfo,
  sectionKey: string,
  additionalContext?: string,
  model?: string
): Promise<string> {
  const section = AUTH0_RESEARCH_SECTIONS[sectionKey];
  if (!section) {
    throw new Error(`Unknown Auth0 section key: ${sectionKey}`);
  }

  const agentModel = model || 'gpt-5.2';
  const agent = new Agent({
    model: agentModel,
    name: 'Auth0 SDR Researcher - ANZ',
    instructions: AUTH0_AGENT_INSTRUCTIONS,
    tools: [webSearchTool()],
  });

  const companyIdentifier = company.domain ? `${company.company_name} (${company.domain})` : company.company_name;
  const prompt = section.buildPrompt(companyIdentifier, company.company_name, company.industry, additionalContext);
  const result = await run(agent, prompt);
  return result.finalOutput || 'No information found';
}

export async function researchCompany(company: CompanyInfo, model?: string, opportunityContext?: string, onStep?: (step: string, stepIndex: number, totalSteps: number) => void): Promise<ResearchResult> {
  const agentModel = model || 'gpt-5.2';
  let instructions = AUTH0_AGENT_INSTRUCTIONS;
  if (opportunityContext) {
    instructions += `\n\n**HISTORICAL OPPORTUNITY CONTEXT:**\n${opportunityContext}\n\nUse this context to inform your research. Do not repeat this information verbatim — use it to guide your research focus and identify patterns.`;
  }
  const agent = new Agent({
    model: agentModel,
    name: 'Auth0 SDR Researcher - ANZ',
    instructions,
    tools: [webSearchTool()],
  });

  try {
    const companyIdentifier = company.domain ? `${company.company_name} (${company.domain})` : company.company_name;
    const TOTAL_STEPS = 8;
    const fallbackOutput: string | undefined = 'Research agent failed — no data available for this section.';

    // Helper to run a section with error handling so one failure doesn't crash all research
    const runSection = async (sectionKey: string, stepLabel: string, stepNum: number) => {
      onStep?.(stepLabel, stepNum, TOTAL_STEPS);
      try {
        const result = await run(agent, AUTH0_RESEARCH_SECTIONS[sectionKey].buildPrompt(companyIdentifier, company.company_name, company.industry));
        return result;
      } catch (err) {
        console.error(`[Auth0 SDR] ${stepLabel} agent failed for ${company.company_name}:`, err);
        return { finalOutput: fallbackOutput };
      }
    };

    // Research using section definitions
    const authResult = await runSection('current_auth_solution', 'Current Auth Solution', 1);
    const customerResult = await runSection('customer_base_info', 'Customer Base', 2);
    const securityResult = await runSection('security_incidents', 'Security & Compliance', 3);
    const newsResult = await runSection('news_and_funding', 'News & Funding', 4);
    const techResult = await runSection('tech_transformation', 'Tech Transformation', 5);
    const prospectsResult = await runSection('prospects', 'Prospects', 6);

    const synthesisInput = [
      `Company: ${company.company_name}`,
      `Industry: ${company.industry}`,
      '',
      '## Current Auth Solution',
      authResult.finalOutput || fallbackOutput,
      '',
      '## Customer Base',
      customerResult.finalOutput || fallbackOutput,
      '',
      '## Security & Compliance',
      securityResult.finalOutput || fallbackOutput,
      '',
      '## News & Funding',
      newsResult.finalOutput || fallbackOutput,
      '',
      '## Tech Transformation',
      techResult.finalOutput || fallbackOutput,
      '',
      '## Prospects',
      prospectsResult.finalOutput || fallbackOutput,
    ].join('\n');

    const commandPrompt = `You already have the research findings below for ${company.company_name}. Synthesize them into a seller-ready **Command of the Message: Auth0 Value Framework** section for an Auth0 SDR in the ANZ market.

${AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE}

Rules:
- Use only the findings below. Do not introduce fresh claims unless you can clearly infer them from the provided research.
- Tie the company's likely objectives to the best-fit Auth0 value drivers.
- Make the messaging immediately usable in outreach.
- Keep proof points and differentiators tightly relevant.

${AUTH0_COMMAND_OF_MESSAGE_OUTPUT_GUIDANCE}

## Research Findings
${synthesisInput}`;

    onStep?.('Command of the Message', 7, TOTAL_STEPS);
    let commandResult: { finalOutput: string | undefined } = { finalOutput: fallbackOutput };
    try {
      commandResult = await run(agent, commandPrompt);
    } catch (err) {
      console.error(`[Auth0 SDR] Command of the Message agent failed for ${company.company_name}:`, err);
    }

    // Generate summary
    const summaryPrompt = `Based on the research findings below, create a concise executive summary for an Auth0 SDR in the ANZ market.

Focus on:
1. Why they might need Auth0 CIAM now, based on current solution gaps, scale challenges, customer experience pressure, or security/compliance needs.
2. ANZ-specific opportunities such as regional compliance, data sovereignty, or local growth.
3. Key timing indicators such as funding, launches, transformation work, or organisational change.
4. Primary decision-makers to target, prioritising ANZ-based contacts where possible.
5. The highest-conviction narrative from the Command of the Message section without repeating it verbatim.

Return in MARKDOWN using these exact headings:
## What Matters Now
## Why Auth0 Has a POV Here
## Who To Target
## Source Links

Rules:
- Use **bold** for key insights, pain points, dates, or metrics.
- Keep the summary practical and sales-useful, not generic.
- In Source Links, list the strongest 2-4 clickable markdown links already reflected in the research.
- If evidence is thin, lower confidence instead of overstating certainty.

Provide a compelling, well-formatted summary from an Auth0 ANZ SDR perspective.

## Research Findings
${synthesisInput}

## Command of the Message
${commandResult.finalOutput || fallbackOutput}`;

    onStep?.('Executive Summary', 8, TOTAL_STEPS);
    let summaryResult: { finalOutput: string | undefined } = { finalOutput: fallbackOutput };
    try {
      summaryResult = await run(agent, summaryPrompt);
    } catch (err) {
      console.error(`[Auth0 SDR] Summary agent failed for ${company.company_name}:`, err);
    }

    // Parse and validate prospects to ensure minimum 5 entries
    let prospectsList = [];
    try {
      prospectsList = JSON.parse(prospectsResult.finalOutput || '[]');
    } catch (e) {
      console.error('Failed to parse prospects JSON:', e);
      prospectsList = [];
    }

    // Ensure exactly 5 entries - add personas if needed
    const defaultPersonas = [
      {
        name: "Persona: VP of Engineering (ANZ)",
        title: "VP Engineering ANZ",
        background: `Typical persona for ${company.industry} in ANZ region: Leads regional engineering team, manages local compliance (Australian Privacy Act), makes technical platform decisions for ANZ operations`
      },
      {
        name: "Persona: Chief Security Officer (ANZ)",
        title: "CISO ANZ",
        background: `Typical persona for ${company.industry} in ANZ region: Owns regional security strategy, manages ANZ compliance and data sovereignty requirements, oversees risk management`
      },
      {
        name: "Persona: VP of Product (APAC)",
        title: "VP Product APAC",
        background: `Typical persona for ${company.industry} in APAC region: Owns regional product roadmap, manages ANZ customer experience, adapts global products for local market`
      },
      {
        name: "Persona: CTO/GM Technology (ANZ)",
        title: "CTO ANZ",
        background: `Typical persona for ${company.industry} in ANZ region: Sets regional technical vision, manages architecture strategy, owns technology decisions for Australia/New Zealand operations`
      },
      {
        name: "Persona: Director of Identity & Access (ANZ)",
        title: "Director IAM ANZ",
        background: `Typical persona for ${company.industry} in ANZ region: Manages authentication and authorization systems, ensures compliance with local privacy regulations, oversees user identity management`
      },
    ];

    // Fill up to 5 entries
    while (prospectsList.length < 5) {
      prospectsList.push(defaultPersonas[prospectsList.length]);
    }

    // Limit to exactly 5
    prospectsList = prospectsList.slice(0, 5);

    return {
      command_of_message: commandResult.finalOutput || 'No command of message available',
      current_auth_solution: authResult.finalOutput || 'No information found',
      customer_base_info: customerResult.finalOutput || 'No information found',
      security_incidents: securityResult.finalOutput || 'No information found',
      news_and_funding: newsResult.finalOutput || 'No information found',
      tech_transformation: techResult.finalOutput || 'No information found',
      prospects: JSON.stringify(prospectsList),
      research_summary: summaryResult.finalOutput || 'No summary available',
    };
  } catch (error) {
    logDetailedError(`[Auth0 Agent] Research error for ${company.company_name} (domain: ${company.domain || 'none'}, industry: ${company.industry})`, error);
    throw error;
  }
}
