import { NextResponse } from 'next/server';
import { getEnhancedStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = getEnhancedStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
