import { NextRequest, NextResponse } from 'next/server';
import {
  getStaleAccounts,
  createJob,
  updateAccountJobId,
  updateAccountStatus,
} from '@/lib/db';
import { processJob } from '@/lib/processor';
import { z } from 'zod';

const requestSchema = z.object({
  thresholdDays: z.number().min(1).max(365).default(60),
  limit: z.number().min(1).max(500).optional(),
  researchType: z.enum(['auth0', 'okta', 'both']).default('both'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { thresholdDays, limit, researchType } = requestSchema.parse(body);

    // Get stale accounts
    const staleAccounts = getStaleAccounts(thresholdDays, limit);

    if (staleAccounts.length === 0) {
      return NextResponse.json(
        { error: 'No stale accounts found matching criteria' },
        { status: 404 }
      );
    }

    // Create a new processing job
    const jobId = createJob(`refresh-stale-${thresholdDays}d`, staleAccounts.length);

    // Reset only research_status to pending on stale accounts (preserving SDR-edited fields)
    for (const account of staleAccounts) {
      updateAccountJobId(account.id, jobId);
      updateAccountStatus(account.id, 'pending');
    }

    // Start processing in background
    processJob(jobId, { researchType }).catch((err) => {
      console.error(`Refresh stale job ${jobId} failed:`, err);
    });

    return NextResponse.json({
      success: true,
      jobId,
      accountCount: staleAccounts.length,
      redirectUrl: `/processing/${jobId}`,
    });
  } catch (error) {
    console.error('Refresh stale API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh stale accounts' },
      { status: 500 }
    );
  }
}
