import { NextResponse } from 'next/server';
import { processHqStateJob } from '@/lib/hq-state-processor';

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Start processing in the background
    processHqStateJob(jobId).catch(error => {
      console.error(`Background HQ state job failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: `Started HQ state job ${jobId}`,
      jobId,
    });
  } catch (error) {
    console.error('Failed to start HQ state job:', error);
    return NextResponse.json(
      { error: 'Failed to start HQ state job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
