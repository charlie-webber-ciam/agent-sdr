import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE, AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE } from './auth0-value-framework';
import { type Account } from './db';
import {
  eventResearchBriefSchema,
  generatedInvitationsEnvelopeSchema,
  EVENT_INVITATION_WRITER_MODEL,
  type EventInvitationStandaloneInput,
  type EventResearchBrief,
  type GeneratedInvitation,
} from './event-invitation-writer-schema';

export {
  eventInvitationStandaloneInputSchema,
  eventInvitationAccountInputSchema,
  eventResearchBriefSchema,
  generatedInvitationSchema,
  generatedInvitationsEnvelopeSchema,
  EVENT_INVITATION_WRITER_MODEL,
  POSITIONING_ANGLES,
} from './event-invitation-writer-schema';
export type {
  EventInvitationStandaloneInput,
  EventInvitationAccountInput,
  EventResearchBrief,
  EventResearchEvidence,
  GeneratedInvitation,
} from './event-invitation-writer-schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

function cleanJsonResponse(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function parseStructuredOutput<T>(raw: string, schema: z.ZodType<T>): T {
  const cleaned = cleanJsonResponse(raw);
  return schema.parse(JSON.parse(cleaned));
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function collectSourceUrls(response: { output?: unknown[] }): string[] {
  if (!Array.isArray(response.output)) return [];

  const urls = new Set<string>();

  for (const item of response.output) {
    if (!item || typeof item !== 'object') continue;
    const webSearchItem = item as {
      type?: string;
      action?: { sources?: Array<{ url?: string }> };
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

function summarizeHostname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const RESEARCH_INSTRUCTIONS = `You are helping an Auth0 SDR assess whether a specific event is relevant to a prospect's company.

Your job is to first understand the company's #1 business priority, then assess whether the event agenda addresses the identity/auth friction that threatens that priority.

THE #1 RULE: Find the company's biggest business priority first. The event invitation will be anchored to this priority, not to a generic auth problem. The event must be positioned as relevant to something the company already cares deeply about.

${AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE}

Research rules:
- Use quick web research to understand: what the company does, its biggest current business priority, and how identity/auth relates to that priority.
- Look for: funding rounds, M&A, product launches, market expansion, regulatory pressure, growth signals.
- Assess event relevance: does the event agenda help solve the identity friction that threatens their biggest business priority?
- If the evidence is weak, lower confidence instead of sounding certain.
- Do not invent tech stacks, internal initiatives, or specific metrics.
- Keep every field concise and practical for outbound messaging.
- "currentAuthChallenges" should describe the identity/auth friction that connects to their #1 business priority.
- "likelyEventRelevance" should explain how specific event agenda items map to the company's business priority and the identity friction blocking it.

Return JSON only that matches the schema exactly.`;

const GENERATION_INSTRUCTIONS = `You write personalised event invitations for Auth0 SDR outreach. Every invitation is a mini-POV that connects the event to the company's biggest business priority.

Rules:
- Use only the provided brief and event description. Do not invent event details or company facts.
- NEVER open with "You're invited", "Join us", "Don't miss", or any generic event promotion language.
- Each invitation must start with a hook tied to the company's #1 business priority, then connect it to how the event addresses the identity friction threatening that priority.
- Calibrate framing to the prospect's role: devs get technical friction and hands-on value, managers get delivery/velocity angle, execs get strategic perspective.
- Reference one specific agenda item or learning outcome from the event description.
- Connect it explicitly to how the event helps them overcome the identity friction blocking their business priority.
- Keep each invitation 80-150 words.
- Include the registration link naturally within the CTA. Do not just append a bare URL.
- End with a low-friction CTA and sign off with "Cheers,\\nCharlie".
- Use Josh Braun tone: curious, specific, helpful, not salesy.
- No em dashes, no emojis, no fake praise.
- Australian English (s instead of z where applicable).
- The three variants must have different positioning angles, all anchored to the business priority:
  - problem-fit: "This event covers the identity friction blocking your [business priority]"
  - capability-fit: "You'll get hands-on with what you need to unblock [business priority]"
  - network-fit: "Connect with teams solving the same [business priority] challenges"

${AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE}

Return JSON only that matches the schema exactly. The top-level JSON must be an object with a single key: "invitations".`;

function buildResearchPrompt(input: EventInvitationStandaloneInput): string {
  const lines = [
    `Company: ${input.prospectCompany.trim()}`,
    `Prospect: ${input.prospectName.trim()}, ${input.prospectTitle.trim()}`,
    '',
    'Event being considered:',
    input.eventDescription.trim(),
    '',
    'Goal: assess this company\'s likely auth challenges and whether the event agenda is relevant to their situation.',
  ];

  if (input.customInstructions?.trim()) {
    lines.push('', `Additional instructions from user: ${input.customInstructions.trim()}`);
  }

  return lines.join('\n');
}

function buildGenerationPrompt(
  brief: EventResearchBrief,
  eventDescription: string,
  registrationLink: string,
  prospectName: string,
  customInstructions?: string
): string {
  const lines = [
    'Write three personalised event invitation variants from this reviewed brief.',
    '',
    'Company brief JSON:',
    JSON.stringify(brief, null, 2),
    '',
    'Event description:',
    eventDescription.trim(),
    '',
    `Registration link: ${registrationLink.trim()}`,
    `Prospect first name for greeting: ${prospectName.split(' ')[0]}`,
    '',
    'Variant rules:',
    '- Variant 1 angle = problem-fit',
    '- Variant 2 angle = capability-fit',
    '- Variant 3 angle = network-fit',
  ];

  if (customInstructions?.trim()) {
    lines.push('', `Additional writing instructions: ${customInstructions.trim()}`);
  }

  return lines.join('\n');
}

export async function researchEventRelevance(
  input: EventInvitationStandaloneInput
): Promise<EventResearchBrief> {
  const response = await openai.responses.create({
    model: EVENT_INVITATION_WRITER_MODEL,
    instructions: RESEARCH_INSTRUCTIONS,
    input: buildResearchPrompt(input),
    temperature: 0.2,
    max_output_tokens: 1200,
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
      format: zodTextFormat(eventResearchBriefSchema, 'event_invitation_research_brief'),
      verbosity: 'low',
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error('Research returned no content');
  }

  const parsed = parseStructuredOutput(raw, eventResearchBriefSchema);
  const sourceUrls = collectSourceUrls(response);

  // Clean up evidence
  const cleanEvidence = parsed.evidence
    .map((item) => ({
      title: item.title.trim(),
      url: item.url.trim(),
      snippet: item.snippet.trim(),
    }))
    .filter((item) => item.title && item.snippet && isValidHttpUrl(item.url));

  // Fallback to source URLs if no evidence returned
  const finalEvidence = cleanEvidence.length > 0
    ? cleanEvidence.slice(0, 3)
    : sourceUrls.slice(0, 2).map((url) => ({
        title: summarizeHostname(url),
        url,
        snippet: 'Source consulted during research.',
      }));

  return eventResearchBriefSchema.parse({
    ...parsed,
    evidence: finalEvidence,
  });
}

export function buildBriefFromAccount(
  account: Account,
  eventDescription: string
): EventResearchBrief {
  const challenges: string[] = [];
  if (account.current_auth_solution) challenges.push(account.current_auth_solution);
  if (account.tech_transformation) challenges.push(account.tech_transformation);
  if (account.security_incidents) challenges.push(account.security_incidents);

  const relevanceParts: string[] = [];
  if (account.use_cases) {
    try {
      const useCases = JSON.parse(account.use_cases);
      if (Array.isArray(useCases) && useCases.length > 0) {
        relevanceParts.push(`Known use cases: ${useCases.join(', ')}`);
      }
    } catch { /* ignore parse errors */ }
  }
  if (account.research_summary) {
    relevanceParts.push(account.research_summary);
  }

  return {
    companyName: account.company_name,
    domain: account.domain,
    industry: account.industry || 'Unknown',
    whatTheyDo: account.customer_base_info || account.research_summary || account.company_name,
    currentAuthChallenges: challenges.join(' | ') || 'No specific auth challenges documented.',
    likelyEventRelevance: relevanceParts.join(' ') || 'Relevance assessment pending - generate to evaluate.',
    evidence: [],
    confidence: account.research_status === 'completed' ? 'high' : 'medium',
  };
}

export async function generateEventInvitations(
  brief: EventResearchBrief,
  eventDescription: string,
  registrationLink: string,
  prospectName: string,
  customInstructions?: string
): Promise<GeneratedInvitation[]> {
  const response = await openai.responses.create({
    model: EVENT_INVITATION_WRITER_MODEL,
    instructions: GENERATION_INSTRUCTIONS,
    input: buildGenerationPrompt(brief, eventDescription, registrationLink, prospectName, customInstructions),
    temperature: 0.6,
    max_output_tokens: 2400,
    text: {
      format: zodTextFormat(generatedInvitationsEnvelopeSchema, 'event_invitation_drafts'),
      verbosity: 'low',
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error('Invitation generation returned no content');
  }

  const parsed = parseStructuredOutput(raw, generatedInvitationsEnvelopeSchema);
  return parsed.invitations.map((inv) => ({
    ...inv,
    body: inv.body.replace(/—/g, '-').trim(),
    positioning: inv.positioning.trim(),
    keyEventHighlight: inv.keyEventHighlight.trim(),
  }));
}
