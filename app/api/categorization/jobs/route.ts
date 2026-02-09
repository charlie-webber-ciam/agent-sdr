import { NextResponse } from 'next/server';
import { getAllCategorizationJobs } from '@/lib/db';

/**
 * GET /api/categorization/jobs
 *
 * Returns a list of recent categorization jobs.
 *
 * Query params:
 * - limit: number (default: 10) - number of jobs to return
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const jobs = getAllCategorizationJobs(limit);

    return NextResponse.json({
      success: true,
      jobs,
    });

  } catch (error) {
    console.error('Failed to get categorization jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to get categorization jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
