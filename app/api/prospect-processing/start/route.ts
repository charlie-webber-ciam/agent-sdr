import { NextResponse } from 'next/server';
import { getProspectProcessingJob } from '@/lib/db';
import { processProspectJob } from '@/lib/prospect-processor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

    const job = getProspectProcessingJob(jobId);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (job.status !== 'pending') {
      return NextResponse.json({ error: `Job is already ${job.status}` }, { status: 400 });
    }

    // Start processing in background
    processProspectJob(jobId).catch(err => {
      console.error(`Background prospect processing job ${jobId} error:`, err);
    });

    return NextResponse.json({ message: 'Processing started', jobId });
  } catch (error) {
    console.error('Error starting prospect processing:', error);
    return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 });
  }
}
