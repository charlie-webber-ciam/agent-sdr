import { NextResponse } from 'next/server';
import { resolveAmbiguousMatches } from '@/lib/opportunity-importer';
import { getOpportunityImportJob } from '@/lib/db';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, resolutions, csvContent } = body;

    if (!jobId || !resolutions || !Array.isArray(resolutions)) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, resolutions' },
        { status: 400 }
      );
    }

    if (!csvContent) {
      return NextResponse.json(
        { error: 'csvContent is required to resolve ambiguous matches' },
        { status: 400 }
      );
    }

    // Verify job exists
    const job = getOpportunityImportJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      );
    }

    const result = resolveAmbiguousMatches(jobId, resolutions, csvContent);

    return NextResponse.json({
      success: true,
      prospectsCreated: result.prospectsCreated,
      opportunitiesCreated: result.opportunitiesCreated,
      championsTagged: result.championsTagged,
    });
  } catch (error) {
    console.error('Resolve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Resolution failed' },
      { status: 500 }
    );
  }
}
