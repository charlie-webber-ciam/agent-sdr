import { NextResponse } from 'next/server';
import { getAccountsWithFilters } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      search: searchParams.get('search') || undefined,
      industry: searchParams.get('industry') || undefined,
      status: searchParams.get('status') || undefined,
      tier: searchParams.get('tier') || undefined,
      sku: searchParams.get('sku') || undefined,
      useCase: searchParams.get('useCase') || undefined,
      minPriority: searchParams.get('minPriority') ? parseInt(searchParams.get('minPriority')!) : undefined,
      revenue: searchParams.get('revenue') || undefined,
      accountOwner: searchParams.get('accountOwner') || undefined,
      oktaTier: searchParams.get('oktaTier') || undefined,
      oktaSku: searchParams.get('oktaSku') || undefined,
      oktaUseCase: searchParams.get('oktaUseCase') || undefined,
      oktaMinPriority: searchParams.get('oktaMinPriority') ? parseInt(searchParams.get('oktaMinPriority')!) : undefined,
      oktaAccountOwner: searchParams.get('oktaAccountOwner') || undefined,
      oktaPatch: searchParams.get('oktaPatch') || undefined,
      triageAuth0Tier: searchParams.get('triageAuth0Tier') || undefined,
      triageOktaTier: searchParams.get('triageOktaTier') || undefined,
      freshness: searchParams.get('freshness') || undefined,
      tag: searchParams.get('tag') || undefined,
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
