import { NextResponse } from 'next/server';
import { getReprocessingStats, getFilterMetadata } from '@/lib/db';

export async function GET() {
  try {
    const stats = getReprocessingStats();
    const metadata = getFilterMetadata();

    return NextResponse.json({
      stats,
      industries: metadata.industries,
    });
  } catch (error) {
    console.error('Error fetching reprocess config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reprocessing configuration' },
      { status: 500 }
    );
  }
}
