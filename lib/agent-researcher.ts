import { Agent, run, webSearchTool, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';

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
- Be thorough and professional; if information is not publicly available, state that clearly

Format all responses in markdown with bold text, bullet points, and links to sources.`;

// ─── Research Section Definitions ────────────────────────────────────────────

export const AUTH0_RESEARCH_SECTIONS: Record<string, {
  label: string;
  dbColumn: string;
  buildPrompt: (companyIdentifier: string, companyName: string, industry: string, extraContext?: string) => string;
}> = {
  current_auth_solution: {
    label: 'Current Auth Solution',
    dbColumn: 'current_auth_solution',
    buildPrompt: (companyIdentifier, _companyName, _industry, extraContext) => {
      let prompt = `Research ${companyIdentifier} and identify their current authentication and identity management solution. Look for:
- What authentication providers or platforms they use (Auth0, Okta, Firebase, custom, etc.)
- How they handle user authentication (SSO, MFA, social login)
- Any public information about their identity infrastructure
- Tech stack mentions that indicate their auth approach

**Return your findings in MARKDOWN format with:**
- Use **bold** for important terms and platform names
- Use bullet points for multiple findings
- Include [links](url) to sources when available
- Organize with clear sections if helpful

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

**Return your findings in MARKDOWN format with:**
- Use **bold** for key numbers and metrics
- Use bullet points to organize different aspects
- Include [links](url) to sources when available

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

**Return your findings in MARKDOWN format with:**
- Use **bold** for dates, certifications, and compliance standards
- Use bullet points for incidents and requirements
- Include [links](url) to news sources and reports
- Highlight ANZ-relevant compliance and security considerations

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

**Return your findings in MARKDOWN format with:**
- Use **bold** for funding amounts, dates, and key announcements
- Use bullet points to organize different news items
- Include [links](url) to news sources
- Highlight ANZ-specific news and regional relevance

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

**Return your findings in MARKDOWN format with:**
- Use **bold** for technology names and platforms
- Use bullet points for different initiatives
- Include [links](url) to blog posts and announcements

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

export async function researchCompany(company: CompanyInfo, model?: string): Promise<ResearchResult> {
  const agentModel = model || 'gpt-5.2';
  const agent = new Agent({
    model: agentModel,
    name: 'Auth0 SDR Researcher - ANZ',
    instructions: AUTH0_AGENT_INSTRUCTIONS,
    tools: [webSearchTool()],
  });

  try {
    const companyIdentifier = company.domain ? `${company.company_name} (${company.domain})` : company.company_name;

    // Research using section definitions
    const authResult = await run(agent, AUTH0_RESEARCH_SECTIONS.current_auth_solution.buildPrompt(companyIdentifier, company.company_name, company.industry));
    const customerResult = await run(agent, AUTH0_RESEARCH_SECTIONS.customer_base_info.buildPrompt(companyIdentifier, company.company_name, company.industry));
    const securityResult = await run(agent, AUTH0_RESEARCH_SECTIONS.security_incidents.buildPrompt(companyIdentifier, company.company_name, company.industry));
    const newsResult = await run(agent, AUTH0_RESEARCH_SECTIONS.news_and_funding.buildPrompt(companyIdentifier, company.company_name, company.industry));
    const techResult = await run(agent, AUTH0_RESEARCH_SECTIONS.tech_transformation.buildPrompt(companyIdentifier, company.company_name, company.industry));
    const prospectsResult = await run(agent, AUTH0_RESEARCH_SECTIONS.prospects.buildPrompt(companyIdentifier, company.company_name, company.industry));

    // Generate summary
    const summaryPrompt = `Based on all the research about ${company.company_name}, create a concise 2-3 paragraph executive summary for an Auth0 SDR in the ANZ market.

**Focus on:**
1. Why they might need Auth0 CIAM (current solution gaps, scale challenges, security/compliance needs)
2. ANZ-specific opportunities (regional compliance, data sovereignty, local growth)
3. Key timing indicators (funding, growth, transformation initiatives)
4. Primary decision-makers to target (prioritize ANZ-based contacts)

**Consider ANZ context:**
- Regional compliance requirements (Australian Privacy Act, NZ Privacy Act)
- ANZ market presence and expansion plans
- Local customer base and growth trajectory
- Time zone and regional business practices

**Return in MARKDOWN format with:**
- Use **bold** for key insights and pain points
- Use bullet points for action items
- Make it actionable and sales-focused for ANZ market
- Include specific Auth0 CIAM value propositions for this account

Provide a compelling, well-formatted summary from an Auth0 ANZ SDR perspective.`;

    const summaryResult = await run(agent, summaryPrompt);

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
      current_auth_solution: authResult.finalOutput || 'No information found',
      customer_base_info: customerResult.finalOutput || 'No information found',
      security_incidents: securityResult.finalOutput || 'No information found',
      news_and_funding: newsResult.finalOutput || 'No information found',
      tech_transformation: techResult.finalOutput || 'No information found',
      prospects: JSON.stringify(prospectsList),
      research_summary: summaryResult.finalOutput || 'No summary available',
    };
  } catch (error) {
    console.error(`Research error for ${company.company_name}:`, error);
    throw error;
  }
}
