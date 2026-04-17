import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { researchCompanyBrief } from '@/lib/standalone-email-writer';
import { emailWriterResearchInputSchema } from '@/lib/standalone-email-writer-schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = emailWriterResearchInputSchema.parse(body);

    const brief = await researchCompanyBrief(input);

    return NextResponse.json({
      success: true,
      brief,
    });
  } catch (error) {
    console.error('Standalone email writer research error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to research company',
      },
      { status: 500 }
    );
  }
}
