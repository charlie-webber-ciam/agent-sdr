import { NextResponse } from 'next/server';
import {
  createBulkEmailJob,
  getProspect,
  getAccount,
  getAccountOverview,
  getProspectIdsWithExistingEmails,
} from '@/lib/db';
import { buildOverviewRecordFromStorage, hasMeaningfulOverviewContent } from '@/lib/account-overview';
import {
  assertProcessAction,
  parseJsonBody,
  processActionErrorResponse,
} from '@/lib/process-action-utils';

/**
 * POST /api/bulk-email/create
 *
 * Create a bulk email generation job from a list of prospect IDs.
 *
 * Body:
 * - prospectIds: number[] - prospect IDs to generate emails for
 * - emailType: 'cold' | 'warm' (default: 'cold')
 * - researchContext: 'auth0' | 'okta' (default: 'auth0')
 * - customInstructions?: string
 */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{
      prospectIds?: number[];
      emailType?: string;
      researchContext?: string;
      customInstructions?: string;
    }>(request);

    const prospectIds = body.prospectIds;
    assertProcessAction(
      Array.isArray(prospectIds) && prospectIds.length > 0,
      400,
      'prospectIds must be a non-empty array'
    );
    assertProcessAction(prospectIds.length <= 500, 400, 'Maximum 500 prospects per job');

    const emailType = body.emailType || 'cold';
    const researchContext = body.researchContext || 'auth0';

    // Validate prospects exist and count unique accounts needing overviews
    const accountIds = new Set<number>();
    const validProspectIds: number[] = [];
    let skipped = 0;

    for (const pid of prospectIds) {
      const prospect = getProspect(pid);
      if (!prospect) {
        skipped++;
        continue;
      }
      validProspectIds.push(pid);
      accountIds.add(prospect.account_id);
    }

    assertProcessAction(validProspectIds.length > 0, 400, 'No valid prospects found');

    // Count accounts needing overview generation
    let overviewsNeeded = 0;
    let researchIncomplete = 0;
    for (const accountId of accountIds) {
      const account = getAccount(accountId);
      if (!account || account.research_status !== 'completed') {
        researchIncomplete++;
        continue;
      }
      const existing = buildOverviewRecordFromStorage(getAccountOverview(accountId));
      if (!hasMeaningfulOverviewContent(existing)) {
        overviewsNeeded++;
      }
    }

    // Check how many prospects already have emails for this context
    const existingEmailIds = getProspectIdsWithExistingEmails(validProspectIds, researchContext);
    const willSkip = existingEmailIds.size;
    const willGenerate = validProspectIds.length - willSkip;

    const jobName = `Bulk email - ${validProspectIds.length} prospects across ${accountIds.size} accounts`;
    const jobId = createBulkEmailJob({
      name: jobName,
      prospectIds: validProspectIds,
      emailType,
      researchContext,
      customInstructions: body.customInstructions,
      overviewsNeeded,
    });

    return NextResponse.json({
      success: true,
      jobId,
      totalProspects: validProspectIds.length,
      totalAccounts: accountIds.size,
      overviewsNeeded,
      researchIncomplete,
      skipped,
      willSkipExisting: willSkip,
      willGenerate,
    });
  } catch (error) {
    return processActionErrorResponse(
      'Failed to create bulk email job',
      error,
      'Failed to create bulk email job'
    );
  }
}
