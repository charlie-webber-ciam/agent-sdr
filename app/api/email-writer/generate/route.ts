import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateStandaloneEmailDrafts } from '@/lib/standalone-email-writer';
import { researchBriefSchema } from '@/lib/standalone-email-writer-schema';

const requestSchema = z.object({
  brief: researchBriefSchema,
  customInstructions: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body);

    const drafts = await generateStandaloneEmailDrafts(input.brief, input.customInstructions);

    return NextResponse.json({
      success: true,
      drafts,
    });
  } catch (error) {
    console.error('Standalone email writer draft generation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate drafts',
      },
      { status: 500 }
    );
  }
}
