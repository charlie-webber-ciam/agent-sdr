import { NextRequest, NextResponse } from 'next/server';
import {
  getAccountsByIds,
  resetAccountToPending,
  createJob,
  updateAccountJobId,
} from '@/lib/db';
import { processJob } from '@/lib/processor';
import { ResearchMode } from '@/lib/dual-researcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountIds, researchType = 'both' } = body;

    // Validate accountIds
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: 'accountIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate researchType
    const validResearchTypes: ResearchMode[] = ['both', 'auth0', 'okta'];
    if (!validResearchTypes.includes(researchType)) {
      return NextResponse.json(
        { error: 'researchType must be one of: both, auth0, okta' },
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

    // Note: Unlike retry-bulk, we allow reprocessing of accounts in any status
    // This enables selective re-research (e.g., add Okta research to completed accounts)

    // Reset all accounts to pending
    accounts.forEach((account) => {
      resetAccountToPending(account.id);
    });

    // Create a new processing job for bulk reprocessing
    const timestamp = new Date().toLocaleString();
    const researchLabel = researchType === 'both' ? 'Both' : researchType === 'auth0' ? 'Auth0' : 'Okta';
    const jobFilename = `Bulk Reprocess (${researchLabel}) - ${accounts.length} accounts - ${timestamp}`;
    const newJobId = createJob(jobFilename, accounts.length);

    // Update all accounts' job_id
    accounts.forEach((account) => {
      updateAccountJobId(account.id, newJobId);
    });

    // Start processing in the background with specified research type
    processJob(newJobId, { researchType }).catch((error) => {
      console.error(`Background processing failed for job ${newJobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId: newJobId,
      accountCount: accounts.length,
      researchType,
      redirectUrl: `/processing/${newJobId}`,
    });
  } catch (error) {
    console.error('Error reprocessing accounts:', error);
    return NextResponse.json(
      { error: 'Failed to reprocess accounts' },
      { status: 500 }
    );
  }
}
