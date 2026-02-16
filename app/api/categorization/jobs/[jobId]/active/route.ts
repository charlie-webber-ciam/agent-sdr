import { NextResponse } from 'next/server';
import { isCategorizationJobActive } from '@/lib/categorization-processor';

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

    return NextResponse.json({ active: isCategorizationJobActive(jobIdNum) });
  } catch (error) {
    console.error('Failed to check categorization job active status:', error);
    return NextResponse.json({ error: 'Failed to check job status' }, { status: 500 });
  }
}
