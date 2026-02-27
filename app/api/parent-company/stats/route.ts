import { NextResponse } from 'next/server';
import { getParentCompanyFinderStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = getParentCompanyFinderStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get parent company finder stats:', error);
    return NextResponse.json(
      { error: 'Failed to get parent company finder stats' },
      { status: 500 }
    );
  }
}
