import { NextResponse } from 'next/server';
import { getOpportunitiesWithFilters } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || undefined;
    const stage = url.searchParams.get('stage') || undefined;
    const tier = url.searchParams.get('tier') || undefined;
    const industry = url.searchParams.get('industry') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { opportunities, total } = getOpportunitiesWithFilters({
      search,
      stage,
      tier,
      industry,
      limit,
      offset,
    });

    return NextResponse.json({
      opportunities,
      total,
      limit,
      offset,
      hasMore: offset + opportunities.length < total,
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }
}
