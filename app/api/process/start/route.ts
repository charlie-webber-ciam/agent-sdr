import { NextResponse } from 'next/server';
import { processJob } from '@/lib/processor';
import { PROCESSING_CONFIG } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, mode, concurrency } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Validate mode
    const validModes = ['parallel', 'sequential'];
    if (mode && !validModes.includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode. Must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate concurrency
    if (concurrency !== undefined) {
      const concurrencyNum = parseInt(concurrency, 10);
      if (isNaN(concurrencyNum) || concurrencyNum < 1 || concurrencyNum > 10) {
        return NextResponse.json(
          { error: 'Concurrency must be between 1 and 10' },
          { status: 400 }
        );
      }
    }

    // Determine processing mode
    const selectedMode = mode || (PROCESSING_CONFIG.enableParallel ? 'parallel' : 'sequential');
    const selectedConcurrency = concurrency || PROCESSING_CONFIG.concurrency;

    console.log(`Starting processing for job ${jobId}:`);
    console.log(`  Mode: ${selectedMode}`);
    console.log(`  Concurrency: ${selectedConcurrency}`);

    // Start processing in background (don't await)
    processJob(jobId, {
      mode: selectedMode,
      concurrency: selectedConcurrency,
    }).catch(error => {
      console.error(`Background processing failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'Processing started',
      mode: selectedMode,
      concurrency: selectedConcurrency,
    });
  } catch (error) {
    console.error('Failed to start processing:', error);
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    );
  }
}
