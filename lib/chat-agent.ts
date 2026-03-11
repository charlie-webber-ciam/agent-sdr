import { Agent, run, setDefaultOpenAIClient, setTracingDisabled, tool, webSearchTool } from '@openai/agents';
import OpenAI from 'openai';

import { generateEmail } from '@/lib/email-writer-agent';
import type { Account, ChatPerspective, Prospect } from '@/lib/db';
import { getAccount, getProspect } from '@/lib/db';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

const EMAIL_TOOL_PARAMETERS = {
  type: 'object',
  properties: {
    accountName: {
      type: 'string',
      description: 'Target account/company name. Required when no account is selected in context. Pass empty string when unknown.',
    },
    recipientName: {
      type: 'string',
      description: 'Recipient full name. Pass empty string when unknown.',
    },
    recipientPersona: {
      type: 'string',
      description: 'Recipient persona/title. Pass empty string when unknown.',
    },
    emailType: {
      type: 'string',
      enum: ['cold', 'warm'],
      description: 'Email type.',
    },
    customInstructions: {
      type: 'string',
      description: 'Optional extra writing instructions. Pass empty string when none.',
    },
    customContext: {
      type: 'string',
      description: 'Optional extra context. Pass empty string when none.',
    },
  },
  required: ['recipientName', 'recipientPersona', 'emailType', 'customInstructions', 'customContext'],
  additionalProperties: false,
} as any;

const CHAT_SYSTEM_INSTRUCTIONS = `
You are an account-aware SDR copilot for Auth0/Okta workflows.

Core behavior:
1. Keep answers practical, concise, and structured with clear markdown sections.
2. Use web search when recency matters or when the user asks for external facts.
3. If the user asks to draft/write/generate an email for a prospect, call the tool "write_prospect_email".
4. If account context is not selected, still call "write_prospect_email" and pass accountName from the user's request so the tool can run brief web research first.
5. Include recipientName and recipientPersona whenever the user provides them.
6. After tool usage, summarize what was drafted and keep the response short so the UI card can be used for copy/paste.
7. Never hallucinate account/prospect context fields; rely on provided context.

Formatting:
- Prefer short headings and bullets.
- Keep paragraphs compact.
- When including a suggested sequence of actions, use numbered lists.
`;

export interface ChatContextInput {
  accountId?: number | null;
  prospectId?: number | null;
  perspective: ChatPerspective;
}

export interface ChatHistoryMessageInput {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string | null;
}

export interface ChatToolOutput {
  toolName: string;
  output: unknown;
}

export interface ChatAssistantRunResult {
  assistantMarkdown: string;
  toolOutputs: ChatToolOutput[];
}

interface BriefAccountResearch {
  companyName: string;
  domain: string | null;
  industry: string;
  summary: string;
  keyFacts: string[];
  sourceUrls: string[];
}

const BRIEF_ACCOUNT_RESEARCH_INSTRUCTIONS = `
You are an SDR research assistant preparing context for a cold outbound email.

Process:
1. Run a brief web search for the company.
2. Use 2-4 credible sources (official company pages, reputable business profiles/news).
3. Capture only practical facts useful for outbound messaging.
4. Keep output concise.

Return JSON only:
{
  "companyName": "string",
  "domain": "string or empty",
  "industry": "string",
  "summary": "2-4 sentence summary",
  "keyFacts": ["fact 1", "fact 2"],
  "sourceUrls": ["https://..."]
}
`;

function roleTypeToLabel(roleType: Prospect['role_type']): string {
  if (!roleType) return 'Contact';
  return roleType.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function buildContextBlock(account: Account | null, prospect: Prospect | null, perspective: ChatPerspective): string {
  const lines: string[] = [];

  lines.push(`Perspective: ${perspective === 'okta' ? 'Okta Workforce' : 'Auth0 CIAM'}`);

  if (account) {
    lines.push(`Account: ${account.company_name} (ID: ${account.id})`);
    lines.push(`Industry: ${account.industry}`);
    if (account.domain) lines.push(`Domain: ${account.domain}`);
    if (account.research_status) lines.push(`Research Status: ${account.research_status}`);

    if (perspective === 'okta') {
      if (account.okta_tier) lines.push(`Okta Tier: ${account.okta_tier}`);
      if (account.okta_priority_score !== null) lines.push(`Okta Priority Score: ${account.okta_priority_score}/100`);
      if (account.okta_research_summary) lines.push(`Okta Summary: ${account.okta_research_summary}`);
    } else {
      if (account.tier) lines.push(`Auth0 Tier: ${account.tier}`);
      if (account.priority_score !== null) lines.push(`Auth0 Priority Score: ${account.priority_score}/10`);
      if (account.research_summary) lines.push(`Auth0 Summary: ${account.research_summary}`);
    }
  } else {
    lines.push('Account: none selected');
  }

  if (prospect) {
    lines.push(`Prospect: ${prospect.first_name} ${prospect.last_name} (ID: ${prospect.id})`);
    if (prospect.title) lines.push(`Prospect Title: ${prospect.title}`);
    if (prospect.email) lines.push(`Prospect Email: ${prospect.email}`);
    if (prospect.role_type) lines.push(`Prospect Role Type: ${prospect.role_type}`);
  } else {
    lines.push('Prospect: none selected');
  }

  return lines.join('\n');
}

function buildHistoryBlock(history: ChatHistoryMessageInput[]): string {
  if (history.length === 0) return 'No prior messages.';

  return history
    .slice(-20)
    .map((msg) => {
      if (msg.role === 'tool') {
        return `[tool:${msg.toolName || 'unknown'}]\n${msg.content}`;
      }
      return `[${msg.role}]\n${msg.content}`;
    })
    .join('\n\n');
}

function parsePotentialJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeEmailToolInput(input: unknown): {
  accountName?: string;
  recipientName?: string;
  recipientPersona?: string;
  emailType: 'cold' | 'warm';
  customInstructions?: string;
  customContext?: string;
} {
  if (!input || typeof input !== 'object') {
    return { emailType: 'cold' };
  }

  const record = input as Record<string, unknown>;
  const accountName = typeof record.accountName === 'string' ? record.accountName.trim() : '';
  const recipientName = typeof record.recipientName === 'string' ? record.recipientName.trim() : '';
  const recipientPersona = typeof record.recipientPersona === 'string' ? record.recipientPersona.trim() : '';
  const customInstructions = typeof record.customInstructions === 'string' ? record.customInstructions.trim() : '';
  const customContext = typeof record.customContext === 'string' ? record.customContext.trim() : '';
  const emailType = record.emailType === 'warm' ? 'warm' : 'cold';

  return {
    accountName: accountName || undefined,
    recipientName: recipientName || undefined,
    recipientPersona: recipientPersona || undefined,
    emailType,
    customInstructions: customInstructions || undefined,
    customContext: customContext || undefined,
  };
}

function extractJsonObject(raw: string): string | null {
  const withoutCodeFence = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = withoutCodeFence.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .toLowerCase();

  return normalized.includes('.') ? normalized : null;
}

function inferAccountNameFromMessage(message: string): string | undefined {
  const trimmed = message.trim();
  if (!trimmed) return undefined;

  const quotedMatch = trimmed.match(/["“]([^"”]{2,80})["”]/);
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1].trim();
  }

  const patterns = [
    /\b(?:at|for|with)\s+([A-Za-z][A-Za-z0-9&.\-]*(?:\s+[A-Za-z0-9&.\-]+){0,5})(?=[,.;]|$)/i,
    /\baccount\s+([A-Za-z][A-Za-z0-9&.\-]*(?:\s+[A-Za-z0-9&.\-]+){0,5})(?=[,.;]|$)/i,
    /\bcompany\s+([A-Za-z][A-Za-z0-9&.\-]*(?:\s+[A-Za-z0-9&.\-]+){0,5})(?=[,.;]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function parseBriefAccountResearch(rawOutput: string, fallbackCompanyName: string): BriefAccountResearch {
  const candidate = extractJsonObject(rawOutput);
  const foundUrls = Array.from(new Set((rawOutput.match(/https?:\/\/[^\s)]+/g) || []).map((url) => url.replace(/[.,;]+$/, ''))));

  if (!candidate) {
    return {
      companyName: fallbackCompanyName,
      domain: null,
      industry: 'Unknown',
      summary: rawOutput.trim(),
      keyFacts: [],
      sourceUrls: foundUrls,
    };
  }

  try {
    const parsed = JSON.parse(candidate) as Partial<BriefAccountResearch>;
    const companyName =
      typeof parsed.companyName === 'string' && parsed.companyName.trim()
        ? parsed.companyName.trim()
        : fallbackCompanyName;
    const industry =
      typeof parsed.industry === 'string' && parsed.industry.trim()
        ? parsed.industry.trim()
        : 'Unknown';
    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : rawOutput.trim();
    const keyFacts = Array.isArray(parsed.keyFacts)
      ? parsed.keyFacts.filter((fact): fact is string => typeof fact === 'string' && fact.trim().length > 0)
      : [];
    const sourceUrls = Array.isArray(parsed.sourceUrls)
      ? parsed.sourceUrls
          .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
          .map((url) => url.trim())
      : foundUrls;

    return {
      companyName,
      domain: normalizeDomain(typeof parsed.domain === 'string' ? parsed.domain : null),
      industry,
      summary,
      keyFacts,
      sourceUrls,
    };
  } catch {
    return {
      companyName: fallbackCompanyName,
      domain: null,
      industry: 'Unknown',
      summary: rawOutput.trim(),
      keyFacts: [],
      sourceUrls: foundUrls,
    };
  }
}

async function runBriefAccountResearch(input: {
  accountName: string;
  perspective: ChatPerspective;
  userMessage: string;
}): Promise<BriefAccountResearch> {
  const researchAgent = new Agent({
    name: 'Brief Account Researcher',
    model: 'gpt-5.4',
    instructions: BRIEF_ACCOUNT_RESEARCH_INSTRUCTIONS,
    tools: [webSearchTool()],
  });

  const researchPrompt = [
    `Company: ${input.accountName}`,
    `Perspective: ${input.perspective === 'okta' ? 'Okta Workforce Identity' : 'Auth0 CIAM'}`,
    'Goal: Gather brief company context to support drafting one cold outbound email.',
    `User request: ${input.userMessage}`,
  ].join('\n');

  const runResult = await run(researchAgent, researchPrompt);
  const rawOutput = String(runResult.finalOutput || '').trim();
  return parseBriefAccountResearch(rawOutput, input.accountName);
}

function buildSyntheticAccountFromBriefResearch(
  research: BriefAccountResearch,
  perspective: ChatPerspective
): Account {
  const summaryLines: string[] = [];
  if (research.summary) summaryLines.push(research.summary);
  if (research.keyFacts.length > 0) {
    summaryLines.push(`Key facts:\n${research.keyFacts.map((fact) => `- ${fact}`).join('\n')}`);
  }
  if (research.sourceUrls.length > 0) {
    summaryLines.push(`Sources:\n${research.sourceUrls.join('\n')}`);
  }

  const summary = summaryLines.join('\n\n').trim() || `Brief web research summary for ${research.companyName}.`;

  if (perspective === 'okta') {
    return {
      id: 0,
      company_name: research.companyName,
      domain: research.domain,
      industry: research.industry || 'Unknown',
      research_status: 'completed',
      okta_research_summary: summary,
    } as Account;
  }

  return {
    id: 0,
    company_name: research.companyName,
    domain: research.domain,
    industry: research.industry || 'Unknown',
    research_status: 'completed',
    research_summary: summary,
  } as Account;
}

function extractToolOutputs(runResult: any): ChatToolOutput[] {
  const outputs: ChatToolOutput[] = [];
  const newItems = Array.isArray(runResult?.newItems) ? runResult.newItems : [];

  for (const item of newItems) {
    if (item?.type !== 'tool_call_output_item') continue;
    const rawItem = item?.rawItem || {};
    const toolName = rawItem?.name || rawItem?.toolName || 'unknown_tool';
    outputs.push({
      toolName,
      output: parsePotentialJson(item?.output),
    });
  }

  return outputs;
}

function resolveContext(input: ChatContextInput): { account: Account | null; prospect: Prospect | null } {
  const account = input.accountId ? getAccount(input.accountId) || null : null;
  const prospect = input.prospectId ? getProspect(input.prospectId) || null : null;

  if (prospect && account && prospect.account_id !== account.id) {
    throw new Error('Selected prospect does not belong to the selected account');
  }

  if (prospect && !account) {
    const prospectAccount = getAccount(prospect.account_id) || null;
    return { account: prospectAccount, prospect };
  }

  return { account, prospect };
}

export async function runChatAssistant(args: {
  context: ChatContextInput;
  userMessage: string;
  history: ChatHistoryMessageInput[];
}): Promise<ChatAssistantRunResult> {
  const { context, userMessage, history } = args;
  const { account, prospect } = resolveContext(context);

  const writeProspectEmailTool = tool({
    name: 'write_prospect_email',
    description: 'Draft a prospect email using the existing email writer agent. If no account context is selected, provide accountName and the tool will run brief web research first.',
    parameters: EMAIL_TOOL_PARAMETERS,
    strict: false,
    execute: async (input) => {
      const normalizedInput = normalizeEmailToolInput(input);

      const inferredAccountName =
        normalizedInput.accountName ||
        inferAccountNameFromMessage(userMessage) ||
        inferAccountNameFromMessage(normalizedInput.customContext || '');

      let accountForEmail: Account | null = account;
      let briefResearch: BriefAccountResearch | null = null;

      if (!accountForEmail) {
        if (!inferredAccountName) {
          return {
            error: 'No account context is selected. Provide accountName so I can run brief web research and draft the email.',
          };
        }

        briefResearch = await runBriefAccountResearch({
          accountName: inferredAccountName,
          perspective: context.perspective,
          userMessage,
        });

        accountForEmail = buildSyntheticAccountFromBriefResearch(briefResearch, context.perspective);
      }

      const recipientName =
        normalizedInput.recipientName ||
        (prospect ? `${prospect.first_name} ${prospect.last_name}` : '');

      if (!recipientName) {
        return {
          error: 'No prospect is selected and no recipientName was provided.',
        };
      }

      const recipientPersona =
        normalizedInput.recipientPersona ||
        prospect?.title ||
        roleTypeToLabel(prospect?.role_type ?? null);

      const contextLines: string[] = [];
      if (prospect) {
        contextLines.push(`Prospect context: ${prospect.first_name} ${prospect.last_name}${prospect.title ? `, ${prospect.title}` : ''}`);
        if (prospect.department) contextLines.push(`Department: ${prospect.department}`);
        if (prospect.ai_summary) contextLines.push(`AI summary: ${prospect.ai_summary}`);
      }
      if (normalizedInput.customContext) {
        contextLines.push(normalizedInput.customContext);
      }
      if (!account && briefResearch) {
        contextLines.push(
          `No CRM account record was selected. Use only this brief web research context for ${briefResearch.companyName}.`
        );
      }

      const result = await generateEmail({
        recipientName,
        recipientPersona,
        emailType: normalizedInput.emailType,
        researchContext: context.perspective,
        customInstructions: normalizedInput.customInstructions,
        customContext: contextLines.length > 0 ? contextLines.join('\n') : undefined,
        accountData: accountForEmail,
      });

      return {
        subject: result.subject,
        body: result.body,
        reasoning: result.reasoning,
        keyInsights: result.keyInsights,
        recipientName,
        recipientPersona,
        emailType: normalizedInput.emailType,
        accountName: accountForEmail.company_name,
        contextOrigin: account ? 'crm_account_context' : 'brief_web_research',
        researchSources: briefResearch?.sourceUrls || [],
      };
    },
  });

  const agent = new Agent({
    name: 'Global SDR Chat Assistant',
    model: 'gpt-5.4',
    instructions: CHAT_SYSTEM_INSTRUCTIONS,
    tools: [webSearchTool(), writeProspectEmailTool],
  });

  const prompt = [
    'CURRENT_CONTEXT',
    buildContextBlock(account, prospect, context.perspective),
    '',
    'CONVERSATION_HISTORY',
    buildHistoryBlock(history),
    '',
    'USER_MESSAGE',
    userMessage.trim(),
    '',
    'Respond in markdown.',
  ].join('\n');

  const runResult = await run(agent, prompt);
  const assistantMarkdown = String(runResult.finalOutput || '').trim();
  const toolOutputs = extractToolOutputs(runResult);

  return {
    assistantMarkdown,
    toolOutputs,
  };
}
