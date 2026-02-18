import { NextResponse } from 'next/server';
import { deleteCategorizationJob } from '@/lib/db';

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

    const success = deleteCategorizationJob(jobIdNum);

    if (!success) {
      return NextResponse.json({ error: 'Categorization job not found' }, { status: 404 });
    }

    console.log(`Categorization job ${jobIdNum} deleted`);

    return NextResponse.json({ success: true, message: 'Categorization job deleted' });
  } catch (error) {
    console.error('Failed to delete categorization job:', error);
    return NextResponse.json({ error: 'Failed to delete categorization job' }, { status: 500 });
  }
}
