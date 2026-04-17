import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import {
  OktaAccountOverviewInput,
  OktaValueDriver,
  OKTA_VALUE_DRIVER_LABELS,
  normalizeOktaOverviewInput,
} from './okta-overview';
import { buildAttachedAccountDocumentContext } from './account-documents';
import { Account, AccountNote, Prospect } from './db';
import { buildOpportunityContext } from './opportunity-context';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

interface OktaOverviewGenerationRequest {
  account: Account;
  notes: AccountNote[];
  keyPeople: Prospect[];
}

interface OktaOverviewPovRequest extends OktaOverviewGenerationRequest {
  overview: OktaAccountOverviewInput;
}

// ─── System Instructions ──────────────────────────────────────────────────────

const OKTA_OVERVIEW_SYSTEM_INSTRUCTIONS = `You are building the working-account overview page for an Okta Workforce Identity Cloud (WIC) SDR.

Your job is to synthesize the account research into a practical, editable first draft that an SDR can use immediately for outreach, discovery, and account strategy.

Rules:
- Base everything on the supplied research only. Do not invent facts, brands, apps, or stakeholders.
- Stay grounded in the Okta Workforce Identity value framework: securing the workforce, simplifying IT operations, and enabling the workforce.
- Priorities must be the company's top 5 BUSINESS priorities — the biggest challenges or strategic initiatives they face as an organisation. These must NOT be about identity, authentication, IAM, or workforce identity. Think: revenue growth, market expansion, digital transformation, cost reduction, operational efficiency, M&A integration, competitive positioning, talent acquisition, regulatory compliance, supply chain, etc.
- Each priority title should be a specific, measurable business challenge — not a generic category. Good: "Reduce IT operational costs by 20% while integrating 2 recently acquired subsidiaries". Bad: "IT modernisation".
- Priority rationale should follow the chain: observed signal -> business challenge -> strategic impact (1-2 sentences max).
- Priority evidence must include clickable source links where available. Use markdown link format.
- Rank priorities from 1 to 5. If evidence is weak for lower-ranked items, still provide the best-supported hypothesis and make the rationale explicit.
- Only select value drivers where the connection to the account's specific situation is clear and defensible.
- Choose 1 to 3 value drivers, only from the allowed list.
- Choose 1 to 2 triggers, only when supported by concrete signals in the research (M&A activity, cloud migration, legacy AD/LDAP modernisation, security incident, compliance mandate, leadership change, funding/growth).
- Business model markdown should use bullet points for clarity: revenue model, customer segments, growth signals, and any workforce identity or IT complexity implications.
- Business structure should include brands, subsidiaries, business units, entities, apps, or platforms when the research supports them.
- Tech stack should include only technologies or platforms explicitly visible in the research (prioritise IAM tools, HR systems, cloud platforms, SaaS apps).
- Preserve markdown links to source material when they are already present in the supplied research.
- Use the same narrative chain wherever possible: observed signal -> likely workforce identity problem -> business impact -> Okta angle.
- Keep markdown concise, factual, and editable.

Return valid JSON only with this exact shape:
{
  "priorities": [
    { "rank": 1, "title": "", "rationale": "", "evidence": "" },
    { "rank": 2, "title": "", "rationale": "", "evidence": "" },
    { "rank": 3, "title": "", "rationale": "", "evidence": "" },
    { "rank": 4, "title": "", "rationale": "", "evidence": "" },
    { "rank": 5, "title": "", "rationale": "", "evidence": "" }
  ],
  "valueDrivers": [
    { "driver": "secure the workforce", "rationale": "", "evidence": "" }
  ],
  "triggers": [
    { "title": "", "detail": "", "source": "", "dateLabel": "" }
  ],
  "businessModelMarkdown": "",
  "businessStructure": [
    { "name": "", "type": "entity", "region": "", "associatedApps": [], "notes": "" }
  ],
  "techStack": [
    { "category": "identity", "name": "", "notes": "" }
  ],
  "povMarkdown": ""
}`;

const OKTA_POV_SYSTEM_INSTRUCTIONS = `You are writing the bottom-of-page strategic POV for an Okta Workforce Identity Cloud (WIC) SDR account workspace.

Rules:
- Use the saved overview as the primary frame and the research as supporting evidence.
- Lead with the strongest signal. The POV should read as if written by someone who has spent meaningful time understanding this company's workforce identity landscape.
- Keep it specific, forceful, and commercially useful. No generic phrasing.
- Do not invent facts or internal initiatives.
- Write in markdown only, no code fences.
- Produce 350 to 650 words.
- Use these exact section headings:
  ## Executive View
  ## Why This Account Matters Now
  ## Okta WIC POV
  ## What We Should Validate Next
- Executive View: state the company objective, the workforce identity pressure, and the commercial why-now in 2-3 sentences.
- Why This Account Matters Now: anchor to concrete public signals, dates, and links. Preserve the strongest evidence and markdown links when they help the seller.
- Okta WIC POV: explicitly connect signals to likely workforce identity friction, business impact, and the best-fit Okta angle. Follow observed signal -> likely workforce identity problem -> business impact -> Okta WIC angle. Reference relevant Okta products (SSO, MFA, Lifecycle Management, OIG, ITP, ISPM, OPA, OIN) only when the signal justifies it.
- What We Should Validate Next: use 3-4 numbered validation questions or hypotheses that are specific to this account. Each should test a specific assumption about their buying triggers or workforce identity pain.
- Tie the POV back to the best-fit Okta value drivers and concrete signals in the research.
- This is a seller POV, not a product brochure and not a generic summary.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tryParseJson<T>(raw: string): T {
  const clean = raw
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No JSON object found in model response');
  }

  return JSON.parse(match[0]) as T;
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseProspects(
  raw: string | null
): Array<{ name?: string; title?: string; background?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildOktaAccountResearchContext(
  account: Account,
  notes: AccountNote[],
  keyPeople: Prospect[]
): string {
  const parts: string[] = [];

  parts.push(`COMPANY: ${account.company_name}`);
  parts.push(`INDUSTRY: ${account.industry || 'Unknown'}`);
  if (account.domain) parts.push(`DOMAIN: ${account.domain}`);
  if (account.parent_company) parts.push(`PARENT COMPANY: ${account.parent_company}`);
  if (account.parent_company_region) parts.push(`PARENT COMPANY REGION: ${account.parent_company_region}`);
  if (account.okta_tier) parts.push(`OKTA TIER: ${account.okta_tier}`);
  if (account.okta_priority_score !== null && account.okta_priority_score !== undefined) {
    parts.push(`OKTA PRIORITY SCORE: ${account.okta_priority_score}/100`);
  }
  if (account.okta_estimated_annual_revenue) {
    parts.push(`ESTIMATED ANNUAL REVENUE: ${account.okta_estimated_annual_revenue}`);
  }
  if (account.okta_estimated_user_volume) {
    parts.push(`ESTIMATED EMPLOYEE COUNT: ${account.okta_estimated_user_volume}`);
  }
  if (account.okta_opportunity_type) {
    parts.push(`OPPORTUNITY TYPE: ${account.okta_opportunity_type}`);
  }

  const useCases = parseStringArray(account.okta_use_cases);
  if (useCases.length > 0) parts.push(`USE CASES: ${useCases.join(', ')}`);

  const skus = parseStringArray(account.okta_skus);
  if (skus.length > 0) parts.push(`LIKELY RELEVANT OKTA SKUS: ${skus.join(', ')}`);

  if (account.okta_current_iam_solution) {
    parts.push(`\nCURRENT IAM SOLUTION\n${account.okta_current_iam_solution}`);
  }
  if (account.okta_workforce_info) {
    parts.push(`\nWORKFORCE AND SCALE\n${account.okta_workforce_info}`);
  }
  if (account.okta_security_incidents) {
    parts.push(`\nSECURITY AND COMPLIANCE\n${account.okta_security_incidents}`);
  }
  if (account.okta_news_and_funding) {
    parts.push(`\nNEWS AND FUNDING\n${account.okta_news_and_funding}`);
  }
  if (account.okta_tech_transformation) {
    parts.push(`\nTECH TRANSFORMATION\n${account.okta_tech_transformation}`);
  }
  if (account.okta_ecosystem) {
    parts.push(`\nOKTA ECOSYSTEM AND INTEGRATIONS\n${account.okta_ecosystem}`);
  }
  if (account.okta_research_summary) {
    parts.push(`\nRESEARCH SUMMARY\n${account.okta_research_summary}`);
  }
  if (account.okta_sdr_notes) {
    parts.push(`\nSDR NOTES\n${account.okta_sdr_notes}`);
  }

  const researchedProspects = parseProspects(account.okta_prospects);
  if (researchedProspects.length > 0) {
    parts.push('\nRESEARCHED PERSONAS / PROSPECTS');
    for (const prospect of researchedProspects.slice(0, 8)) {
      const segments = [prospect.name, prospect.title].filter(Boolean);
      if (prospect.background) segments.push(prospect.background);
      parts.push(`- ${segments.join(' | ')}`);
    }
  }

  if (keyPeople.length > 0) {
    parts.push('\nKEY PEOPLE ALREADY IN CRM');
    for (const person of keyPeople.slice(0, 12)) {
      const segments = [
        `${person.first_name} ${person.last_name}`.trim(),
        person.title || 'Unknown title',
        person.role_type || 'unknown role',
        person.department || '',
      ].filter(Boolean);
      parts.push(`- ${segments.join(' | ')}`);
    }
  }

  if (notes.length > 0) {
    parts.push('\nRECENT ACCOUNT NOTES');
    for (const note of notes.slice(0, 8)) {
      parts.push(`- ${note.created_at}: ${note.content}`);
    }
  }

  const attachedDocumentContext = buildAttachedAccountDocumentContext(account.id);
  if (attachedDocumentContext) {
    parts.push(`\n${attachedDocumentContext}`);
  }

  const opportunityContext = buildOpportunityContext(account.id);
  if (opportunityContext) {
    parts.push(`\n${opportunityContext}`);
  }

  parts.push(`\nOKTA WORKFORCE IDENTITY VALUE FRAMEWORK
Okta WIC value drivers:
- Secure the workforce: Zero Trust enforcement, phishing-resistant MFA, Identity Threat Protection (ITP), Identity Security Posture Management (ISPM), Okta Privileged Access (OPA).
- Simplify IT operations: Lifecycle Management (provisioning/de-provisioning), 7,000+ pre-built OIN integrations, LDAP/AD modernisation, reduced IT complexity.
- Enable the workforce: Universal SSO, seamless access across cloud and on-prem apps, self-service, Okta for AI agents, productivity at scale.
Key Okta differentiators:
- Neutral, vendor-independent identity platform (not tied to Microsoft, Google, or any single cloud)
- Unified platform: SSO, MFA, Lifecycle Management, OIG, ITP, ISPM, OPA in one stack
- ANZ compliance coverage: APRA CPS 234, ASD Essential Eight, Australian Privacy Act, NZ Privacy Act
- Rapid time-to-value with OIN pre-built integrations`);

  return parts.join('\n');
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildOktaOverviewPrompt(request: OktaOverviewGenerationRequest): string {
  return [
    'Build an Okta Workforce Identity account overview draft for the supplied account.',
    '',
    'Target output:',
    '- 5 ranked business priorities (the company\'s top strategic challenges, NOT related to identity/IAM/workforce identity)',
    '- 1 to 3 best-fit Okta WIC value drivers',
    '- 1 to 2 triggers (concrete buying signals only)',
    '- a concise markdown explanation of how the business makes money and its workforce/IT implications',
    '- a structured view of business structure, brands, entities, and associated apps',
    '- a structured view of the visible tech stack (focus on IAM, HR systems, cloud platforms)',
    '',
    'Use research signals to identify the most likely workforce identity friction points.',
    'Preserve source links from the supplied research when they exist.',
    '',
    'Field guidance:',
    '- priorities[i].title: short commercial label describing a core business challenge (not identity-related), not a full sentence.',
    '- priorities[i].rationale: 1-2 concise sentences following signal -> business challenge -> strategic impact.',
    '- priorities[i].evidence: short markdown bullets or sentences with clickable source links where available.',
    '- valueDrivers[i].rationale: explain why the driver fits now using the research signals.',
    '- valueDrivers[i].evidence: concise markdown with source links where available.',
    '- triggers[i].detail: explain why the trigger matters now in business terms.',
    '- triggers[i].source: short source note or markdown link.',
    '- businessModelMarkdown: use short markdown sections for revenue model, workforce scale, and identity implications.',
    '- businessStructure[i].notes and techStack[i].notes: concise factual notes only.',
    '',
    'Allowed value drivers:',
    ...Object.entries(OKTA_VALUE_DRIVER_LABELS).map(([value, label]) => `- ${label}: ${value}`),
    '',
    'ACCOUNT CONTEXT',
    buildOktaAccountResearchContext(request.account, request.notes, request.keyPeople),
    '',
    'Return valid JSON only.',
  ].join('\n');
}

function buildOktaOverviewPovPrompt(request: OktaOverviewPovRequest): string {
  return [
    'Write the strategic Okta Workforce Identity POV markdown for the account overview page.',
    '',
    'The saved overview is the primary working draft. Use research to strengthen it, not to invent beyond it.',
    '',
    'POV section guidance:',
    '- Executive View: state the company objective, the workforce identity pressure, and the commercial why-now.',
    '- Why This Account Matters Now: anchor to concrete public signals, dates, and links.',
    '- Okta WIC POV: follow observed signal -> likely workforce identity problem -> business impact -> Okta WIC angle.',
    '- What We Should Validate Next: use numbered validation questions or hypotheses specific to this account.',
    '',
    'SAVED OVERVIEW JSON',
    JSON.stringify(request.overview, null, 2),
    '',
    'ACCOUNT CONTEXT',
    buildOktaAccountResearchContext(request.account, request.notes, request.keyPeople),
    '',
    'Return markdown only.',
  ].join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateOktaAccountOverviewDraft(
  request: OktaOverviewGenerationRequest
): Promise<OktaAccountOverviewInput> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const agent = new Agent({
    name: 'Okta WIC Account Overview Draft Generator',
    model: 'gpt-5.2',
    instructions: OKTA_OVERVIEW_SYSTEM_INSTRUCTIONS,
    tools: [],
  });

  const response = await run(agent, buildOktaOverviewPrompt(request));
  const raw = tryParseJson<Partial<OktaAccountOverviewInput>>(response.finalOutput || '');
  return normalizeOktaOverviewInput(raw);
}

export async function generateOktaAccountOverviewPov(request: OktaOverviewPovRequest): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const agent = new Agent({
    name: 'Okta WIC Account Overview POV Generator',
    model: 'gpt-5.2',
    instructions: OKTA_POV_SYSTEM_INSTRUCTIONS,
    tools: [],
  });

  const response = await run(agent, buildOktaOverviewPovPrompt(request));
  const output = (response.finalOutput || '').replace(/```markdown\s*/g, '').replace(/```\s*/g, '').trim();
  if (!output) {
    throw new Error('Model returned an empty Okta WIC POV');
  }
  return output;
}
