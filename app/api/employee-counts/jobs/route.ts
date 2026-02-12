import { NextResponse } from 'next/server';
import { getAllEmployeeCountJobs } from '@/lib/db';

export async function GET() {
  try {
    const jobs = getAllEmployeeCountJobs(50); // Get last 50 jobs

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
