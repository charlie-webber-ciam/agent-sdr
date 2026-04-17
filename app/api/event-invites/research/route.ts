import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { researchEventRelevance } from '@/lib/event-invitation-writer';
import { eventInvitationStandaloneInputSchema } from '@/lib/event-invitation-writer-schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = eventInvitationStandaloneInputSchema.parse(body);

    const brief = await researchEventRelevance(input);

    return NextResponse.json({
      success: true,
      brief,
    });
  } catch (error) {
    console.error('Event invitation research error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to research company for event invitation',
      },
      { status: 500 }
    );
  }
}
