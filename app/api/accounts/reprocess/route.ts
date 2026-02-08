import { NextResponse } from 'next/server';
import {
  getAccountsByIds,
  resetAccountsToPending,
  createJob,
  updateAccountJobId,
} from '@/lib/db';
import { processJob } from '@/lib/processor';

export async function POST(request: Request) {
  try {
    const { accountIds } = await request.json();

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: 'Account IDs array is required' },
        { status: 400 }
      );
    }

    if (accountIds.length > 500) {
      return NextResponse.json(
        { error: 'Cannot reprocess more than 500 accounts at once' },
        { status: 400 }
      );
    }

    // Verify accounts exist
    const accounts = getAccountsByIds(accountIds);

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No valid accounts found' },
        { status: 404 }
      );
    }

    // Create a new job for reprocessing
    const jobId = createJob(
      `Reprocess ${accounts.length} accounts`,
      accounts.length
    );

    // Update accounts to belong to this new job and reset to pending
    for (const account of accounts) {
      updateAccountJobId(account.id, jobId);
    }

    // Reset all accounts to pending status
    const resetCount = resetAccountsToPending(accountIds);

    // Start processing in background (don't await)
    processJob(jobId).catch(error => {
      console.error(`Background processing failed for job ${jobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: `Created new job to reprocess ${resetCount} accounts`,
      resetCount,
    });
  } catch (error) {
    console.error('Failed to reprocess accounts:', error);
    return NextResponse.json(
      { error: 'Failed to reprocess accounts' },
      { status: 500 }
    );
  }
}
