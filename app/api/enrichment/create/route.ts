import { NextResponse } from 'next/server';
import { createEnrichmentJob, getAccountsForEnrichment } from '@/lib/db';
import { getEnrichmentAgent } from '@/lib/enrichment-agents/registry';
import {
  assertProcessAction,
  parseJsonBody,
  processActionErrorResponse,
} from '@/lib/process-action-utils';

/**
 * POST /api/enrichment/create
 *
 * Create an enrichment job. Counts matching accounts and creates a job row.
 *
 * Body:
 * - type: string - enrichment agent type (e.g. 'domain', 'standardize_industry')
 * - filters?: object - optional filters for account selection
 * - limit?: number - max accounts to process (default: 10000)
 */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{
      type?: string;
      filters?: Record<string, any>;
      limit?: number;
    }>(request);

    const type = body.type;
    assertProcessAction(type, 400, 'Enrichment type is required');

    const agentConfig = getEnrichmentAgent(type);
    assertProcessAction(agentConfig, 400, `Unknown enrichment type: ${type}`);

    const limit = body.limit || 10000;
    const filters = {
      ...(agentConfig.defaultFilter || {}),
      ...(body.filters || {}),
      limit,
    };

    // Count eligible accounts
    const accounts = getAccountsForEnrichment(filters);

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No accounts found matching the specified filters',
        totalAccounts: 0,
      });
    }

    const jobName = `${agentConfig.name} - ${accounts.length} accounts`;
    const jobId = createEnrichmentJob(type, jobName, accounts.length, filters);

    return NextResponse.json({
      success: true,
      jobId,
      jobName,
      totalAccounts: accounts.length,
      type,
    });
  } catch (error) {
    return processActionErrorResponse(
      'Failed to create enrichment job',
      error,
      'Failed to create enrichment job'
    );
  }
}
