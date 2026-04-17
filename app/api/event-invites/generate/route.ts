import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getAccount } from '@/lib/db';
import { buildBriefFromAccount, generateEventInvitations } from '@/lib/event-invitation-writer';
import { eventResearchBriefSchema } from '@/lib/event-invitation-writer-schema';

const requestSchema = z.object({
  brief: eventResearchBriefSchema.optional(),
  accountId: z.number().positive().optional(),
  eventDescription: z.string().min(50),
  registrationLink: z.string().url(),
  prospectName: z.string().min(1),
  customInstructions: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body);

    let brief = input.brief;

    if (!brief && input.accountId) {
      const account = getAccount(input.accountId);
      if (!account) {
        return NextResponse.json(
          { success: false, error: 'Account not found' },
          { status: 404 }
        );
      }
      brief = buildBriefFromAccount(account, input.eventDescription);
    }

    if (!brief) {
      return NextResponse.json(
        { success: false, error: 'Either a research brief or an account ID is required' },
        { status: 400 }
      );
    }

    const invitations = await generateEventInvitations(
      brief,
      input.eventDescription,
      input.registrationLink,
      input.prospectName,
      input.customInstructions
    );

    return NextResponse.json({
      success: true,
      invitations,
      brief,
    });
  } catch (error) {
    console.error('Event invitation generation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate event invitations',
      },
      { status: 500 }
    );
  }
}
