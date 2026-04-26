import { NextResponse } from 'next/server';
import { getAllBulkEmailJobs } from '@/lib/db';

/**
 * GET /api/bulk-email/jobs
 *
 * List recent bulk email jobs.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const jobs = getAllBulkEmailJobs(limit);
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error('Failed to list bulk email jobs:', error);
    return NextResponse.json({ error: 'Failed to list jobs' }, { status: 500 });
  }
}
