import { NextResponse } from 'next/server';
import { getAccount, createAccountWorkingJob, getAccountWorkingJobs } from '@/lib/db';
import { processAccountWorkingJob } from '@/lib/account-worker-processor';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseJobId(id, 'account ID');

    const account = getAccount(accountId);
    assertProcessAction(account, 404, 'Account not found');

    const body = await parseJsonBody<{ user_context?: unknown; research_context?: unknown }>(request);
    const { user_context, research_context } = body;
    const safeResearchContext = research_context === 'okta' ? 'okta' : 'auth0';

    const jobId = createAccountWorkingJob({
      account_id: accountId,
      user_context: typeof user_context === 'string' ? user_context : undefined,
      research_context: safeResearchContext,
    });

    runInBackground(`account working/start job ${jobId}`, () => processAccountWorkingJob(jobId));

    return NextResponse.json({ jobId });
  } catch (error) {
    return processActionErrorResponse('Failed to create account working job', error, 'Failed to create job');
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseJobId(id, 'account ID');

    const jobs = getAccountWorkingJobs(accountId);
    return NextResponse.json({ jobs });
  } catch (error) {
    return processActionErrorResponse('Failed to list account working jobs', error, 'Failed to list jobs');
  }
}
