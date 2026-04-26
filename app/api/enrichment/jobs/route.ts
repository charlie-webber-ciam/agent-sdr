import { NextResponse } from 'next/server';
import { getAllEnrichmentJobs } from '@/lib/db';

/**
 * GET /api/enrichment/jobs
 *
 * List recent enrichment jobs.
 *
 * Query params:
 * - limit: number (default: 10)
 * - type: string (optional, filter by enrichment type)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const type = searchParams.get('type') || undefined;

    const jobs = getAllEnrichmentJobs(limit, type);

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error('Failed to get enrichment jobs:', error);
    return NextResponse.json(
      { error: 'Failed to get enrichment jobs' },
      { status: 500 }
    );
  }
}
