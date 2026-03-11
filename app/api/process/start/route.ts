import { NextResponse } from 'next/server';
import { processJob } from '@/lib/processor';
import { PROCESSING_CONFIG } from '@/lib/config';
import type { OktaPatch } from '@/lib/okta-categorizer';
import { getJob } from '@/lib/db';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
  ProcessActionError,
} from '@/lib/process-action-utils';

const VALID_PATCHES: OktaPatch[] = ['emerging', 'crp', 'ent', 'stg', 'pubsec'];
const VALID_MODES = ['parallel', 'sequential'] as const;
type ProcessMode = (typeof VALID_MODES)[number];

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{
      jobId?: unknown;
      mode?: unknown;
      concurrency?: unknown;
      oktaPatch?: unknown;
    }>(request);
    const { jobId, mode, concurrency, oktaPatch } = body;
    const jobIdNum = parseJobId(jobId, 'jobId');

    if (mode !== undefined && !VALID_MODES.includes(mode as ProcessMode)) {
      throw new ProcessActionError(400, `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`);
    }

    let selectedConcurrency = PROCESSING_CONFIG.concurrency;
    if (concurrency !== undefined) {
      const parsedConcurrency =
        typeof concurrency === 'number' ? concurrency : parseInt(String(concurrency), 10);
      assertProcessAction(
        Number.isInteger(parsedConcurrency) && parsedConcurrency >= 1 && parsedConcurrency <= 10,
        400,
        'Concurrency must be between 1 and 10'
      );
      selectedConcurrency = parsedConcurrency;
    }

    if (oktaPatch !== undefined && (typeof oktaPatch !== 'string' || !VALID_PATCHES.includes(oktaPatch as OktaPatch))) {
      throw new ProcessActionError(400, `Invalid oktaPatch. Must be one of: ${VALID_PATCHES.join(', ')}`);
    }

    const job = getJob(jobIdNum);
    assertProcessAction(job, 404, 'Job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is ${job.status}. Only pending jobs can be started.`);

    const selectedMode: ProcessMode = (mode as ProcessMode | undefined)
      || (PROCESSING_CONFIG.enableParallel ? 'parallel' : 'sequential');

    console.log(`Starting processing for job ${jobIdNum}:`);
    console.log(`  Mode: ${selectedMode}`);
    console.log(`  Concurrency: ${selectedConcurrency}`);
    if (oktaPatch) console.log(`  Okta Patch: ${oktaPatch}`);

    runInBackground(`process/start job ${jobIdNum}`, () => processJob(jobIdNum, {
      mode: selectedMode as 'parallel' | 'sequential',
      concurrency: selectedConcurrency,
      oktaPatch: oktaPatch as OktaPatch | undefined,
    }));

    return NextResponse.json({
      success: true,
      message: 'Processing started',
      mode: selectedMode,
      concurrency: selectedConcurrency,
    });
  } catch (error) {
    return processActionErrorResponse('Failed to start processing', error, 'Failed to start processing');
  }
}
