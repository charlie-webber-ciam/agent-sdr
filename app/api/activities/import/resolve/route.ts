import { NextResponse } from 'next/server';
import { resolveAmbiguousActivityMatches } from '@/lib/activity-importer';
import { getActivityImportJob } from '@/lib/db';

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
    const job = getActivityImportJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      );
    }

    const result = resolveAmbiguousActivityMatches(jobId, resolutions, csvContent);

    return NextResponse.json({
      success: true,
      activitiesCreated: result.activitiesCreated,
    });
  } catch (error) {
    console.error('Activity resolve error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Resolution failed' },
      { status: 500 }
    );
  }
}
