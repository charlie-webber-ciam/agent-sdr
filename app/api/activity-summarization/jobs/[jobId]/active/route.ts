import { NextResponse } from 'next/server';
import { isActivitySummarizationJobActive } from '@/lib/activity-summarization-processor';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    return NextResponse.json({ active: isActivitySummarizationJobActive(jobIdNum) });
  } catch (error) {
    console.error('Failed to check activity summarization job active status:', error);
    return NextResponse.json({ error: 'Failed to check job status' }, { status: 500 });
  }
}
