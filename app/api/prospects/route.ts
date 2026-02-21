import { NextResponse } from 'next/server';
import { getProspectsWithFilters } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = {
      search: url.searchParams.get('search') || undefined,
      tier: url.searchParams.get('tier') || undefined,
      oktaTier: url.searchParams.get('oktaTier') || undefined,
      roleType: url.searchParams.get('roleType') || undefined,
      industry: url.searchParams.get('industry') || undefined,
      source: url.searchParams.get('source') || undefined,
      relationshipStatus: url.searchParams.get('relationshipStatus') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
    };

    const { prospects, total } = getProspectsWithFilters(filters);

    return NextResponse.json({
      prospects,
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: (filters.offset || 0) + (filters.limit || 50) < total,
    });
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
  }
}
