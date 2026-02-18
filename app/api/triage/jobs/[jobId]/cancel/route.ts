import { NextResponse } from 'next/server';
import { cancelTriageJob } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    cancelTriageJob(jobIdNum);
    console.log(`Triage job ${jobIdNum} cancelled`);

    return NextResponse.json({ success: true, message: 'Triage job cancelled' });
  } catch (error) {
    console.error('Failed to cancel triage job:', error);
    return NextResponse.json({ error: 'Failed to cancel triage job' }, { status: 500 });
  }
}
