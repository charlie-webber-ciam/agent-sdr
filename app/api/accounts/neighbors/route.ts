import { NextResponse } from 'next/server';
import { getAccountsWithFilters } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const currentId = parseInt(searchParams.get('currentId') || '0');
    if (!currentId) {
      return NextResponse.json(
        { error: 'currentId is required' },
        { status: 400 }
      );
    }

    const filters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      customerStatus: searchParams.get('customerStatus') || undefined,
      tier: searchParams.get('tier') || undefined,
      oktaTier: searchParams.get('oktaTier') || undefined,
      accountOwner: searchParams.get('accountOwner') || undefined,
      oktaAccountOwner: searchParams.get('oktaAccountOwner') || undefined,
      includeGlobalParent: searchParams.get('includeGlobalParent') === 'true',
      hqState: searchParams.get('hqState') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
    };

    const result = getAccountsWithFilters(filters);
    const ids = result.accounts.map(acc => acc.id);
    const names = result.accounts.map(acc => acc.company_name);

    const currentIndex = ids.indexOf(currentId);

    if (currentIndex === -1) {
      return NextResponse.json({
        prevId: null,
        prevName: null,
        nextId: null,
        nextName: null,
        position: 0,
        total: ids.length,
      });
    }

    const prevId = currentIndex > 0 ? ids[currentIndex - 1] : null;
    const prevName = currentIndex > 0 ? names[currentIndex - 1] : null;
    const nextId = currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null;
    const nextName = currentIndex < ids.length - 1 ? names[currentIndex + 1] : null;

    return NextResponse.json({
      prevId,
      prevName,
      nextId,
      nextName,
      position: currentIndex + 1,
      total: ids.length,
    });
  } catch (error) {
    console.error('Error fetching account neighbors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account neighbors' },
      { status: 500 }
    );
  }
}
