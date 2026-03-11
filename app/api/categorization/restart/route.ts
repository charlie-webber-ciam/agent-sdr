import { NextResponse } from 'next/server';
import {
  getCategorizationJob,
  updateCategorizationJobStatus,
  createCategorizationJob,
  getAccountsForCategorization,
} from '@/lib/db';
import { processCategorizationJob } from '@/lib/categorization-processor';
import { parseFilters } from '@/lib/worker-error-utils';
import {
  assertProcessAction,
  parseJobId,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ jobId?: unknown; cancelOnly?: unknown }>(request);
    const jobId = parseJobId(body.jobId);
    const cancelOnly = Boolean(body.cancelOnly);

    const oldJob = getCategorizationJob(jobId);
    assertProcessAction(oldJob, 404, 'Categorization job not found');

    // Mark the old job as failed
    updateCategorizationJobStatus(jobId, 'failed');

    if (cancelOnly) {
      return NextResponse.json({ success: true, cancelled: true });
    }

    // Parse the original filters to create a new job with the same scope
    const filters = parseFilters(oldJob.filters, `Categorization restart job ${jobId} filters`);

    // Ensure we target uncategorized accounts (ones left over from the interrupted job)
    filters.uncategorizedOnly = true;

    // Get accounts that match the filters
    const accounts = getAccountsForCategorization(
      filters as Parameters<typeof getAccountsForCategorization>[0]
    );

    if (accounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No remaining accounts to categorize',
        newJobId: null,
      });
    }

    // Create a new categorization job
    const newJobId = createCategorizationJob(
      `Restart: ${oldJob.name}`,
      accounts.length,
      filters
    );

    // Start processing in background
    runInBackground(`categorization/restart job ${newJobId}`, () => processCategorizationJob(newJobId));

    return NextResponse.json({
      success: true,
      newJobId,
      accountCount: accounts.length,
    });
  } catch (error) {
    return processActionErrorResponse(
      'Failed to restart categorization job',
      error,
      'Failed to restart categorization job'
    );
  }
}
