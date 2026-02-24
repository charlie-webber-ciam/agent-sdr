import { NextResponse } from 'next/server';
import { getReprocessingStats, getFailedPendingStats, getDb } from '@/lib/db';

export async function GET() {
  try {
    const stats = getReprocessingStats();
    const failedPendingStats = getFailedPendingStats();
    const db = getDb();
    const industriesStmt = db.prepare('SELECT DISTINCT industry FROM accounts WHERE industry IS NOT NULL ORDER BY industry');
    const industries = (industriesStmt.all() as Array<{ industry: string }>).map(row => row.industry);

    return NextResponse.json({
      stats,
      failedPendingStats,
      industries,
    });
  } catch (error) {
    console.error('Error fetching reprocess config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reprocessing configuration' },
      { status: 500 }
    );
  }
}
