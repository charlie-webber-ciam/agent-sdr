import { NextResponse } from 'next/server';
import { processPreprocessingJob } from '@/lib/preprocess-processor';
import { PROCESSING_CONFIG } from '@/lib/config';
import { getPreprocessingJob } from '@/lib/db';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';
import type { CompanyInput } from '@/lib/preprocess-agent';

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{
      jobId?: unknown;
      companies?: unknown;
      concurrency?: unknown;
    }>(request);
    const { jobId, companies, concurrency } = body;
    const parsedJobId = parseJobId(jobId);
    assertProcessAction(Array.isArray(companies), 400, 'Companies array is required');
    const typedCompanies = companies as CompanyInput[];
    const job = getPreprocessingJob(parsedJobId);
    assertProcessAction(job, 404, 'Preprocessing job not found');
    assertProcessAction(job.status === 'pending', 409, `Job is ${job.status}. Only pending jobs can be started.`);

    // Validate concurrency
    let selectedConcurrency = Math.min(PROCESSING_CONFIG.concurrency, 50);
    if (concurrency !== undefined) {
      const parsedConcurrency =
        typeof concurrency === 'number' ? concurrency : parseInt(String(concurrency), 10);
      assertProcessAction(Number.isInteger(parsedConcurrency), 400, 'Concurrency must be an integer');
      selectedConcurrency = Math.min(Math.max(parsedConcurrency, 1), 50);
    }

    console.log(`Starting preprocessing for job ${parsedJobId}:`);
    console.log(`  Companies: ${typedCompanies.length}`);
    console.log(`  Concurrency: ${selectedConcurrency}`);

    runInBackground(
      `preprocess/start job ${parsedJobId}`,
      () => processPreprocessingJob(parsedJobId, typedCompanies, selectedConcurrency)
    );

    return NextResponse.json({
      success: true,
      message: 'Preprocessing started',
      concurrency: selectedConcurrency,
    });
  } catch (error) {
    return processActionErrorResponse('Failed to start preprocessing', error, 'Failed to start preprocessing');
  }
}
