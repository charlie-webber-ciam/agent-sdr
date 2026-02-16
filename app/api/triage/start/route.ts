import { NextResponse } from 'next/server';
import {
  getJob,
  getAccountsByJob,
  createTriageJob,
} from '@/lib/db';
import { processTriageJob } from '@/lib/triage-processor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, concurrency, model } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    // Verify the processing job exists
    const processingJob = getJob(jobId);
    if (!processingJob) {
      return NextResponse.json(
        { error: 'Processing job not found' },
        { status: 404 }
      );
    }

    // Get accounts for this job
    const accounts = getAccountsByJob(jobId);
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found for this job' },
        { status: 400 }
      );
    }

    // Create a triage job
    const triageJobId = createTriageJob(
      processingJob.filename,
      accounts.length
    );

    // Start processing in the background
    processTriageJob(
      triageJobId,
      jobId,
      concurrency || undefined,
      model || undefined
    ).catch((error) => {
      console.error(`Background triage processing failed for job ${triageJobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      triageJobId,
      processingJobId: jobId,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    console.error('Error starting triage:', error);
    return NextResponse.json(
      { error: 'Failed to start triage' },
      { status: 500 }
    );
  }
}
