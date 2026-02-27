import { NextResponse } from 'next/server';
import { getCategorizationJob, getAccount } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId);

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = getCategorizationJob(jobIdNum);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let currentAccount = null;
    if (job.current_account_id) {
      currentAccount = getAccount(job.current_account_id);
    }

    const filters = job.filters ? JSON.parse(job.filters) : null;

    return NextResponse.json({
      success: true,
      job: { ...job, filters },
      currentAccount: currentAccount
        ? { id: currentAccount.id, company_name: currentAccount.company_name, domain: currentAccount.domain }
        : null,
    });
  } catch (error) {
    console.error('Failed to get parent company job:', error);
    return NextResponse.json(
      { error: 'Failed to get job details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
