import { NextResponse } from 'next/server';
import { getAllJobs } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeArchived = ['1', 'true', 'yes'].includes((searchParams.get('includeArchived') || '').toLowerCase());

    const jobs = getAllJobs(limit, includeArchived);

    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        filename: job.filename,
        status: job.status,
        archived: job.archived || 0,
        totalAccounts: job.total_accounts,
        processedCount: job.processed_count,
        failedCount: job.failed_count,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
