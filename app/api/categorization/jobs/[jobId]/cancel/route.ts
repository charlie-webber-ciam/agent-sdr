import { NextResponse } from 'next/server';
import { cancelCategorizationJob } from '@/lib/db';

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

    cancelCategorizationJob(jobIdNum);
    console.log(`Categorization job ${jobIdNum} cancelled`);

    return NextResponse.json({ success: true, message: 'Categorization job cancelled' });
  } catch (error) {
    console.error('Failed to cancel categorization job:', error);
    return NextResponse.json({ error: 'Failed to cancel categorization job' }, { status: 500 });
  }
}
