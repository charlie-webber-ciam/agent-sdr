import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateLeadReportEmail } from '@/lib/lead-report-email-writer';
import { leadReportGenerateRequestSchema } from '@/lib/lead-report-email-writer-schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = leadReportGenerateRequestSchema.parse(body);

    const result = await generateLeadReportEmail(input.lead, input.customInstructions);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Lead report email generation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate lead email',
      },
      { status: 500 }
    );
  }
}
