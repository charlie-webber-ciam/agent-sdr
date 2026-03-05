import { NextResponse } from 'next/server';
import { getHqStateStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = getHqStateStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get HQ state stats:', error);
    return NextResponse.json(
      { error: 'Failed to get HQ state stats' },
      { status: 500 }
    );
  }
}
