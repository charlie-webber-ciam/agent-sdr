import { NextRequest, NextResponse } from 'next/server';
import {
  getAccountsByIds,
  resetAccountToPending,
  createJob,
  updateAccountJobId,
} from '@/lib/db';
import { processJob } from '@/lib/processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountIds } = body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: 'accountIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Get all accounts by IDs
    const accounts = getAccountsByIds(accountIds);

    // Validate all accounts exist
    if (accounts.length !== accountIds.length) {
      return NextResponse.json(
        { error: 'Some accounts not found' },
        { status: 404 }
      );
    }

    // Validate all accounts are failed
    const nonFailedAccounts = accounts.filter((a) => a.research_status !== 'failed');
    if (nonFailedAccounts.length > 0) {
      return NextResponse.json(
        {
          error: 'Only failed accounts can be retried',
          nonFailedAccountIds: nonFailedAccounts.map((a) => a.id),
        },
        { status: 400 }
      );
    }

    // Reset all accounts to pending
    accounts.forEach((account) => {
      resetAccountToPending(account.id);
    });

    // Create a new processing job for bulk retry
    const timestamp = new Date().toLocaleString();
    const jobFilename = `Bulk Retry - ${accounts.length} accounts - ${timestamp}`;
    const newJobId = createJob(jobFilename, accounts.length);

    // Update all accounts' job_id
    accounts.forEach((account) => {
      updateAccountJobId(account.id, newJobId);
    });

    // Start processing in the background
    processJob(newJobId).catch((error) => {
      console.error(`Background processing failed for job ${newJobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId: newJobId,
      accountCount: accounts.length,
      redirectUrl: `/processing/${newJobId}`,
    });
  } catch (error) {
    console.error('Error retrying accounts:', error);
    return NextResponse.json(
      { error: 'Failed to retry accounts' },
      { status: 500 }
    );
  }
}
