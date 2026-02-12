import { NextResponse } from 'next/server';
import { processPreprocessingJob } from '@/lib/preprocess-processor';
import { PROCESSING_CONFIG } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, companies, concurrency } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    if (!companies || !Array.isArray(companies)) {
      return NextResponse.json(
        { error: 'Companies array is required' },
        { status: 400 }
      );
    }

    // Validate concurrency
    const selectedConcurrency = concurrency
      ? Math.min(Math.max(parseInt(concurrency, 10), 1), 10)
      : Math.min(PROCESSING_CONFIG.concurrency, 10);

    console.log(`Starting preprocessing for job ${jobId}:`);
    console.log(`  Companies: ${companies.length}`);
    console.log(`  Concurrency: ${selectedConcurrency}`);

    // Start processing in background
    processPreprocessingJob(jobId, companies, selectedConcurrency).catch(error => {
      console.error(`Background preprocessing failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: 'Preprocessing started',
      concurrency: selectedConcurrency,
    });
  } catch (error) {
    console.error('Failed to start preprocessing:', error);
    return NextResponse.json(
      { error: 'Failed to start preprocessing' },
      { status: 500 }
    );
  }
}
