import { NextResponse } from 'next/server';
import { getPreprocessingJob, getPreprocessingResults } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = getPreprocessingJob(jobIdNum);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get results to show details
    const results = getPreprocessingResults(jobIdNum);
    const validResults = results.filter(r => r.should_include === 1);
    const duplicates = results.filter(r => r.is_duplicate === 1);
    const inactive = results.filter(r => r.is_active === 0 && r.is_duplicate === 0);

    return NextResponse.json({
      ...job,
      results: {
        total: results.length,
        valid: validResults.length,
        duplicates: duplicates.length,
        inactive: inactive.length,
        failed: job.failed_count,
      },
    });
  } catch (error) {
    console.error('Failed to get preprocessing job:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
