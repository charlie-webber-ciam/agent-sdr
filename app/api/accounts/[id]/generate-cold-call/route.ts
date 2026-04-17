import { NextRequest, NextResponse } from 'next/server';
import { getAccount, getAccountNotes, getAccountOverview } from '@/lib/db';
import { buildOverviewRecordFromStorage } from '@/lib/account-overview';
import { generateColdCall, ColdCallRequest } from '@/lib/cold-call-agent';
import { z } from 'zod';

const requestSchema = z.object({
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientPersona: z.string().min(1, 'Recipient persona is required'),
  researchContext: z.enum(['auth0', 'okta']).default('auth0'),
  customInstructions: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const accountId = parseInt(id, 10);
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    if (account.research_status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Account research not completed yet' },
        { status: 400 }
      );
    }

    const overviewRow = getAccountOverview(accountId);
    const overview = overviewRow ? buildOverviewRecordFromStorage(overviewRow) : null;
    const dbNotes = getAccountNotes(accountId);
    const notes = dbNotes.map((n) => ({ content: n.content, createdAt: n.created_at }));

    const coldCallRequest: ColdCallRequest = {
      recipientName: validatedData.recipientName,
      recipientPersona: validatedData.recipientPersona,
      researchContext: validatedData.researchContext,
      customInstructions: validatedData.customInstructions,
      accountData: account,
      overview,
      notes,
      model: validatedData.model,
    };

    const coldCallResult = await generateColdCall(coldCallRequest);

    return NextResponse.json({
      success: true,
      coldCall: coldCallResult,
    });
  } catch (error) {
    console.error('Generate cold call API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate cold call script',
      },
      { status: 500 }
    );
  }
}
