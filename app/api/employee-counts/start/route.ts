import { NextRequest, NextResponse } from 'next/server';
import { startEmployeeCountJob } from '@/lib/employee-count-processor';
import { getEmployeeCountJob } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { jobId, accounts } = await req.json();

    if (!jobId || !accounts || !Array.isArray(accounts)) {
      return NextResponse.json(
        { error: 'Missing jobId or accounts array' },
        { status: 400 }
      );
    }

    // Verify job exists
    const job = getEmployeeCountJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'pending') {
      return NextResponse.json(
        { error: `Job is already ${job.status}` },
        { status: 400 }
      );
    }

    // Start processing in background
    startEmployeeCountJob(jobId, accounts);

    return NextResponse.json({
      message: 'Processing started',
      jobId,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    console.error('Start processing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start processing' },
      { status: 500 }
    );
  }
}
