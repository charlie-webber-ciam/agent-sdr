import { NextResponse } from 'next/server';
import { bulkUpdateAccountReviewStatus, ReviewStatus } from '@/lib/db';

const VALID_STATUSES: ReviewStatus[] = ['new', 'reviewed', 'working', 'dismissed'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountIds, reviewStatus } = body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: 'accountIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(reviewStatus)) {
      return NextResponse.json(
        { error: `reviewStatus must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const ids = accountIds.map(Number).filter((id: number) => !isNaN(id) && id > 0);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No valid account IDs provided' },
        { status: 400 }
      );
    }

    const updatedCount = bulkUpdateAccountReviewStatus(ids, reviewStatus);

    return NextResponse.json({
      success: true,
      updatedCount,
      requestedCount: ids.length,
    });
  } catch (error) {
    console.error('Error bulk updating review status:', error);
    return NextResponse.json(
      { error: 'Failed to update review status' },
      { status: 500 }
    );
  }
}
