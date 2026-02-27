import { NextResponse } from 'next/server';
import { isParentCompanyJobActive } from '@/lib/parent-company-processor';

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

    return NextResponse.json({ active: isParentCompanyJobActive(jobIdNum) });
  } catch (error) {
    console.error('Failed to check parent company job active status:', error);
    return NextResponse.json({ error: 'Failed to check job status' }, { status: 500 });
  }
}
