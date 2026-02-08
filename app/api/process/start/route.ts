import { NextResponse } from 'next/server';
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

    // Start processing in background (don't await)
    processJob(jobId).catch(error => {
      console.error(`Background processing failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'Processing started',
    });
  } catch (error) {
    console.error('Failed to start processing:', error);
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    );
  }
}
