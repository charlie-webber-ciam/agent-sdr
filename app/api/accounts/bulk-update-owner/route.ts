import { NextResponse } from 'next/server';
import { getAccountsByIds, updateAccountMetadata } from '@/lib/db';

/**
 * POST /api/accounts/bulk-update-owner
 *
 * Bulk update Account Owner for multiple accounts
 *
 * Body:
 * - accountIds: number[] - Array of account IDs to update
 * - accountOwner: string - New account owner name
 * - ownerType: 'auth0' | 'okta' - Which owner field to update (default: 'auth0')
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountIds, accountOwner, ownerType = 'auth0' } = body;

    // Validation
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: 'Account IDs array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!accountOwner || typeof accountOwner !== 'string' || accountOwner.trim() === '') {
      return NextResponse.json(
        { error: 'Account owner name is required' },
        { status: 400 }
      );
    }

    if (accountIds.length > 10000) {
      return NextResponse.json(
        { error: 'Cannot update more than 10,000 accounts at once' },
        { status: 400 }
      );
    }

    // Verify accounts exist
    const accounts = getAccountsByIds(accountIds);

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found with the provided IDs' },
        { status: 404 }
      );
    }

    if (accounts.length !== accountIds.length) {
      console.warn(`Found ${accounts.length} accounts but ${accountIds.length} IDs provided`);
    }

    const ownerColumn = ownerType === 'okta' ? 'okta_account_owner' : 'auth0_account_owner';
    console.log(`Bulk updating ${ownerColumn} for ${accounts.length} accounts to: ${accountOwner}`);

    // Update each account
    let successCount = 0;
    let failedCount = 0;
    const results = [];

    for (const account of accounts) {
      try {
        updateAccountMetadata(account.id, {
          last_edited_at: new Date().toISOString(),
        });

        // Update the account owner using db.prepare directly
        const { getDb } = await import('@/lib/db');
        const db = getDb();
        const stmt = db.prepare(`
          UPDATE accounts
          SET ${ownerColumn} = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `);
        stmt.run(accountOwner.trim(), account.id);

        successCount++;
        results.push({
          id: account.id,
          companyName: account.company_name,
          success: true,
        });

        console.log(`✓ Updated account owner for ${account.company_name} (ID: ${account.id})`);
      } catch (error) {
        console.error(`Failed to update account ${account.id}:`, error);
        failedCount++;
        results.push({
          id: account.id,
          companyName: account.company_name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} accounts${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      accountOwner,
      successCount,
      failedCount,
      results,
    });

  } catch (error) {
    console.error('Bulk update owner error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process bulk update',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
