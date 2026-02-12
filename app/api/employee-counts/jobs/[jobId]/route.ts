import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeCountJob, getEmployeeCountResults } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = getEmployeeCountJob(parseInt(jobId));

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get all results
    const results = getEmployeeCountResults(parseInt(jobId));

    return NextResponse.json({
      job,
      results,
      progress: {
        total: job.total_accounts,
        processed: job.processed_count,
        failed: job.failed_count,
        percentage: Math.round((job.processed_count / job.total_accounts) * 100),
      },
    });
  } catch (error) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job' },
      { status: 500 }
    );
  }
}
