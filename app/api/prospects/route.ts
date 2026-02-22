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
      valueTier: url.searchParams.get('valueTier') || undefined,
      seniorityLevel: url.searchParams.get('seniorityLevel') || undefined,
      departmentTag: url.searchParams.get('departmentTag') || undefined,
      tags: url.searchParams.get('tags') || undefined,
      aiProcessed: (url.searchParams.get('aiProcessed') as 'yes' | 'no') || undefined,
      has_email: url.searchParams.get('has_email') || undefined,
      has_phone: url.searchParams.get('has_phone') || undefined,
      has_mobile: url.searchParams.get('has_mobile') || undefined,
      has_linkedin: url.searchParams.get('has_linkedin') || undefined,
      do_not_call: url.searchParams.get('do_not_call') || undefined,
      phoneCountry: url.searchParams.get('phoneCountry') || undefined,
      contactReadiness: url.searchParams.get('contactReadiness') || undefined,
      exclude_dnc: url.searchParams.get('exclude_dnc') || undefined,
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
