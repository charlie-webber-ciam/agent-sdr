import { NextResponse } from 'next/server';

import { getVectorIndexJob } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const id = parseInt(jobId, 10);

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 });
    }

    const job = getVectorIndexJob(id);
    if (!job) {
      return NextResponse.json({ error: 'Vector index job not found.' }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('Error fetching vector backfill job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch vector backfill job' },
      { status: 500 }
    );
  }
}
