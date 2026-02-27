import { NextResponse } from 'next/server';
import {
  createCategorizationJob,
  getAccountsForParentCompanyFinder,
} from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { unprocessedOnly = true, limit } = body;

    const filters = { unprocessedOnly, limit };

    // Get accounts that match the filters to determine count
    const accounts = getAccountsForParentCompanyFinder(filters);

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No accounts found matching the specified filters',
        totalAccounts: 0,
      });
    }

    const name = `Parent Company Finder${unprocessedOnly ? ' (unprocessed only)' : ' (all)'} - ${accounts.length} accounts`;
    const jobId = createCategorizationJob(name, accounts.length, filters);

    console.log(`Created parent company job ${jobId}: ${name}`);

    return NextResponse.json({
      success: true,
      jobId,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    console.error('Failed to create parent company job:', error);
    return NextResponse.json(
      { error: 'Failed to create parent company job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
