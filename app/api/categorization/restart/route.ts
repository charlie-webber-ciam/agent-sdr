import { NextResponse } from 'next/server';
import {
  getCategorizationJob,
  updateCategorizationJobStatus,
  createCategorizationJob,
  getAccountsForCategorization,
} from '@/lib/db';
import { processCategorizationJob } from '@/lib/categorization-processor';

export async function POST(request: Request) {
  try {
    const { jobId, cancelOnly } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const oldJob = getCategorizationJob(jobId);
    if (!oldJob) {
      return NextResponse.json({ error: 'Categorization job not found' }, { status: 404 });
    }

    // Mark the old job as failed
    updateCategorizationJobStatus(jobId, 'failed');

    if (cancelOnly) {
      return NextResponse.json({ success: true, cancelled: true });
    }

    // Parse the original filters to create a new job with the same scope
    const filters = oldJob.filters ? JSON.parse(oldJob.filters) : {};

    // Ensure we target uncategorized accounts (ones left over from the interrupted job)
    filters.uncategorizedOnly = true;

    // Get accounts that match the filters
    const accounts = getAccountsForCategorization(filters);

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
    processCategorizationJob(newJobId).catch((error) => {
      console.error(`Background categorization restart failed for job ${newJobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      newJobId,
      accountCount: accounts.length,
    });
  } catch (error) {
    console.error('Failed to restart categorization job:', error);
    return NextResponse.json(
      { error: 'Failed to restart categorization job' },
      { status: 500 }
    );
  }
}
