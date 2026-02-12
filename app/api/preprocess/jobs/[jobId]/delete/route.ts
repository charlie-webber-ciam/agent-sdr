import { NextResponse } from 'next/server';
import { deletePreprocessingJob } from '@/lib/db';

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

    const success = deletePreprocessingJob(jobIdNum);

    if (!success) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    console.log(`Preprocessing job ${jobIdNum} deleted`);

    return NextResponse.json({ success: true, message: 'Job deleted' });
  } catch (error) {
    console.error('Failed to delete preprocessing job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
