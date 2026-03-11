import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createChatMessage,
  getAccount,
  getChatMessages,
  getOrCreateChatThread,
  getProspect,
  type ChatPerspective,
} from '@/lib/db';
import { runChatAssistant } from '@/lib/chat-agent';

const requestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required'),
  context: z.object({
    accountId: z.number().int().positive().nullable().optional(),
    prospectId: z.number().int().positive().nullable().optional(),
    perspective: z.enum(['auth0', 'okta']).default('auth0'),
  }),
});

function buildThreadTitle(input: {
  accountId?: number | null;
  prospectId?: number | null;
  perspective: ChatPerspective;
}): string {
  const account = input.accountId ? getAccount(input.accountId) : undefined;
  const prospect = input.prospectId ? getProspect(input.prospectId) : undefined;

  const perspectiveLabel = input.perspective === 'okta' ? 'Okta' : 'Auth0';
  if (prospect) {
    const prospectName = `${prospect.first_name} ${prospect.last_name}`;
    const company = account?.company_name || `Account ${prospect.account_id}`;
    return `${perspectiveLabel}: ${prospectName} @ ${company}`;
  }
  if (account) {
    return `${perspectiveLabel}: ${account.company_name}`;
  }
  return `${perspectiveLabel}: General Chat`;
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function extractEmailResult(toolOutputs: Array<{ toolName: string; output: unknown }>): Record<string, unknown> | null {
  for (const entry of toolOutputs) {
    if (entry.toolName !== 'write_prospect_email') continue;
    const output = entry.output;
    if (!output || typeof output !== 'object') continue;

    const candidate = output as Record<string, unknown>;
    if (typeof candidate.subject === 'string' && typeof candidate.body === 'string') {
      return candidate;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.parse(body);

    const context = {
      accountId: parsed.context.accountId ?? null,
      prospectId: parsed.context.prospectId ?? null,
      perspective: parsed.context.perspective,
    };

    const thread = getOrCreateChatThread({
      ...context,
      title: buildThreadTitle(context),
    });

    const existingMessages = getChatMessages(thread.id, 300);

    createChatMessage({
      threadId: thread.id,
      role: 'user',
      contentMarkdown: parsed.message,
    });

    const history = existingMessages.map((msg) => ({
      role: msg.role,
      content: msg.content_markdown || msg.content_json || '',
      toolName: msg.tool_name,
    }));

    const assistantRun = await runChatAssistant({
      context,
      userMessage: parsed.message,
      history,
    });

    const emailToolOutputs = assistantRun.toolOutputs.filter((output) => output.toolName === 'write_prospect_email');
    for (const output of emailToolOutputs) {
      createChatMessage({
        threadId: thread.id,
        role: 'tool',
        contentMarkdown: typeof output.output === 'string' ? output.output : null,
        contentJson: safeStringify(output.output),
        toolName: output.toolName,
      });
    }

    const emailResult = extractEmailResult(emailToolOutputs);
    const assistantPayload = emailResult
      ? safeStringify({
          type: 'email_result',
          ...emailResult,
        })
      : null;

    createChatMessage({
      threadId: thread.id,
      role: 'assistant',
      contentMarkdown: assistantRun.assistantMarkdown || 'I was unable to produce a response.',
      contentJson: assistantPayload,
    });

    const messages = getChatMessages(thread.id, 300);

    return NextResponse.json({
      success: true,
      thread,
      messages,
    });
  } catch (error) {
    console.error('Failed to process chat message:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process chat message',
      },
      { status: 500 }
    );
  }
}

