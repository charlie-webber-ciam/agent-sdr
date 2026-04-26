import { NextResponse } from 'next/server';
import { getProspectEmailCounts } from '@/lib/db';

/**
 * POST /api/bulk-email/email-counts
 *
 * Returns the number of existing generated emails per prospect.
 *
 * Body:
 * - prospectIds: number[]
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prospectIds = body.prospectIds;

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    // Cap at 1000 to avoid huge queries
    const ids = prospectIds.slice(0, 1000).filter((id: unknown) => typeof id === 'number');
    const countsMap = getProspectEmailCounts(ids);
    const counts: Record<number, number> = {};
    for (const [id, count] of countsMap) {
      counts[id] = count;
    }

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error('Failed to get email counts:', error);
    return NextResponse.json({ error: 'Failed to get email counts' }, { status: 500 });
  }
}
