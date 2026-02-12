import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * POST /api/accounts/okta-categorize-bulk
 *
 * Creates an Okta categorization job with filters and returns a list of accounts to categorize.
 * This endpoint doesn't create a background job - it immediately categorizes the accounts.
 *
 * Body:
 * - uncategorizedOnly: boolean (default: true) - only categorize accounts without okta_tier
 * - industry: string (optional) - filter by industry
 * - accountIds: number[] (optional) - specific account IDs to categorize
 * - limit: number (optional) - maximum number of accounts to categorize
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      uncategorizedOnly = true,
      industry,
      accountIds,
      limit = 10000,
    } = body;

    const db = getDb();

    // Build query to find accounts that need Okta categorization
    let query = 'SELECT * FROM accounts WHERE okta_processed_at IS NOT NULL';
    const params: any[] = [];

    if (uncategorizedOnly) {
      query += ' AND okta_tier IS NULL';
    }

    if (industry) {
      query += ' AND industry = ?';
      params.push(industry);
    }

    if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
      const placeholders = accountIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...accountIds);
    }

    query += ' ORDER BY okta_processed_at DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const accountsToProcess = stmt.all(...params) as any[];

    if (accountsToProcess.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No accounts found matching the specified filters',
        totalAccounts: 0,
      });
    }

    console.log(`Found ${accountsToProcess.length} accounts for Okta categorization`);

    return NextResponse.json({
      success: true,
      totalAccounts: accountsToProcess.length,
      accountIds: accountsToProcess.map((acc: any) => acc.id),
      message: `Found ${accountsToProcess.length} accounts ready for Okta categorization.`,
    });

  } catch (error) {
    console.error('Failed to prepare Okta categorization:', error);
    return NextResponse.json(
      {
        error: 'Failed to prepare Okta categorization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
