import { NextResponse } from 'next/server';
import { getActivitySummarizationStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = getActivitySummarizationStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get activity summarization stats:', error);
    return NextResponse.json(
      { error: 'Failed to get activity summarization stats' },
      { status: 500 }
    );
  }
}
