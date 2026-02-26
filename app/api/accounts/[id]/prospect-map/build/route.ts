import { NextResponse } from 'next/server';
import { getAccount, createAccountWorkingJob } from '@/lib/db';
import { processMapBuilderJob } from '@/lib/prospect-map-builder-processor';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const jobId = createAccountWorkingJob({
      account_id: accountId,
      job_type: 'map_builder',
    });

    // Fire background processor (don't await)
    processMapBuilderJob(jobId).catch(err => {
      console.error(`Background map builder job ${jobId} error:`, err);
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Failed to create map builder job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job' },
      { status: 500 }
    );
  }
}
