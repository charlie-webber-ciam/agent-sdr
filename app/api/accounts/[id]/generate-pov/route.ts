import { NextRequest, NextResponse } from 'next/server';
import { getAccount } from '@/lib/db';
import { generatePov, PovRequest } from '@/lib/pov-writer-agent';
import { z } from 'zod';

const requestSchema = z.object({
  recipientName: z.string().optional(),
  recipientTitle: z.string().min(1, 'Recipient title is required'),
  outputType: z.enum(['email', 'document']),
  researchContext: z.enum(['auth0', 'okta']).default('auth0'),
  customInstructions: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const accountId = parseInt(id, 10);
    if (isNaN(accountId)) {
      return NextResponse.json({ success: false, error: 'Invalid account ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    if (account.research_status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Account research not completed yet' },
        { status: 400 }
      );
    }

    const povRequest: PovRequest = {
      recipientName: validatedData.recipientName,
      recipientTitle: validatedData.recipientTitle,
      outputType: validatedData.outputType,
      researchContext: validatedData.researchContext,
      customInstructions: validatedData.customInstructions,
      accountData: account,
    };

    const pov = await generatePov(povRequest);

    return NextResponse.json({ success: true, pov });
  } catch (error) {
    console.error('Generate POV API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate POV',
      },
      { status: 500 }
    );
  }
}
