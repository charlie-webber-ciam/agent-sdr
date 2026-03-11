import { NextResponse } from 'next/server';
import { getAccount, createAccountWorkingJob } from '@/lib/db';
import { processMapBuilderJob } from '@/lib/prospect-map-builder-processor';
import {
  assertProcessAction,
  parseJobId,
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

    const body = await request.json().catch(() => ({} as { userContext?: unknown }));
    const userContext = typeof body.userContext === 'string' ? body.userContext.trim() : '';

    const jobId = createAccountWorkingJob({
      account_id: accountId,
      job_type: 'map_builder',
      user_context: userContext || undefined,
    });

    runInBackground(`prospect-map/build job ${jobId}`, () => processMapBuilderJob(jobId));

    return NextResponse.json({ jobId });
  } catch (error) {
    return processActionErrorResponse('Failed to create map builder job', error, 'Failed to create job');
  }
}
