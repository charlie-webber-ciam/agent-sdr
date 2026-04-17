import { NextResponse } from 'next/server';
import {
  getJob,
  getAccountsByJob,
  createTriageJob,
} from '@/lib/db';
import { processTriageJob } from '@/lib/triage-processor';
import type { OktaPatch } from '@/lib/okta-categorizer';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  ProcessActionError,
  runInBackground,
} from '@/lib/process-action-utils';

const VALID_PATCHES: OktaPatch[] = ['emerging', 'crp', 'ent', 'stg', 'pubsec'];

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{
      jobId?: unknown;
      concurrency?: unknown;
      model?: unknown;
      oktaPatch?: unknown;
    }>(request);
    const { jobId, concurrency, model, oktaPatch: rawPatch } = body;
    const parsedJobId = parseJobId(jobId);
    const oktaPatch: OktaPatch | undefined =
      typeof rawPatch === 'string' && VALID_PATCHES.includes(rawPatch as OktaPatch)
        ? (rawPatch as OktaPatch)
        : undefined;
    if (rawPatch !== undefined && !oktaPatch) {
      throw new ProcessActionError(400, `Invalid oktaPatch. Must be one of: ${VALID_PATCHES.join(', ')}`);
    }

    let parsedConcurrency: number | undefined;
    if (concurrency !== undefined) {
      const maybeConcurrency =
        typeof concurrency === 'number' ? concurrency : parseInt(String(concurrency), 10);
      assertProcessAction(
        Number.isInteger(maybeConcurrency) && maybeConcurrency >= 1 && maybeConcurrency <= 50,
        400,
        'concurrency must be an integer between 1 and 50'
      );
      parsedConcurrency = maybeConcurrency;
    }

    // Verify the processing job exists
    const processingJob = getJob(parsedJobId);
    assertProcessAction(processingJob, 404, 'Processing job not found');

    // Get accounts for this job
    const accounts = getAccountsByJob(parsedJobId);
    assertProcessAction(accounts.length > 0, 400, 'No accounts found for this job');

    // Create a triage job
    const triageJobId = createTriageJob(
      processingJob.filename,
      accounts.length,
      parsedJobId
    );

    runInBackground(`triage/start job ${triageJobId}`, () =>
      processTriageJob(
        triageJobId,
        parsedJobId,
        parsedConcurrency,
        typeof model === 'string' ? model : undefined,
        oktaPatch
      )
    );

    return NextResponse.json({
      success: true,
      triageJobId,
      processingJobId: parsedJobId,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    return processActionErrorResponse('Error starting triage', error, 'Failed to start triage');
  }
}
