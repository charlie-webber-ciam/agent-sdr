import { NextResponse } from 'next/server';
import { getEnhancedStats, getStaleAccountStats, getDb } from '@/lib/db';
import { isJobActive } from '@/lib/processor';
import { isCategorizationJobActive } from '@/lib/categorization-processor';

interface InterruptedJob {
  id: number;
  type: 'research' | 'categorization';
  name: string;
  processedCount: number;
  totalCount: number;
  pendingRemaining: number;
}

function getInterruptedJobs(): InterruptedJob[] {
  const db = getDb();
  const interrupted: InterruptedJob[] = [];

  // Check research jobs stuck in 'processing'
  const researchJobs = db.prepare(
    "SELECT * FROM processing_jobs WHERE status = 'processing'"
  ).all() as Array<{
    id: number;
    filename: string;
    processed_count: number;
    total_accounts: number;
  }>;

  for (const job of researchJobs) {
    if (!isJobActive(job.id)) {
      const pendingCount = db.prepare(
        "SELECT COUNT(*) as count FROM accounts WHERE job_id = ? AND research_status = 'pending'"
      ).get(job.id) as { count: number };

      interrupted.push({
        id: job.id,
        type: 'research',
        name: job.filename,
        processedCount: job.processed_count,
        totalCount: job.total_accounts,
        pendingRemaining: pendingCount.count,
      });
    }
  }

  // Check categorization jobs stuck in 'processing'
  const catJobs = db.prepare(
    "SELECT * FROM categorization_jobs WHERE status = 'processing'"
  ).all() as Array<{
    id: number;
    name: string;
    processed_count: number;
    total_accounts: number;
  }>;

  for (const job of catJobs) {
    if (!isCategorizationJobActive(job.id)) {
      interrupted.push({
        id: job.id,
        type: 'categorization',
        name: job.name,
        processedCount: job.processed_count,
        totalCount: job.total_accounts,
        pendingRemaining: job.total_accounts - job.processed_count,
      });
    }
  }

  return interrupted;
}

export async function GET() {
  try {
    const stats = getEnhancedStats();
    const staleness = getStaleAccountStats();
    const interruptedJobs = getInterruptedJobs();
    return NextResponse.json({
      ...stats,
      staleness,
      interruptedJobs,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
