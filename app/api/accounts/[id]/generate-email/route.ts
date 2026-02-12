import { NextRequest, NextResponse } from 'next/server';
import { getAccount } from '@/lib/db';
import { generateEmail, EmailRequest } from '@/lib/email-writer-agent';
import { z } from 'zod';

const requestSchema = z.object({
  recipientName: z.string().min(1, 'Recipient name is required'),
  recipientPersona: z.string().min(1, 'Recipient persona is required'),
  emailType: z.enum(['cold', 'warm']),
  researchContext: z.enum(['auth0', 'okta']).default('auth0'),
  customInstructions: z.string().optional(),
  customContext: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+ requirement)
    const { id } = await params;

    // Parse and validate account ID
    const accountId = parseInt(id, 10);
    if (isNaN(accountId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // Fetch account from database
    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Ensure account has research data
    if (account.research_status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Account research not completed yet' },
        { status: 400 }
      );
    }

    // Build email request with research context
    const emailRequest: EmailRequest = {
      recipientName: validatedData.recipientName,
      recipientPersona: validatedData.recipientPersona,
      emailType: validatedData.emailType,
      researchContext: validatedData.researchContext,
      customInstructions: validatedData.customInstructions,
      customContext: validatedData.customContext,
      accountData: account,
    };

    // Generate email using agent
    const emailResult = await generateEmail(emailRequest);

    return NextResponse.json({
      success: true,
      email: emailResult,
    });
  } catch (error) {
    console.error('Generate email API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate email',
      },
      { status: 500 }
    );
  }
}
