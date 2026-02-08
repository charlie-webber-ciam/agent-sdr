import { NextResponse } from 'next/server';
import { getJob, getAccountsByJob, getAccount } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId);

    if (isNaN(jobIdNum)) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const job = getJob(jobIdNum);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Get all accounts for this job
    const accounts = getAccountsByJob(jobIdNum);

    // Get current account being processed if any
    let currentAccount = null;
    if (job.current_account_id) {
      currentAccount = getAccount(job.current_account_id);
    }

    // Calculate progress percentage
    const progressPercent = job.total_accounts > 0
      ? Math.round((job.processed_count / job.total_accounts) * 100)
      : 0;

    return NextResponse.json({
      job: {
        id: job.id,
        filename: job.filename,
        status: job.status,
        totalAccounts: job.total_accounts,
        processedCount: job.processed_count,
        failedCount: job.failed_count,
        progressPercent,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at,
      },
      currentAccount: currentAccount ? {
        id: currentAccount.id,
        companyName: currentAccount.company_name,
        domain: currentAccount.domain,
      } : null,
      accounts: accounts.map(acc => ({
        id: acc.id,
        companyName: acc.company_name,
        domain: acc.domain,
        industry: acc.industry,
        status: acc.research_status,
        errorMessage: acc.error_message,
        processedAt: acc.processed_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}
