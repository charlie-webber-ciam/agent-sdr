import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getChatMessages,
  getChatThreadByContext,
  listChatThreads,
  type ChatPerspective,
} from '@/lib/db';

const querySchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
  prospectId: z.coerce.number().int().positive().optional(),
  perspective: z.enum(['auth0', 'okta']).default('auth0'),
  scoped: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      accountId: searchParams.get('accountId') ?? undefined,
      prospectId: searchParams.get('prospectId') ?? undefined,
      perspective: (searchParams.get('perspective') || 'auth0') as ChatPerspective,
      scoped: searchParams.get('scoped') === 'true' ? true : undefined,
    });

    const scoped = parsed.scoped === true || parsed.accountId !== undefined || parsed.prospectId !== undefined;

    if (scoped) {
      const thread = getChatThreadByContext({
        accountId: parsed.accountId ?? null,
        prospectId: parsed.prospectId ?? null,
        perspective: parsed.perspective,
      });

      return NextResponse.json({
        success: true,
        thread: thread || null,
        messages: thread ? getChatMessages(thread.id, 300) : [],
      });
    }

    const threads = listChatThreads({
      perspective: parsed.perspective,
      limit: 30,
    });

    return NextResponse.json({
      success: true,
      threads,
    });
  } catch (error) {
    console.error('Failed to load chat threads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load chat threads' },
      { status: 500 }
    );
  }
}
