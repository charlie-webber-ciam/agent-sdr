import { NextResponse } from 'next/server';
import { processCategorizationJob } from '@/lib/categorization-processor';

/**
 * POST /api/categorization/start
 *
 * Starts processing a categorization job in the background.
 *
 * Body:
 * - jobId: number - the categorization job ID to process
 */
export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Start processing in the background
    processCategorizationJob(jobId).catch(error => {
      console.error(`Background categorization processing failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: `Started categorization job ${jobId}`,
      jobId,
    });

  } catch (error) {
    console.error('Failed to start categorization job:', error);
    return NextResponse.json(
      {
        error: 'Failed to start categorization job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
