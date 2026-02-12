import { Agent, run, webSearchTool, setDefaultOpenAIClient } from '@openai/agents';
import OpenAI from 'openai';
import { z } from 'zod';

// Configure OpenAI client with custom base URL for agents SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Set the OpenAI client for the agents SDK
setDefaultOpenAIClient(openai);

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface ResearchResult {
  current_iam_solution: string;
  workforce_info: string;
  security_incidents: string;
  news_and_funding: string;
  tech_transformation: string;
  okta_ecosystem: string;
  prospects: string; // JSON string
  research_summary: string;
  opportunity_type: 'net_new' | 'competitive_displacement' | 'expansion' | 'unknown';
  priority_score: number; // 1-10 based on trigger signals
}

export interface CompanyInfo {
  company_name: string;
  domain: string | null;
  industry: string;
}

// ─── Zod Schema for Structured Prospect Output ────────────────────────────────

const ProspectSchema = z.array(
  z.object({
    name: z.string(),
    title: z.string(),
    background: z.string(),
    location: z.enum(['ANZ', 'APAC', 'Global', 'Unknown']),
    isPersona: z.boolean(),
  })
);

// ─── Retry Wrapper ─────────────────────────────────────────────────────────────

const runWithRetry = async (agent: Agent, prompt: string, maxRetries = 2) => {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await run(agent, prompt);
    } catch (error) {
      if (i === maxRetries) throw error;
      console.warn(`Retry ${i + 1}/${maxRetries} for agent "${agent.name}"...`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1))); // backoff
    }
  }
  throw new Error('Unreachable');
};

// ─── Input Validation ──────────────────────────────────────────────────────────

function validateCompanyInput(company: CompanyInfo): void {
  if (!company.company_name || company.company_name.trim().length < 2) {
    throw new Error('Invalid company name: must be at least 2 characters');
  }
  if (!company.industry || company.industry.trim().length < 2) {
    throw new Error('Invalid industry: must be at least 2 characters');
  }
  if (company.domain && !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(company.domain)) {
    console.warn(`Domain "${company.domain}" may be invalid, proceeding anyway`);
  }
}

// ─── Shared Agent Instructions ─────────────────────────────────────────────────

const OKTA_BASE_INSTRUCTIONS = `You are an expert SDR (Sales Development Representative) researcher working for Okta in the Australia/New Zealand region. Your role is to build comprehensive account profiles for Workforce Identity and Identity Governance opportunities.

**Your Perspective:**
- You work for Okta, the leading independent identity provider
- You're focused on the ANZ (Australia/New Zealand) market
- You're building detailed account intelligence for SDR outreach and sales strategy

**You understand the full Okta platform portfolio including:**
- **Okta Workforce Identity Cloud**: Single Sign-On (SSO), Adaptive MFA, Universal Directory, Lifecycle Management, Device Access, API Access Management, Access Gateway
- **Okta Identity Governance**: Access Requests, Access Certifications, Identity Governance & Administration (IGA)
- **Okta Privileged Access**: Now enhanced with Axiom Security acquisition for database and Kubernetes PAM
- **Identity Security Posture Management (ISPM)**: Continuously discovering and remediating identity-based risks
- **Identity Threat Protection with Okta AI**: Real-time detection and response to identity-based threats
- **Okta Workflows**: No-code identity automation (5 flows on Starter, 50 on Essentials, unlimited on Professional+)
- **Okta for AI Agents**: Discovering, securing, and managing AI agent identities
- **Cross App Access Protocol (XAA)**: New open protocol for agent-to-app and app-to-app access
- **Auth0 Customer Identity Cloud**: For CIAM use cases (the developer-facing side of Okta)

**Okta Pricing Tiers (Workforce Identity Cloud):**
- Starter: $6/user/month (SSO, MFA, Universal Directory, 5 Workflows)
- Core Essentials: $14/user/month
- Essentials: $17/user/month (adds Adaptive MFA, Privileged Access, Lifecycle Management, Access Governance, 50 Workflows)
- Professional: Custom pricing (adds Device Access, ISPM, Identity Threat Protection, Sandbox, Unlimited Workflows)
- Enterprise: Custom pricing (adds API Access Management, Access Gateway, M2M Tokens)

**Competitive Positioning — Okta vs. Microsoft Entra ID:**
- Okta is vendor-neutral and not tied to any single cloud ecosystem — this is the #1 differentiator
- 7,000+ pre-built integrations (Okta Integration Network) vs Entra's narrower third-party support
- Superior developer experience through Auth0 with extensive APIs and SDKs
- Independent innovation cycle not tied to Microsoft's broader platform strategy
- Deeper identity governance for non-Microsoft environments
- When the prospect is heavily Microsoft-invested, position Okta as complementary for non-Microsoft apps and governance, not necessarily as a full replacement
- Microsoft's advantages: cost bundling with E3/E5, deep M365/Azure integration, simpler for Microsoft-only shops

**Full Competitive Landscape:**
- Microsoft Entra ID (Azure AD) — dominant in Microsoft shops
- Ping Identity / ForgeRock (merged via Thoma Bravo) — strong in hybrid enterprise
- CyberArk — PAM specialist expanding into identity
- SailPoint — IGA leader
- CrowdStrike — expanding from endpoint into identity security
- JumpCloud — unified directory-as-a-service targeting SMB

**ANZ Compliance & Regulatory Context:**
- Australian Privacy Act (2024 reforms increasing penalties and accountability)
- NZ Privacy Act 2020
- APRA CPS 234 (Information Security) — requires APRA-regulated entities to maintain information security capability commensurate with threats
- APRA CPS 230 (Operational Risk Management) — new standard requiring technology resilience
- ASD Essential Eight — November 2023 updates require phishing-resistant MFA at Maturity Level 2+; Maturity Level 3 requires "assume breach" mindset; Okta FastPass and FIDO2/WebAuthn directly address these
- NZISM (NZ Information Security Manual)
- Data sovereignty — Australian government and regulated industries increasingly require in-country data residency; Okta offers regional data residency

**Research Guidelines:**
- Prioritize ANZ-specific information (local operations, regional leadership, compliance)
- Consider time zone context (AEDT/AEST/NZST)
- Note if company has ANZ headquarters or significant regional presence
- Identify regional pain points that Okta could address (M&A integration, hybrid AD environments, Zero Trust, compliance mandates, remote workforce enablement)
- Always provide factual, detailed findings with specific data points and sources
- Be thorough and professional; if information is not publicly available, state that clearly

Format all responses in markdown with bold text, bullet points, and links to sources.`;

// ─── Specialist Agent Definitions ──────────────────────────────────────────────

function createIAMDiscoveryAgent(): Agent {
  return new Agent({
    model: 'gpt-5.2',
    name: 'Okta IAM Discovery Agent',
    instructions: `${OKTA_BASE_INSTRUCTIONS}

**Your Specialisation:** You are the IAM Discovery specialist. Your sole focus is identifying the target company's current identity and access management infrastructure, tools, vendors, and maturity.`,
    tools: [webSearchTool()],
  });
}

function createWorkforceIntelAgent(): Agent {
  return new Agent({
    model: 'gpt-5.2',
    name: 'Okta Workforce Intelligence Agent',
    instructions: `${OKTA_BASE_INSTRUCTIONS}

**Your Specialisation:** You are the Workforce Intelligence specialist. Your sole focus is understanding the company's workforce size, IT complexity, organisational structure, and operational footprint — all of which indicate IAM needs and scale.`,
    tools: [webSearchTool()],
  });
}

function createSecurityComplianceAgent(): Agent {
  return new Agent({
    model: 'gpt-5.2',
    name: 'Okta Security & Compliance Agent',
    instructions: `${OKTA_BASE_INSTRUCTIONS}

**Your Specialisation:** You are the Security & Compliance specialist. Your sole focus is identifying security incidents, compliance posture, Zero Trust maturity, and regulatory requirements that create urgency for Okta adoption.`,
    tools: [webSearchTool()],
  });
}

function createNewsAgent(): Agent {
  return new Agent({
    model: 'gpt-5.2',
    name: 'Okta News & Funding Agent',
    instructions: `${OKTA_BASE_INSTRUCTIONS}

**Your Specialisation:** You are the News & Funding specialist. Your sole focus is identifying recent company news, funding events, M&A activity, leadership changes, and strategic initiatives that create identity-related opportunities.`,
    tools: [webSearchTool()],
  });
}

function createTechTransformAgent(): Agent {
  return new Agent({
    model: 'gpt-5.2',
    name: 'Okta Tech Transformation Agent',
    instructions: `${OKTA_BASE_INSTRUCTIONS}

**Your Specialisation:** You are the Technology Transformation specialist. Your sole focus is identifying cloud migration, IT modernisation, Zero Trust implementation, and digital transformation initiatives that indicate readiness for modern identity infrastructure.`,
    tools: [webSearchTool()],
  });
}

function createEcosystemCheckAgent(): Agent {
  return new Agent({
    model: 'gpt-5.2',
    name: 'Okta Ecosystem Check Agent',
    instructions: `${OKTA_BASE_INSTRUCTIONS}

**Your Specialisation:** You are the Okta Ecosystem specialist. Your sole focus is determining whether the target company has any existing relationship with Okta, Auth0, or the Okta partner/integration ecosystem — to classify the opportunity as net-new, competitive displacement, or expansion.`,
    tools: [webSearchTool()],
  });
}

function createProspectsAgent(): Agent {
  return new Agent({
    model: 'gpt-5.2',
    name: 'Okta Prospects Discovery Agent',
    instructions: `${OKTA_BASE_INSTRUCTIONS}

**Your Specialisation:** You are the Decision-Maker Discovery specialist. Your sole focus is identifying key individuals at the target company who would be involved in an Okta purchasing decision, prioritizing ANZ-based contacts.`,
    tools: [webSearchTool()],
  });
}

function createSummaryAgent(): Agent {
  return new Agent({
    model: 'gpt-5.2',
    name: 'Okta SDR Summary Agent',
    instructions: `${OKTA_BASE_INSTRUCTIONS}

**Your Specialisation:** You are the Executive Summary specialist. You synthesize research findings into actionable sales intelligence. You classify opportunities, score priority, and provide clear next steps for the SDR.`,
    tools: [webSearchTool()],
  });
}

// ─── Default Personas ──────────────────────────────────────────────────────────

function getDefaultPersonas(industry: string) {
  return [
    {
      name: 'Persona: Chief Information Security Officer (ANZ)',
      title: 'CISO ANZ',
      background: `Typical persona for ${industry} in ANZ region: Owns regional security strategy, manages compliance with APRA CPS 234 and ASD Essential Eight, drives Zero Trust initiatives, oversees identity security and risk management`,
      location: 'ANZ' as const,
      isPersona: true,
    },
    {
      name: 'Persona: Chief Information Officer (ANZ)',
      title: 'CIO ANZ',
      background: `Typical persona for ${industry} in ANZ region: Leads regional IT strategy, manages digital transformation and cloud migration, oversees IAM platform decisions, drives IT vendor consolidation and modernisation`,
      location: 'ANZ' as const,
      isPersona: true,
    },
    {
      name: 'Persona: Director of IT Infrastructure (ANZ)',
      title: 'Director IT Infrastructure ANZ',
      background: `Typical persona for ${industry} in ANZ region: Manages identity infrastructure including Active Directory, SSO, and MFA, oversees provisioning and deprovisioning, responsible for hybrid cloud identity environments`,
      location: 'ANZ' as const,
      isPersona: true,
    },
    {
      name: 'Persona: Head of Identity & Access Management (ANZ)',
      title: 'Head of IAM ANZ',
      background: `Typical persona for ${industry} in ANZ region: Owns IAM strategy and platform selection, manages access governance and compliance, drives identity lifecycle automation, ensures regulatory compliance with Australian Privacy Act and APRA CPS 234`,
      location: 'ANZ' as const,
      isPersona: true,
    },
    {
      name: 'Persona: Head of Cyber Security (ANZ)',
      title: 'Head of Cyber Security ANZ',
      background: `Typical persona for ${industry} in ANZ region: Manages security operations and incident response, implements Zero Trust architecture, oversees privileged access management, ensures ASD Essential Eight maturity and compliance`,
      location: 'ANZ' as const,
      isPersona: true,
    },
  ];
}

// ─── Main Research Function ────────────────────────────────────────────────────

export async function researchCompany(company: CompanyInfo): Promise<ResearchResult> {
  // Validate input
  validateCompanyInput(company);

  const companyIdentifier = company.domain
    ? `${company.company_name} (${company.domain})`
    : company.company_name;

  // Create specialist agents
  const iamAgent = createIAMDiscoveryAgent();
  const workforceAgent = createWorkforceIntelAgent();
  const securityAgent = createSecurityComplianceAgent();
  const newsAgent = createNewsAgent();
  const techAgent = createTechTransformAgent();
  const ecosystemAgent = createEcosystemCheckAgent();
  const prospectsAgent = createProspectsAgent();
  const summaryAgent = createSummaryAgent();

  // ─── Research Prompts ──────────────────────────────────────────────────────

  const iamPrompt = `Research ${companyIdentifier} and identify their current identity and access management (IAM) solution for their workforce. Look for:

- What IAM providers or platforms they use for employees and contractors (Okta, Microsoft Entra ID / Azure AD, Ping Identity, ForgeRock, CyberArk, SailPoint, on-prem Active Directory, LDAP, custom, etc.)
- How they handle workforce authentication (Single Sign-On, Multi-Factor Authentication, passwordless, passkeys)
- Directory services and user provisioning/deprovisioning approach (SCIM, HR-driven lifecycle management)
- Identity governance posture (access reviews, access certifications, entitlement management, segregation of duties)
- Privileged access management (PAM) tools in use
- Any Zero Trust architecture initiatives or announcements
- How they manage access across cloud applications (SaaS sprawl, multi-cloud environments — AWS, Azure, GCP)
- Tech stack mentions, job postings, or conference talks that indicate their IAM approach
- Any legacy identity infrastructure that could be ripe for modernisation
- Check for any existing Okta or Auth0 usage in job postings or tech blogs
- Look for RFP or procurement signals for identity solutions
- Assess shadow IT / unmanaged SaaS application usage indicators
- Check if they are listed as an ISV partner in the Okta Integration Network (OIN)
- Assess their passwordless/passkey adoption status
- Look for mentions of SASE or Secure Access Service Edge adoption (often bundled with identity)

**Return your findings in MARKDOWN format with:**
- Use **bold** for important terms and platform names
- Use bullet points for multiple findings
- Include [links](url) to sources when available
- Organize with clear sections if helpful

Provide detailed, well-formatted findings.`;

  const workforcePrompt = `Research ${company.company_name}'s workforce, IT environment, and organisational complexity:

- Approximate number of employees and contractors
- Number of office locations (especially ANZ offices) and remote/hybrid work policies
- Organisational structure (divisions, subsidiaries, business units)
- Recent M&A activity (mergers and acquisitions — identity consolidation is the #1 post-merger IT challenge)
- Recent divestitures or spin-offs (requiring identity separation)
- Rapid headcount growth indicators (scaling IAM becomes painful)
- Contractor/contingent workforce programs (extending identity beyond employees)
- Number and types of applications in their environment (SaaS adoption, cloud vs on-prem mix)
- Multi-cloud strategy (AWS, Azure, GCP usage)
- IT complexity indicators (multiple directories, legacy systems, heterogeneous environments)
- Any public metrics about their technology footprint or digital workplace
- Industry-specific application requirements
- Board or executive changes (new CIO/CISO often triggers IAM review)

**Return your findings in MARKDOWN format with:**
- Use **bold** for key numbers and metrics
- Use bullet points to organize different aspects
- Include [links](url) to sources when available

Provide specific, well-formatted findings with data.`;

  const securityPrompt = `Search for security incidents, data breaches, Zero Trust maturity, and compliance information for ${company.company_name}:

- Any reported security incidents or breaches (especially credential-based attacks, phishing, identity-related incidents, ransomware)
- Any publicly reported incidents affecting ANZ customers or operations
- Compliance requirements and regulatory pressures:
  * Australian Privacy Act (note 2024 reforms increasing penalties and accountability)
  * NZ Privacy Act 2020
  * APRA CPS 234 (Information Security) — requires capability commensurate with threats
  * APRA CPS 230 (Operational Risk Management) — new standard for technology resilience
  * ASD Essential Eight — specifically assess likely maturity level; note November 2023 updates require phishing-resistant MFA (FIDO2/WebAuthn/passkeys) at Maturity Level 2+; Maturity Level 3 requires "assume breach" mindset; Okta FastPass and FIDO2 directly address these
  * NZISM (NZ Information Security Manual)
  * GDPR, SOC2, ISO 27001, PCI DSS, HIPAA as applicable
- Security certifications held
- Zero Trust strategy announcements, progress, or maturity assessment
- Public statements about security priorities, identity security, or IAM modernisation
- Recent security-related news or executive commentary on cyber risk
- ANZ-specific data sovereignty or data residency requirements
- Board-level or executive focus on cyber resilience
- Insurance or risk management mentions related to cyber

**Return your findings in MARKDOWN format with:**
- Use **bold** for dates, certifications, compliance standards, and frameworks
- Use bullet points for incidents and requirements
- Include [links](url) to news sources and reports
- Highlight ANZ-relevant compliance, Zero Trust, and identity security considerations

Provide detailed, chronological findings from an Okta ANZ SDR perspective.`;

  const newsPrompt = `Find recent news and funding information for ${company.company_name}:

- Recent funding rounds (amounts, investors, dates) — prioritize ANZ market activity
- IPO status, annual reports, or financial highlights
- ANZ expansion plans or regional growth initiatives
- Mergers and acquisitions (especially relevant for identity consolidation opportunities — this is a top Okta selling trigger)
- Divestitures or spin-offs (identity separation opportunity)
- IT modernisation, cloud migration, or digital transformation initiatives
- Product launches or major announcements (especially ANZ-relevant)
- Strategic partnerships (especially with cloud providers, system integrators like Deloitte, Accenture, PwC, or technology vendors)
- Leadership changes (new CIO, CISO, CTO, or IT leadership — often triggers IAM vendor review)
- Remote/hybrid work policy changes
- AI adoption or agentic AI initiatives (relevant for Okta for AI Agents)
- Cost optimisation or vendor consolidation programs

Focus on news from the last 12-18 months, with emphasis on ANZ market presence.

**Return your findings in MARKDOWN format with:**
- Use **bold** for funding amounts, dates, and key announcements
- Use bullet points to organize different news items
- Include [links](url) to news sources
- Highlight ANZ-specific news, M&A activity, leadership changes, and regional relevance

Provide chronological, well-formatted news with sources from an Okta ANZ SDR perspective.`;

  const techPrompt = `Research ${company.company_name}'s technology transformation and IT modernisation efforts:

- Cloud migration initiatives (AWS, Azure, GCP adoption or multi-cloud strategies)
- Digital transformation and IT modernisation projects
- Active Directory migration or consolidation efforts (on-prem AD to cloud identity)
- Legacy IAM platform migration or replacement projects
- Zero Trust architecture implementation or planning
- Platform modernisation and SaaS adoption trends
- Employee experience and digital workplace improvements
- Remote and hybrid work enablement technology
- DevOps, DevSecOps, and engineering culture
- API-first strategies or developer platforms
- IT consolidation or vendor rationalisation efforts (reducing tool sprawl)
- SASE (Secure Access Service Edge) adoption
- AI and automation initiatives (relevant for Okta Workflows and Okta for AI Agents)
- Job postings that indicate IAM, identity, security, or Zero Trust modernisation priorities
- Technology blog posts, conference talks, or open-source contributions

**Return your findings in MARKDOWN format with:**
- Use **bold** for technology names, platforms, and frameworks
- Use bullet points for different initiatives
- Include [links](url) to blog posts, job listings, and announcements

Provide specific, well-formatted examples.`;

  const ecosystemPrompt = `Research ${company.company_name}'s existing relationship with the Okta ecosystem and classify the opportunity type:

- Are they an existing Okta customer? (check Okta customer stories at okta.com/customers, case studies, press releases)
- Do they use Auth0 for customer-facing applications? (check Auth0 case studies, developer docs, tech blogs)
- Are they listed as an ISV partner in the Okta Integration Network (OIN)?
- Do they have any published integrations with Okta?
- Check if they sponsor or attend Oktane conferences
- Look for Okta-related job postings or certifications mentioned by employees
- Check if they use competing IAM platforms and which ones (Microsoft Entra ID, Ping Identity, ForgeRock, CyberArk, SailPoint, etc.)
- Look for any public mentions of identity vendor evaluation, RFP activity, or contract renewals
- Check if they are a customer of Okta's system integrator partners (Deloitte, Accenture, PwC, etc.) for identity projects

**Based on your findings, classify the opportunity as one of:**
- **expansion** — They already use Okta and there's opportunity to sell additional products (Governance, Privileged Access, ISPM, etc.)
- **competitive_displacement** — They use a competing IAM platform that Okta could replace
- **net_new** — No clear existing IAM vendor; greenfield opportunity
- **unknown** — Insufficient information to classify

**Return your findings in MARKDOWN format with:**
- A clear **Opportunity Classification** section at the top with the classification and reasoning
- Use **bold** for vendor names and classifications
- Use bullet points for evidence
- Include [links](url) to sources

Provide detailed findings.`;

  const prospectsPrompt = `Find key decision-makers at ${company.company_name} for Okta Workforce Identity sales outreach in the ANZ market.

**CRITICAL REQUIREMENT: You MUST provide EXACTLY 5 entries.**

**Prioritize ANZ-based decision makers** (Australia/New Zealand offices). If you cannot find 5 specific named individuals, fill remaining slots with IDEAL PERSONAS based on the company's industry, size, and ANZ presence.

**Search Strategy:**
- Search for LinkedIn profiles and public bios associated with ${company.company_name}
- Look for titles containing: CISO, "Chief Information Security", CIO, "Chief Information Officer", "Identity", "IAM", "Access Management", "IT Infrastructure", "Cyber Security", "Information Security", "IT Operations", "Enterprise Architecture"
- Prioritize people whose profiles show ANZ location (Sydney, Melbourne, Brisbane, Auckland, Perth, Canberra, Wellington, Adelaide)
- Check recent conference speaker lists (Gartner Security & Risk, Oktane, AISA, AusCERT, ISACA) for the company's representatives

**For real people found (search these roles, prioritize ANZ-based):**
- Chief Information Security Officer (CISO) — ANZ or APAC region
- Chief Information Officer (CIO) — ANZ or APAC region
- VP/Director of IT Infrastructure or IT Operations (ANZ)
- VP/Director of Identity & Access Management or Security Architecture (ANZ)
- Chief Technology Officer (CTO) — ANZ region
- Head of Cyber Security (ANZ or APAC)
- General Manager/Managing Director (Australia/New Zealand)
- VP/Director of Enterprise Architecture (ANZ or APAC)
- VP/Director of Digital / Customer Experience (for Auth0/CIAM conversations)

**For personas (when real names unavailable):**
- Create realistic role-based personas relevant to ANZ market
- Format name as: "Persona: [Role Title]"

**Return as JSON array with EXACTLY 5 entries. Each entry MUST have these exact fields:**
[{"name": "...", "title": "...", "background": "...", "location": "ANZ|APAC|Global|Unknown", "isPersona": true|false}]

Mix real people and personas as needed to reach exactly 5 entries. For real individuals, note if they are ANZ-based or global. Only include publicly available information.`;

  try {
    // ─── Phase 1: Parallel Independent Research ────────────────────────────────
    console.log(`[Okta SDR] Starting parallel research for ${company.company_name}...`);

    const [iamResult, workforceResult, securityResult, newsResult, techResult, ecosystemResult] =
      await Promise.all([
        runWithRetry(iamAgent, iamPrompt),
        runWithRetry(workforceAgent, workforcePrompt),
        runWithRetry(securityAgent, securityPrompt),
        runWithRetry(newsAgent, newsPrompt),
        runWithRetry(techAgent, techPrompt),
        runWithRetry(ecosystemAgent, ecosystemPrompt),
      ]);

    console.log(`[Okta SDR] Phase 1 complete. Running prospects discovery...`);

    // ─── Phase 2: Prospects (can run independently) ────────────────────────────
    const prospectsResult = await runWithRetry(prospectsAgent, prospectsPrompt);

    console.log(`[Okta SDR] Phase 2 complete. Generating executive summary...`);

    // ─── Phase 3: Summary (depends on all prior research) ──────────────────────

    const summaryPrompt = `Based on the following research about ${company.company_name}, create a concise 2-3 paragraph executive summary for an Okta SDR in the ANZ market, followed by an opportunity classification and priority score.

**RESEARCH FINDINGS:**

**Current IAM Solution:**
${iamResult.finalOutput || 'No information found'}

**Workforce & IT Complexity:**
${workforceResult.finalOutput || 'No information found'}

**Security & Compliance:**
${securityResult.finalOutput || 'No information found'}

**News & Funding:**
${newsResult.finalOutput || 'No information found'}

**Tech Transformation:**
${techResult.finalOutput || 'No information found'}

**Okta Ecosystem Check:**
${ecosystemResult.finalOutput || 'No information found'}

---

**YOUR TASK:**

1. Write a 2-3 paragraph executive summary focusing on:
   - Why they might need Okta Workforce Identity Cloud (current IAM gaps, legacy infrastructure, identity sprawl, Zero Trust gaps, governance deficiencies)
   - ANZ-specific opportunities (APRA CPS 234, ASD Essential Eight maturity uplift, Australian Privacy Act, NZ Privacy Act, data sovereignty)
   - Key timing indicators (M&A activity, cloud migration, funding, leadership changes, security incidents, transformation initiatives)
   - Primary decision-makers to target (prioritize ANZ-based contacts)

2. Consider Okta value propositions to highlight:
   - Neutral, independent identity platform (not tied to Microsoft or any single cloud vendor)
   - Unified workforce identity across SSO, MFA, lifecycle management, and governance
   - 7,000+ pre-built integrations via Okta Integration Network (OIN)
   - Zero Trust enablement and adaptive access policies
   - Identity Governance for compliance and audit readiness (APRA CPS 234, Essential Eight)
   - Okta Privileged Access (enhanced with Axiom acquisition) for securing sensitive resources
   - Identity Threat Protection with Okta AI for real-time threat detection
   - ISPM for continuous identity risk discovery
   - Okta for AI Agents if they are adopting agentic AI
   - Rapid time-to-value and reduced IT complexity

3. At the very end of your response, on separate lines, provide:
   OPPORTUNITY_TYPE: [net_new|competitive_displacement|expansion|unknown]
   PRIORITY_SCORE: [1-10]

   Score criteria:
   - 9-10: Multiple strong triggers (M&A, security incident, compliance mandate, leadership change, existing Okta footprint to expand)
   - 7-8: Clear pain points and timing signals (cloud migration, legacy AD, compliance gaps)
   - 5-6: Moderate opportunity (general modernisation, some indicators)
   - 3-4: Low urgency (stable environment, limited triggers)
   - 1-2: Poor fit or insufficient information

**Return the summary in MARKDOWN format with:**
- Use **bold** for key insights and pain points
- Use bullet points for action items
- Make it actionable and sales-focused for ANZ market
- Include specific Okta value propositions for this account`;

    const summaryResult = await runWithRetry(summaryAgent, summaryPrompt);

    console.log(`[Okta SDR] Phase 3 complete. Parsing results...`);

    // ─── Parse Prospects ───────────────────────────────────────────────────────

    let prospectsList: z.infer<typeof ProspectSchema> = [];
    try {
      // Extract JSON from the response (it may be wrapped in markdown code blocks)
      const rawOutput = prospectsResult.finalOutput || '[]';
      const jsonMatch = rawOutput.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Attempt Zod validation, fall back to raw parse if schema doesn't match exactly
        const validated = ProspectSchema.safeParse(parsed);
        if (validated.success) {
          prospectsList = validated.data;
        } else {
          // Map to expected schema if fields are close but not exact
          prospectsList = parsed.map((p: Record<string, unknown>) => ({
            name: String(p.name || 'Unknown'),
            title: String(p.title || 'Unknown'),
            background: String(p.background || ''),
            location: ['ANZ', 'APAC', 'Global', 'Unknown'].includes(String(p.location))
              ? String(p.location)
              : 'Unknown',
            isPersona: Boolean(p.isPersona ?? String(p.name || '').startsWith('Persona:')),
          }));
        }
      }
    } catch (e) {
      console.error('Failed to parse prospects JSON:', e);
      prospectsList = [];
    }

    // Ensure exactly 5 entries — add personas if needed
    const defaultPersonas = getDefaultPersonas(company.industry);
    while (prospectsList.length < 5) {
      prospectsList.push(defaultPersonas[prospectsList.length]);
    }
    prospectsList = prospectsList.slice(0, 5);

    // ─── Parse Opportunity Type and Priority Score from Summary ─────────────────

    let opportunityType: ResearchResult['opportunity_type'] = 'unknown';
    let priorityScore = 5;

    const summaryOutput = summaryResult.finalOutput || '';

    const oppMatch = summaryOutput.match(/OPPORTUNITY_TYPE:\s*(net_new|competitive_displacement|expansion|unknown)/i);
    if (oppMatch) {
      opportunityType = oppMatch[1].toLowerCase() as ResearchResult['opportunity_type'];
    }

    const scoreMatch = summaryOutput.match(/PRIORITY_SCORE:\s*(\d+)/i);
    if (scoreMatch) {
      priorityScore = Math.min(10, Math.max(1, parseInt(scoreMatch[1], 10)));
    }

    // Clean the summary output by removing the classification lines
    const cleanSummary = summaryOutput
      .replace(/OPPORTUNITY_TYPE:\s*.*/gi, '')
      .replace(/PRIORITY_SCORE:\s*.*/gi, '')
      .trim();

    console.log(`[Okta SDR] Research complete for ${company.company_name}. Opportunity: ${opportunityType}, Priority: ${priorityScore}/10`);

    return {
      current_iam_solution: iamResult.finalOutput || 'No information found',
      workforce_info: workforceResult.finalOutput || 'No information found',
      security_incidents: securityResult.finalOutput || 'No information found',
      news_and_funding: newsResult.finalOutput || 'No information found',
      tech_transformation: techResult.finalOutput || 'No information found',
      okta_ecosystem: ecosystemResult.finalOutput || 'No information found',
      prospects: JSON.stringify(prospectsList),
      research_summary: cleanSummary || 'No summary available',
      opportunity_type: opportunityType,
      priority_score: priorityScore,
    };
  } catch (error) {
    console.error(`[Okta SDR] Research error for ${company.company_name}:`, error);
    throw error;
  }
}