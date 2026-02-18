import { NextResponse } from 'next/server';
import { deleteTriageJob } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const success = deleteTriageJob(jobIdNum);

    if (!success) {
      return NextResponse.json({ error: 'Triage job not found' }, { status: 404 });
    }

    console.log(`Triage job ${jobIdNum} deleted`);

    return NextResponse.json({ success: true, message: 'Triage job deleted' });
  } catch (error) {
    console.error('Failed to delete triage job:', error);
    return NextResponse.json({ error: 'Failed to delete triage job' }, { status: 500 });
  }
}
