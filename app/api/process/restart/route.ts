import { NextResponse } from 'next/server';
import { getJob, getPendingAccounts, resetJobToPending } from '@/lib/db';
import { processJob } from '@/lib/processor';

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Verify job exists
    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if there are pending accounts in this job
    const pendingAccounts = getPendingAccounts(jobId);

    if (pendingAccounts.length === 0) {
      return NextResponse.json(
        { error: 'No pending accounts found for this job' },
        { status: 400 }
      );
    }

    // Reset job status to pending
    resetJobToPending(jobId);

    // Start processing in background (don't await)
    processJob(jobId).catch(error => {
      console.error(`Background processing failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: `Restarted processing for ${pendingAccounts.length} pending accounts`,
      pendingCount: pendingAccounts.length,
    });
  } catch (error) {
    console.error('Failed to restart processing:', error);
    return NextResponse.json(
      { error: 'Failed to restart processing' },
      { status: 500 }
    );
  }
}
