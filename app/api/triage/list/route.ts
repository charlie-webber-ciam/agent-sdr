import { NextResponse } from 'next/server';
import { getAllTriageJobs } from '@/lib/db';

export async function GET() {
  try {
    const jobs = getAllTriageJobs(50);

    return NextResponse.json({
      jobs: jobs.map(j => ({
        id: j.id,
        filename: j.filename,
        processingJobId: j.processing_job_id,
        totalAccounts: j.total_accounts,
        processedCount: j.processed_count,
        failedCount: j.failed_count,
        status: j.status,
        createdAt: j.created_at,
        completedAt: j.completed_at,
      })),
    });
  } catch (error) {
    console.error('Error listing triage jobs:', error);
    return NextResponse.json(
      { error: 'Failed to list triage jobs' },
      { status: 500 }
    );
  }
}
