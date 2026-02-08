import { NextRequest, NextResponse } from 'next/server';
import {
  getAccount,
  resetAccountToPending,
  createJob,
  updateAccountJobId,
} from '@/lib/db';
import { processJob } from '@/lib/processor';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    // Get the account
    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Validate that account is failed
    if (account.research_status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed accounts can be retried' },
        { status: 400 }
      );
    }

    // Reset account to pending
    resetAccountToPending(accountId);

    // Create a new processing job for this retry
    const timestamp = new Date().toLocaleString();
    const jobFilename = `Retry: ${account.company_name} - ${timestamp}`;
    const newJobId = createJob(jobFilename, 1);

    // Update account's job_id
    updateAccountJobId(accountId, newJobId);

    // Start processing in the background
    processJob(newJobId).catch((error) => {
      console.error(`Background processing failed for job ${newJobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId: newJobId,
      redirectUrl: `/processing/${newJobId}`,
    });
  } catch (error) {
    console.error('Error retrying account:', error);
    return NextResponse.json(
      { error: 'Failed to retry account' },
      { status: 500 }
    );
  }
}
