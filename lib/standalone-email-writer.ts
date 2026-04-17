import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE, AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE } from './auth0-value-framework';
import { extractBaseDomain } from './domain-resolver';
import {
  generatedEmailDraftsEnvelopeSchema,
  researchBriefCoreSchema,
  researchBriefSchema,
  singleGeneratedEmailSchema,
  STANDALONE_EMAIL_WRITER_MODEL,
  type EmailWriterResearchInput,
  type GeneratedEmailDraft,
  type ResearchBrief,
  type ResearchEvidence,
  type SingleGeneratedEmail,
} from './standalone-email-writer-schema';

export {
  AUTH0_VALUE_DRIVERS,
  emailWriterResearchInputSchema,
  generatedEmailDraftSchema,
  generatedEmailDraftsSchema,
  generatedEmailDraftsEnvelopeSchema,
  researchBriefCoreSchema,
  researchBriefSchema,
  researchEvidenceSchema,
  singleGeneratedEmailSchema,
  STANDALONE_EMAIL_WRITER_MODEL,
} from './standalone-email-writer-schema';
export type {
  EmailWriterResearchInput,
  GeneratedEmailDraft,
  ResearchBrief,
  ResearchEvidence,
  SingleGeneratedEmail,
} from './standalone-email-writer-schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const RESEARCH_INSTRUCTIONS = `You are building a non-account-based cold email brief for an Auth0 SDR.

Your job is not to write the email yet. Your job is to identify the company's #1 business priority and the identity/auth friction that threatens it.

THE #1 RULE: Find the company's biggest business priority first. This is where the biggest budget sits. Then identify how identity/auth friction blocks or slows that priority. The email will attach to the business priority, not to an auth problem in isolation.

Examples of business priorities: international expansion, platform consolidation after M&A, hitting profitability targets, launching a new product line, scaling to IPO, regulatory compliance for market entry, digital transformation.

Frameworks to use together:
- Auth0 Value Framework.
- Command of the Message: anchor the brief around the business priority, the identity friction that threatens it, business impact, and desired outcome.
- 30MPC email discipline: attach personalization to the business priority, not trivia.
- Josh Braun style: detached, plain-spoken, specific, curiosity-driven, low-friction.

PERSONA CALIBRATION: Note the prospect's title. This determines how the email will frame the connection:
- Developer/Engineer: technical friction specifics
- Mid-level manager (Director, VP): business value + product-led evidence
- Executive (C-suite): pure business impact, zero product specifics

${AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE}

Research rules:
- Use quick web research to understand the company, what it sells, and its biggest current business priority.
- Look for: funding rounds, M&A, product launches, market expansion, regulatory pressure, growth signals.
- Prefer official company pages plus reputable secondary sources.
- Do not invent recent events, specific metrics, or internal initiatives.
- If the evidence is weak, lower confidence instead of sounding certain.
- "biggestProblem" must be framed as the identity/auth friction that threatens their #1 business priority, not a generic auth problem.
- "whyThisProblemLikelyMattersToThisProspect" must be calibrated to the prospect's role level.
- Keep every field concise and practical for outbound messaging.

Return JSON only that matches the schema exactly.`;

const GENERATION_INSTRUCTIONS = `You write short outbound emails for Auth0 SDR outreach. Every email is a mini-POV: a specific perspective that attaches to the company's biggest business priority and connects it to an identity/auth friction.

Rules:
- Use only the provided brief. Do not add new claims or fresh research.
- Treat "commandMessage" as the primary messaging brief.
- The email must lead with the company's business priority, not with an auth problem.
- The personalization must connect the business priority to the identity/auth friction that threatens it.
- Calibrate framing to the prospect's role: devs get technical friction, managers get team/delivery impact, execs get pure business risk.
- Follow Command of the Message implicitly: business priority signal -> identity friction -> business impact -> desired outcome.
- Use the selected Auth0 value drivers implicitly, not as a product dump.
- Use Josh Braun tone: detached, calm, curious, plain-text, no hype.
- Use 30MPC discipline: commercial relevance over generic personalization.
- Subject lines must be lowercase, 2-5 words, tied to the business priority not auth.
- Keep each email under 100 words.
- No feature dump, no em dashes, no fake praise, no meeting ask.
- End with a low-friction CTA and sign off with "Cheers,\\nCharlie".

${AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE}

Return JSON only that matches the schema exactly. The top-level JSON must be an object with a single key: "drafts".`;

const SINGLE_EMAIL_GENERATION_INSTRUCTIONS = `You write one short outbound email for Auth0 SDR outreach. The email is a mini-POV: a specific perspective that attaches to the company's biggest business priority and connects it to an identity/auth friction.

Rules:
- Use only the provided brief. Do not add new claims or fresh research.
- Treat "commandMessage" as the primary messaging brief.
- The email must lead with the company's business priority, not with an auth problem.
- The personalization must connect the business priority to the identity/auth friction that threatens it.
- Calibrate framing to the prospect's role: devs get technical friction, managers get team/delivery impact, execs get pure business risk.
- Follow Command of the Message implicitly: business priority signal -> identity friction -> business impact -> desired outcome.
- Use the selected Auth0 value drivers implicitly, not as a product dump.
- Use Josh Braun tone: detached, calm, curious, plain-text, no hype.
- Use 30MPC discipline: commercial relevance over generic personalization.
- Subject line must be lowercase, 2-5 words, tied to the business priority not auth.
- Keep the email under 100 words.
- No feature dump, no em dashes, no fake praise, no meeting ask.
- End with a low-friction CTA and sign off with "Cheers,\\nCharlie".
- "reasoning" should state: the business priority identified, persona tier (dev/mid-manager/exec), and the angle chosen.
- "keyInsights" should list the concrete brief points used in the email.

${AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE}

Return JSON only that matches the schema exactly.`;

function cleanJsonResponse(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const candidate = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .trim();

  if (!candidate.includes('.')) return null;
  if (!/^[a-z0-9.-]+$/.test(candidate)) return null;

  return extractBaseDomain(candidate);
}

function maybeInferDomain(companyNameOrDomain: string): string | null {
  return normalizeDomain(companyNameOrDomain);
}

function parseStructuredOutput<T>(raw: string, schema: z.ZodType<T>): T {
  const cleaned = cleanJsonResponse(raw);
  return schema.parse(JSON.parse(cleaned));
}

function summarizeHostname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeEvidence(evidence: ResearchEvidence[]): ResearchEvidence[] {
  return evidence
    .map((item) => ({
      ...item,
      title: item.title.trim(),
      url: item.url.trim(),
      snippet: item.snippet.trim(),
    }))
    .filter((item) => item.title && item.snippet && isValidHttpUrl(item.url));
}

function collectSourceUrls(response: { output?: unknown[] }): string[] {
  if (!Array.isArray(response.output)) return [];

  const urls = new Set<string>();

  for (const item of response.output) {
    if (!item || typeof item !== 'object') continue;
    const webSearchItem = item as {
      type?: string;
      action?: {
        sources?: Array<{ url?: string }>;
      };
    };

    if (webSearchItem.type !== 'web_search_call') continue;

    for (const source of webSearchItem.action?.sources || []) {
      if (typeof source?.url === 'string' && source.url.trim()) {
        urls.add(source.url.trim());
      }
    }
  }

  return Array.from(urls);
}

function dedupeEvidence(evidence: ResearchEvidence[]): ResearchEvidence[] {
  const seen = new Set<string>();
  const unique: ResearchEvidence[] = [];

  for (const item of evidence) {
    const key = item.url.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.slice(0, 5);
}

function buildFallbackEvidence(sourceUrls: string[]): ResearchEvidence[] {
  return sourceUrls.slice(0, 3).map((url) => ({
    title: summarizeHostname(url),
    url,
    snippet: 'Source consulted during brief web research.',
  }));
}

function buildResearchPrompt(input: EmailWriterResearchInput, normalizedDomain: string | null): string {
  const lines = [
    `Company seed: ${input.companyNameOrDomain.trim()}`,
    `Known website/domain hint: ${normalizedDomain || 'none confirmed'}`,
    `Prospect name: ${input.prospectName.trim()}`,
    `Prospect title: ${input.prospectTitle.trim()}`,
    'Goal: build a research brief that identifies the prospect’s single biggest likely problem and frames it for outbound messaging.',
    '',
    'Output guidance:',
    '- "recentTriggerOrObservation" can be a true recent event or a concrete observed company/product/site signal if no recent event is available.',
    '- "commandMessage" should be a short markdown block that ties likely company objectives to the Auth0 Value Framework.',
    '- Within "commandMessage", include: company objectives, best-fit Auth0 value drivers, and 2-3 core messaging pieces a seller can use immediately.',
    '- "evidence" should contain 1-5 concise sourced items with title, url, and a short snippet.',
    '- "auth0ValueDrivers" must select only the value drivers that directly fit the problem.',
  ];

  if (input.customContext?.trim()) {
    lines.push('', `Additional context from user: ${input.customContext.trim()}`);
  }

  if (input.customInstructions?.trim()) {
    lines.push('', `Additional instructions from user: ${input.customInstructions.trim()}`);
  }

  return lines.join('\n');
}

function buildGenerationPrompt(brief: ResearchBrief, customInstructions?: string): string {
  const lines = [
    'Write three short outbound email variants from this reviewed brief.',
    'Use the commandMessage block and selected Auth0 value drivers as the messaging backbone.',
    '',
    'Variant rules:',
    '- Variant 1 angle = diagnostic',
    '- Variant 2 angle = benchmark',
    '- Variant 3 angle = loss-aversion',
    '',
    'Reviewed brief JSON:',
    JSON.stringify(brief, null, 2),
  ];

  if (customInstructions?.trim()) {
    lines.push('', `Additional writing instructions: ${customInstructions.trim()}`);
  }

  return lines.join('\n');
}

function normalizeDraft(draft: GeneratedEmailDraft): GeneratedEmailDraft {
  return {
    ...draft,
    subject: draft.subject.trim().toLowerCase(),
    body: draft.body.replace(/—/g, '-').trim(),
    rationale: draft.rationale.trim(),
  };
}

export async function researchCompanyBrief(input: EmailWriterResearchInput): Promise<ResearchBrief> {
  const normalizedDomain = maybeInferDomain(input.companyNameOrDomain);
  const response = await openai.responses.create({
    model: STANDALONE_EMAIL_WRITER_MODEL,
    instructions: RESEARCH_INSTRUCTIONS,
    input: buildResearchPrompt(input, normalizedDomain),
    temperature: 0.2,
    max_output_tokens: 1800,
    include: ['web_search_call.action.sources'],
    tools: [
      {
        type: 'web_search',
        search_context_size: 'medium',
        user_location: {
          type: 'approximate',
          country: 'US',
        },
      },
    ],
    text: {
      format: zodTextFormat(researchBriefCoreSchema, 'standalone_email_writer_brief'),
      verbosity: 'low',
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error('Research returned no content');
  }

  const parsed = parseStructuredOutput(raw, researchBriefCoreSchema);
  const sourceUrls = collectSourceUrls(response);
  const evidence = dedupeEvidence(sanitizeEvidence(parsed.evidence));
  const finalEvidence = evidence.length > 0 ? evidence : buildFallbackEvidence(sourceUrls);

  if (finalEvidence.length === 0) {
    throw new Error('Research did not return usable sources');
  }

  return researchBriefSchema.parse({
    ...parsed,
    domain: normalizeDomain(parsed.domain) || normalizedDomain,
    evidence: finalEvidence,
    prospectName: input.prospectName.trim(),
    prospectTitle: input.prospectTitle.trim(),
  });
}

export async function generateStandaloneEmailDrafts(
  brief: ResearchBrief,
  customInstructions?: string
): Promise<GeneratedEmailDraft[]> {
  const response = await openai.responses.create({
    model: STANDALONE_EMAIL_WRITER_MODEL,
    instructions: GENERATION_INSTRUCTIONS,
    input: buildGenerationPrompt(brief, customInstructions),
    temperature: 0.6,
    max_output_tokens: 1800,
    text: {
      format: zodTextFormat(generatedEmailDraftsEnvelopeSchema, 'standalone_email_writer_drafts'),
      verbosity: 'low',
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error('Draft generation returned no content');
  }

  const parsed = parseStructuredOutput(raw, generatedEmailDraftsEnvelopeSchema);
  return parsed.drafts.map(normalizeDraft);
}

export async function generateStandaloneSingleEmail(
  brief: ResearchBrief,
  customInstructions?: string
): Promise<SingleGeneratedEmail> {
  const response = await openai.responses.create({
    model: STANDALONE_EMAIL_WRITER_MODEL,
    instructions: SINGLE_EMAIL_GENERATION_INSTRUCTIONS,
    input: buildGenerationPrompt(brief, customInstructions),
    temperature: 0.5,
    max_output_tokens: 1200,
    text: {
      format: zodTextFormat(singleGeneratedEmailSchema, 'standalone_email_writer_single_email'),
      verbosity: 'low',
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error('Single email generation returned no content');
  }

  const parsed = parseStructuredOutput(raw, singleGeneratedEmailSchema);
  return {
    ...parsed,
    subject: parsed.subject.trim().toLowerCase(),
    body: parsed.body.replace(/—/g, '-').trim(),
    reasoning: parsed.reasoning.trim(),
    keyInsights: parsed.keyInsights.map((item) => item.trim()).filter(Boolean),
  };
}

export function formatBriefForAccountSummary(brief: ResearchBrief): string {
  return [
    `Standalone email brief for ${brief.prospectName}, ${brief.prospectTitle}.`,
    `What they do: ${brief.whatTheyDo}`,
    `Likely business model: ${brief.likelyBusinessModel}`,
    `Observed signal: ${brief.recentTriggerOrObservation}`,
    `Biggest likely problem: ${brief.biggestProblem}`,
    `Business impact: ${brief.businessImpact}`,
    `Desired outcome: ${brief.desiredOutcome}`,
    `Auth0 value drivers: ${brief.auth0ValueDrivers.join(', ')}`,
    `Command of the message (Auth0 Value Framework):\n${brief.commandMessage}`,
  ].join('\n');
}
