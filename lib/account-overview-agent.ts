import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import {
  AUTH0_COMMAND_OF_MESSAGE_OUTPUT_GUIDANCE,
  AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE,
} from './auth0-value-framework';
import {
  AccountOverviewInput,
  AUTH0_VALUE_DRIVER_LABELS,
  normalizeOverviewInput,
} from './account-overview';
import { buildAttachedAccountDocumentContext } from './account-documents';
import { Account, AccountNote, Prospect } from './db';
import { buildOpportunityContext } from './opportunity-context';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

interface OverviewGenerationRequest {
  account: Account;
  notes: AccountNote[];
  keyPeople: Prospect[];
}

interface OverviewPovRequest extends OverviewGenerationRequest {
  overview: AccountOverviewInput;
}

const OVERVIEW_SYSTEM_INSTRUCTIONS = `You are building the working-account overview page for an Auth0 SDR.

Your job is to synthesize the account research into a practical, editable first draft that an SDR can use immediately for outreach, discovery, and account strategy.

Rules:
- Base everything on the supplied research only. Do not invent facts, brands, apps, or stakeholders.
- Stay grounded in the Auth0 value framework.
- If Command of the Message is present, use it as the organising logic across priorities, value drivers, triggers, business model, structure, tech stack, and POV framing.
- Priorities must be the company's top 5 BUSINESS priorities — the biggest challenges or strategic initiatives they face as an organisation. These must NOT be about identity, authentication, or CIAM. Think: revenue growth, market expansion, digital transformation, cost reduction, customer experience, regulatory compliance, M&A integration, competitive positioning, operational efficiency, supply chain, etc.
- Each priority title should be a specific, measurable business challenge — not a generic category. Good: "Expand into 3 new APAC markets by Q4 to hit $2B revenue target". Bad: "Growth strategy".
- Priority rationale should follow the chain: observed signal -> business challenge -> strategic impact (1-2 sentences max).
- Priority evidence must include clickable source links where available. Use markdown link format.
- Rank priorities from 1 to 5. If evidence is weak for lower-ranked items, still provide the best-supported hypothesis and make the rationale explicit.
- Only select value drivers where the connection to the account's specific situation is clear and defensible. Generic "could apply to anyone" rationale should be avoided.
- Choose 1 to 3 value drivers, only from the allowed list.
- Choose 1 to 2 triggers, only when supported by concrete signals in the research (funding rounds, leadership hires, tech announcements, compliance deadlines).
- Business model markdown should use bullet points for clarity: revenue model, customer segments, growth signals, and any identity-related commercial complexity.
- Business structure should include brands, subsidiaries, business units, entities, apps, or platforms when the research supports them.
- Tech stack should include only technologies or platforms explicitly visible in the research.
- Preserve markdown links to source material when they are already present in the supplied research or attached document context.
- Use the same narrative chain wherever possible: observed signal -> likely identity problem -> business impact -> Auth0 angle.
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
    { "driver": "accelerate time to market", "rationale": "", "evidence": "" }
  ],
  "triggers": [
    { "title": "", "detail": "", "source": "", "dateLabel": "" }
  ],
  "businessModelMarkdown": "",
  "businessStructure": [
    { "name": "", "type": "entity", "region": "", "associatedApps": [], "notes": "" }
  ],
  "techStack": [
    { "category": "other", "name": "", "notes": "" }
  ],
  "povMarkdown": ""
}`;

const POV_SYSTEM_INSTRUCTIONS = `You are writing the bottom-of-page strategic POV for an Auth0 SDR account workspace.

Rules:
- Use the saved overview as the primary frame and the research as supporting evidence.
- Use Command of the Message as the narrative spine when it is available.
- Lead with the strongest signal. The POV should read as if written by someone who has spent meaningful time understanding this company.
- Keep it specific, forceful, and commercially useful. No generic phrasing.
- Do not invent facts or internal initiatives.
- Write in markdown only, no code fences.
- Produce 350 to 650 words.
- Use these exact section headings:
  ## Executive View
  ## Why This Account Matters Now
  ## Auth0 POV
  ## What We Should Validate Next
- Executive View: state the company objective, the pressure, and the commercial why-now in 2-3 sentences.
- Why This Account Matters Now: anchor to concrete public signals, dates, and links. Preserve the strongest evidence and markdown links when they help the seller.
- Auth0 POV: explicitly connect signals to likely identity friction, business impact, and the best-fit Auth0 angle. Follow observed signal -> likely identity problem -> business impact -> Auth0 angle.
- What We Should Validate Next: use 3-4 numbered validation questions or hypotheses that are specific to this account, not generic next steps. Each should test a specific assumption about their buying triggers or identity pain.
- Tie the POV back to the best-fit Auth0 value drivers and concrete signals in the research.
- This is a seller POV, not a product brochure and not a generic summary.`;

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

function parseProspects(raw: string | null): Array<{ name?: string; title?: string; background?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildAccountResearchContext(account: Account, notes: AccountNote[], keyPeople: Prospect[]): string {
  const parts: string[] = [];

  parts.push(`COMPANY: ${account.company_name}`);
  parts.push(`INDUSTRY: ${account.industry || 'Unknown'}`);
  if (account.domain) parts.push(`DOMAIN: ${account.domain}`);
  if (account.parent_company) parts.push(`PARENT COMPANY: ${account.parent_company}`);
  if (account.parent_company_region) parts.push(`PARENT COMPANY REGION: ${account.parent_company_region}`);
  if (account.tier) parts.push(`AUTH0 TIER: ${account.tier}`);
  if (account.priority_score !== null) parts.push(`AUTH0 PRIORITY SCORE: ${account.priority_score}/10`);
  if (account.estimated_annual_revenue) parts.push(`ESTIMATED ANNUAL REVENUE: ${account.estimated_annual_revenue}`);
  if (account.estimated_user_volume) parts.push(`ESTIMATED USER VOLUME: ${account.estimated_user_volume}`);

  const useCases = parseStringArray(account.use_cases);
  if (useCases.length > 0) parts.push(`USE CASES: ${useCases.join(', ')}`);

  const skus = parseStringArray(account.auth0_skus);
  if (skus.length > 0) parts.push(`LIKELY RELEVANT SKUS: ${skus.join(', ')}`);

  if (account.command_of_message) parts.push(`\nCOMMAND OF THE MESSAGE\n${account.command_of_message}`);
  if (account.current_auth_solution) parts.push(`\nCURRENT AUTH SOLUTION\n${account.current_auth_solution}`);
  if (account.customer_base_info) parts.push(`\nCUSTOMER BASE AND SCALE\n${account.customer_base_info}`);
  if (account.security_incidents) parts.push(`\nSECURITY AND COMPLIANCE\n${account.security_incidents}`);
  if (account.news_and_funding) parts.push(`\nNEWS AND FUNDING\n${account.news_and_funding}`);
  if (account.tech_transformation) parts.push(`\nTECH TRANSFORMATION\n${account.tech_transformation}`);
  if (account.research_summary) parts.push(`\nRESEARCH SUMMARY\n${account.research_summary}`);
  if (account.sdr_notes) parts.push(`\nSDR NOTES\n${account.sdr_notes}`);

  const researchedProspects = parseProspects(account.prospects);
  if (researchedProspects.length > 0) {
    parts.push('\nRESEARCHED PERSONAS / PROSPECTS');
    for (const prospect of researchedProspects.slice(0, 8)) {
      const segments = [prospect.name, prospect.title].filter(Boolean);
      if (prospect.background) {
        segments.push(prospect.background);
      }
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

  parts.push(`\nAUTH0 VALUE FRAMEWORK GUIDANCE\n${AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE}`);
  parts.push(`\nCOMMAND OF MESSAGE FORMAT REFERENCE\n${AUTH0_COMMAND_OF_MESSAGE_OUTPUT_GUIDANCE}`);

  return parts.join('\n');
}

function buildOverviewPrompt(request: OverviewGenerationRequest): string {
  return [
    'Build an account overview draft for the supplied account.',
    '',
    'Target output:',
    '- 5 ranked business priorities (the company\'s top strategic challenges, NOT related to identity/auth/CIAM)',
    '- 1 to 3 best-fit Auth0 value drivers',
    '- 1 to 2 triggers',
    '- a concise markdown explanation of how the business makes money',
    '- a structured view of business structure, brands, entities, and associated apps',
    '- a structured view of the visible tech stack',
    '',
    'Use the command of the message when present as the primary narrative clue.',
    'Preserve source links from the supplied research when they exist.',
    '',
    'Field guidance:',
    '- priorities[i].title: short commercial label describing a core business challenge (not identity-related), not a full sentence.',
    '- priorities[i].rationale: 1-2 concise sentences following signal -> business challenge -> strategic impact.',
    '- priorities[i].evidence: short markdown bullets or sentences with clickable source links where available.',
    '- valueDrivers[i].rationale: explain why the driver fits now using the same command-of-message chain.',
    '- valueDrivers[i].evidence: concise markdown with source links where available.',
    '- triggers[i].detail: explain why the trigger matters now in business terms.',
    '- triggers[i].source: short source note or markdown link.',
    '- businessModelMarkdown: use short markdown sections for revenue model, growth/distribution signals, and identity implications.',
    '- businessStructure[i].notes and techStack[i].notes: concise factual notes only.',
    '',
    'Allowed value drivers:',
    ...Object.entries(AUTH0_VALUE_DRIVER_LABELS).map(([value, label]) => `- ${label}: ${value}`),
    '',
    'ACCOUNT CONTEXT',
    buildAccountResearchContext(request.account, request.notes, request.keyPeople),
    '',
    'Return valid JSON only.',
  ].join('\n');
}

function buildOverviewPovPrompt(request: OverviewPovRequest): string {
  return [
    'Write the strategic POV markdown for the account overview page.',
    '',
    'The saved overview is the primary working draft. Use research to strengthen it, not to invent beyond it.',
    'Use Command of the Message as the governing narrative whenever it is available.',
    'Preserve the best evidence and source links when they materially improve the POV.',
    '',
    'POV section guidance:',
    '- Executive View: state the company objective, the pressure, and the commercial why-now.',
    '- Why This Account Matters Now: anchor to concrete public signals, dates, and links.',
    '- Auth0 POV: follow observed signal -> likely identity problem -> business impact -> Auth0 angle.',
    '- What We Should Validate Next: use numbered validation questions or hypotheses.',
    '',
    'SAVED OVERVIEW JSON',
    JSON.stringify(request.overview, null, 2),
    '',
    'ACCOUNT CONTEXT',
    buildAccountResearchContext(request.account, request.notes, request.keyPeople),
    '',
    'Return markdown only.',
  ].join('\n');
}

export async function generateAccountOverviewDraft(request: OverviewGenerationRequest): Promise<AccountOverviewInput> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const agent = new Agent({
    name: 'Account Overview Draft Generator',
    model: 'gpt-5.2',
    instructions: OVERVIEW_SYSTEM_INSTRUCTIONS,
    tools: [],
  });

  const response = await run(agent, buildOverviewPrompt(request));
  const raw = tryParseJson<Partial<AccountOverviewInput>>(response.finalOutput || '');
  return normalizeOverviewInput(raw);
}

export async function generateAccountOverviewPov(request: OverviewPovRequest): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const agent = new Agent({
    name: 'Account Overview POV Generator',
    model: 'gpt-5.2',
    instructions: POV_SYSTEM_INSTRUCTIONS,
    tools: [],
  });

  const response = await run(agent, buildOverviewPovPrompt(request));
  const output = (response.finalOutput || '').replace(/```markdown\s*/g, '').replace(/```\s*/g, '').trim();
  if (!output) {
    throw new Error('Model returned an empty POV');
  }
  return output;
}
