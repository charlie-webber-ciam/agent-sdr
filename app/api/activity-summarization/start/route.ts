import { NextResponse } from 'next/server';
import { processActivitySummarizationJob } from '@/lib/activity-summarization-processor';

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Start processing in the background
    processActivitySummarizationJob(jobId).catch(error => {
      console.error(`Background activity summarization failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: `Started activity summarization job ${jobId}`,
      jobId,
    });
  } catch (error) {
    console.error('Failed to start activity summarization job:', error);
    return NextResponse.json(
      { error: 'Failed to start activity summarization job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
