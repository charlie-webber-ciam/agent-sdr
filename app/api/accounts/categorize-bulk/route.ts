import { NextResponse } from 'next/server';
import {
  createCategorizationJob,
  getAccountsForCategorization,
} from '@/lib/db';

/**
 * POST /api/accounts/categorize-bulk
 *
 * Creates a categorization job with filters and returns the job ID.
 * The job runs in the background via the start endpoint.
 *
 * Body:
 * - uncategorizedOnly: boolean (default: true) - only categorize accounts without tier
 * - industry: string (optional) - filter by industry
 * - dateFrom: string (optional) - ISO date string for date range filter
 * - dateTo: string (optional) - ISO date string for date range filter
 * - accountIds: number[] (optional) - specific account IDs to categorize
 * - limit: number (optional) - maximum number of accounts to categorize
 * - jobName: string (optional) - custom name for the job
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      uncategorizedOnly = true,
      industry,
      dateFrom,
      dateTo,
      accountIds,
      limit = 10000,
      jobName,
    } = body;

    // Build filters object
    const filters: Record<string, any> = {
      uncategorizedOnly,
      status: 'completed',
      limit,
    };

    if (industry) filters.industry = industry;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (accountIds && Array.isArray(accountIds)) filters.accountIds = accountIds;

    // Get accounts that match the filters
    const accountsToProcess = getAccountsForCategorization(filters);

    if (accountsToProcess.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No accounts found matching the specified filters',
        totalAccounts: 0,
      });
    }

    // Generate job name
    const name = jobName || generateJobName(filters, accountsToProcess.length);

    // Create categorization job
    const jobId = createCategorizationJob(name, accountsToProcess.length, filters);

    console.log(`Created categorization job ${jobId}: ${name} (${accountsToProcess.length} accounts)`);

    return NextResponse.json({
      success: true,
      jobId,
      jobName: name,
      totalAccounts: accountsToProcess.length,
      message: `Created categorization job with ${accountsToProcess.length} accounts. Use /api/categorization/start to begin processing.`,
    });

  } catch (error) {
    console.error('Failed to create categorization job:', error);
    return NextResponse.json(
      {
        error: 'Failed to create categorization job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateJobName(filters: Record<string, any>, count: number): string {
  const parts: string[] = ['Categorize'];

  if (filters.accountIds) {
    parts.push(`${count} selected accounts`);
  } else {
    if (filters.uncategorizedOnly) {
      parts.push('uncategorized');
    }
    if (filters.industry) {
      parts.push(filters.industry);
    }
    parts.push(`accounts (${count})`);
  }

  return parts.join(' ');
}
