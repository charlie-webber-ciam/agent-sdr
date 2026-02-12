import { NextResponse } from 'next/server';
import { getAllPreprocessingJobs } from '@/lib/db';

export async function GET() {
  try {
    const jobs = getAllPreprocessingJobs(20);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Failed to get preprocessing jobs:', error);
    return NextResponse.json(
      { error: 'Failed to get jobs' },
      { status: 500 }
    );
  }
}
