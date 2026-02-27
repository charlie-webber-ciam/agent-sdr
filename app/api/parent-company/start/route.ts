import { NextResponse } from 'next/server';
import { processParentCompanyJob } from '@/lib/parent-company-processor';

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Start processing in the background
    processParentCompanyJob(jobId).catch(error => {
      console.error(`Background parent company job failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: `Started parent company job ${jobId}`,
      jobId,
    });
  } catch (error) {
    console.error('Failed to start parent company job:', error);
    return NextResponse.json(
      { error: 'Failed to start parent company job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
