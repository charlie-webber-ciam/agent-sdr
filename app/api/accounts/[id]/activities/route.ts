import { NextResponse } from 'next/server';
import { getActivitiesByAccount, getActivitySummary } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const activities = getActivitiesByAccount(accountId);
    const { summary, updatedAt } = getActivitySummary(accountId);

    return NextResponse.json({
      activities,
      summary,
      summaryUpdatedAt: updatedAt,
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
