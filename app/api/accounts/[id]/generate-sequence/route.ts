import { NextRequest, NextResponse } from 'next/server';
import { getAccount } from '@/lib/db';
import { generateSequence, SequenceRequest } from '@/lib/sequence-writer-agent';
import { z } from 'zod';

const requestSchema = z.object({
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientPersona: z.string().min(1, 'Recipient persona is required'),
  researchContext: z.enum(['auth0', 'okta']).default('auth0'),
  customInstructions: z.string().optional(),
  sequenceLength: z.number().min(3).max(5).default(5),
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

    const sequenceRequest: SequenceRequest = {
      recipientName: validatedData.recipientName,
      recipientPersona: validatedData.recipientPersona,
      researchContext: validatedData.researchContext,
      customInstructions: validatedData.customInstructions,
      sequenceLength: validatedData.sequenceLength,
      accountData: account,
    };

    const sequenceResult = await generateSequence(sequenceRequest);

    return NextResponse.json({
      success: true,
      sequence: sequenceResult,
    });
  } catch (error) {
    console.error('Generate sequence API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate sequence',
      },
      { status: 500 }
    );
  }
}
