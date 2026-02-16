import { NextRequest, NextResponse } from 'next/server';
import {
  getAccountsForReprocessing,
  resetAccountToPending,
  createJob,
  updateAccountJobId,
} from '@/lib/db';
import { processJob } from '@/lib/processor';
import { ResearchMode } from '@/lib/dual-researcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      researchType = 'okta',
      scope = 'missing_okta',
      industry,
      limit,
    } = body;

    // Validate researchType
    const validResearchTypes: ResearchMode[] = ['both', 'auth0', 'okta'];
    if (!validResearchTypes.includes(researchType)) {
      return NextResponse.json(
        { error: 'researchType must be one of: both, auth0, okta' },
        { status: 400 }
      );
    }

    // Validate scope
    const validScopes = ['missing_okta', 'missing_auth0', 'all_completed'];
    if (!validScopes.includes(scope)) {
      return NextResponse.json(
        { error: 'scope must be one of: missing_okta, missing_auth0, all_completed' },
        { status: 400 }
      );
    }

    // Get matching accounts
    const { accounts, total } = getAccountsForReprocessing({
      scope,
      industry: industry || undefined,
      limit: limit || undefined,
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found matching the specified filters', total: 0 },
        { status: 404 }
      );
    }

    // Reset each account to pending
    accounts.forEach((account) => {
      resetAccountToPending(account.id);
    });

    // Create a new processing job
    const timestamp = new Date().toLocaleString();
    const researchLabel = researchType === 'both' ? 'Both' : researchType === 'auth0' ? 'Auth0' : 'Okta';
    const scopeLabel = scope === 'missing_okta' ? 'Missing Okta' : scope === 'missing_auth0' ? 'Missing Auth0' : 'All Completed';
    const jobFilename = `Bulk Reprocess (${researchLabel} - ${scopeLabel}) - ${accounts.length} accounts - ${timestamp}`;
    const newJobId = createJob(jobFilename, accounts.length);

    // Update all accounts' job_id
    accounts.forEach((account) => {
      updateAccountJobId(account.id, newJobId);
    });

    // Start processing in background
    processJob(newJobId, { researchType }).catch((error) => {
      console.error(`Background reprocessing failed for job ${newJobId}:`, error);
    });

    return NextResponse.json({
      success: true,
      jobId: newJobId,
      accountCount: accounts.length,
      totalMatching: total,
      researchType,
      scope,
      redirectUrl: `/processing/${newJobId}`,
    });
  } catch (error) {
    console.error('Error starting bulk reprocess:', error);
    return NextResponse.json(
      { error: 'Failed to start bulk reprocessing' },
      { status: 500 }
    );
  }
}
