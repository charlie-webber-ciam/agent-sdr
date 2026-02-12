import { NextResponse } from 'next/server';
import { deleteProcessingJob } from '@/lib/db';

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

    const success = deleteProcessingJob(jobIdNum);

    if (!success) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log(`Job ${jobIdNum} deleted`);

    return NextResponse.json({ success: true, message: 'Job deleted' });
  } catch (error) {
    console.error('Failed to delete job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
