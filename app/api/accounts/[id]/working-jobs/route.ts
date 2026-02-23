import { NextResponse } from 'next/server';
import { getAccount, createAccountWorkingJob, getAccountWorkingJobs } from '@/lib/db';
import { processAccountWorkingJob } from '@/lib/account-worker-processor';

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

    const body = await request.json();
    const { user_context, research_context } = body;

    const jobId = createAccountWorkingJob({
      account_id: accountId,
      user_context: user_context || undefined,
      research_context: research_context || 'auth0',
    });

    // Fire background processor (don't await)
    processAccountWorkingJob(jobId).catch(err => {
      console.error(`Background account working job ${jobId} error:`, err);
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Failed to create account working job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const jobs = getAccountWorkingJobs(accountId);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Failed to list account working jobs:', error);
    return NextResponse.json(
      { error: 'Failed to list jobs' },
      { status: 500 }
    );
  }
}
