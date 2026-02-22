import { NextResponse } from 'next/server';
import { getProspectDataQualityStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = getProspectDataQualityStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching prospect stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
