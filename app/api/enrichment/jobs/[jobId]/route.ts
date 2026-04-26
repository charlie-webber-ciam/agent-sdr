import { NextResponse } from 'next/server';
import { getEnrichmentJob, getAccount } from '@/lib/db';

/**
 * GET /api/enrichment/jobs/[jobId]
 *
 * Get enrichment job status and current account being processed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = getEnrichmentJob(jobIdNum);
    if (!job) {
      return NextResponse.json({ error: 'Enrichment job not found' }, { status: 404 });
    }

    let currentAccount = null;
    if (job.current_account_id) {
      const account = getAccount(job.current_account_id);
      if (account) {
        currentAccount = {
          id: account.id,
          company_name: account.company_name,
          domain: account.domain,
        };
      }
    }

    let filters = null;
    try {
      if (job.filters) {
        filters = JSON.parse(job.filters);
      }
    } catch {
      // ignore parse errors
    }

    return NextResponse.json({
      success: true,
      job: { ...job, filters },
      currentAccount,
    });
  } catch (error) {
    console.error('Failed to get enrichment job:', error);
    return NextResponse.json(
      { error: 'Failed to get enrichment job' },
      { status: 500 }
    );
  }
}
