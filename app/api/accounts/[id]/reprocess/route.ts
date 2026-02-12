import { NextRequest, NextResponse } from 'next/server';
import {
  getAccount,
  resetAccountToPending,
  createJob,
  updateAccountJobId,
} from '@/lib/db';
import { processJob } from '@/lib/processor';
import { ResearchMode } from '@/lib/dual-researcher';

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

    // Parse request body
    const body = await request.json();
    const { researchType = 'both' } = body;

    // Validate researchType
    const validResearchTypes: ResearchMode[] = ['both', 'auth0', 'okta'];
    if (!validResearchTypes.includes(researchType)) {
      return NextResponse.json(
        { error: 'researchType must be one of: both, auth0, okta' },
        { status: 400 }
      );
    }

    // Get the account
    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Reset account to pending (allows reprocessing of any status)
    resetAccountToPending(accountId);

    // Create a new processing job for this reprocess
    const timestamp = new Date().toLocaleString();
    const researchLabel = researchType === 'both' ? 'Both' : researchType === 'auth0' ? 'Auth0' : 'Okta';
    const jobFilename = `Reprocess (${researchLabel}): ${account.company_name} - ${timestamp}`;
    const newJobId = createJob(jobFilename, 1);

    // Update account's job_id
    updateAccountJobId(accountId, newJobId);

    // Start processing in the background with specified research type
    processJob(newJobId, { researchType }).catch((error) => {
      console.error(`Background processing failed for job ${newJobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId: newJobId,
      researchType,
      redirectUrl: `/processing/${newJobId}`,
    });
  } catch (error) {
    console.error('Error reprocessing account:', error);
    return NextResponse.json(
      { error: 'Failed to reprocess account' },
      { status: 500 }
    );
  }
}
