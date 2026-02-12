import { NextResponse } from 'next/server';
import { getEnhancedStats, getStaleAccountStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = getEnhancedStats();
    const staleness = getStaleAccountStats();
    return NextResponse.json({
      ...stats,
      staleness,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
