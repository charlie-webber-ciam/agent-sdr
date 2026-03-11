import { NextRequest, NextResponse } from 'next/server';
import { startEmployeeCountJob } from '@/lib/employee-count-processor';
import { getEmployeeCountJob } from '@/lib/db';
import {
  assertProcessAction,
  parseJsonBody,
  parseJobId,
  processActionErrorResponse,
} from '@/lib/process-action-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody<{ jobId?: unknown; accounts?: unknown }>(req);
    const jobId = parseJobId(body.jobId);
    const { accounts } = body;
    assertProcessAction(Array.isArray(accounts), 400, 'Missing jobId or accounts array');
    assertProcessAction(
      accounts.every((account) => account && typeof account === 'object' && typeof (account as { account_name?: unknown }).account_name === 'string'),
      400,
      'Each account must include account_name'
    );

    // Verify job exists
    const job = getEmployeeCountJob(jobId);
    assertProcessAction(job, 404, 'Job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is already ${job.status}`);

    // Start processing in background
    startEmployeeCountJob(jobId, accounts as Array<{ account_name: string }>);

    return NextResponse.json({
      message: 'Processing started',
      jobId,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    return processActionErrorResponse('Start processing error', error, 'Failed to start processing');
  }
}
