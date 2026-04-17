import { NextResponse } from 'next/server';
import { getAccountsWithFilters } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      customerStatus: searchParams.get('customerStatus') || undefined,
      industry: searchParams.get('industry') || undefined,
      tier: searchParams.get('tier') || undefined,
      oktaTier: searchParams.get('oktaTier') || undefined,
      accountOwner: searchParams.get('accountOwner') || undefined,
      oktaAccountOwner: searchParams.get('oktaAccountOwner') || undefined,
      oktaPatch: searchParams.get('oktaPatch') || undefined,
      includeGlobalParent: searchParams.get('includeGlobalParent') === 'true',
      hqState: searchParams.get('hqState') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      // No limit/offset — return all matching IDs
    };

    const result = getAccountsWithFilters(filters);
    const ids = result.accounts.map(acc => acc.id);

    return NextResponse.json({ ids, total: result.total });
  } catch (error) {
    console.error('Error fetching account IDs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account IDs' },
      { status: 500 }
    );
  }
}
