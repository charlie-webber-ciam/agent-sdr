import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { parseLeadReport } from '@/lib/lead-report-email-writer';

const requestSchema = z.object({
  rawText: z.string().min(1, 'rawText is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body);

    const result = await parseLeadReport(input.rawText);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Lead report parse error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse lead report',
      },
      { status: 500 }
    );
  }
}
