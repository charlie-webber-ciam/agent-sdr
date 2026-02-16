import { NextResponse } from 'next/server';
import {
  getTriageJob,
  getTriageJobStats,
  getAccountsByJob,
  getJob,
} from '@/lib/db';
import { isTriageJobActive } from '@/lib/triage-processor';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const triageJobId = parseInt(jobId);

    if (isNaN(triageJobId)) {
      return NextResponse.json(
        { error: 'Invalid job ID' },
        { status: 400 }
      );
    }

    const job = getTriageJob(triageJobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Triage job not found' },
        { status: 404 }
      );
    }

    // Find the associated processing job to get tier stats
    // The triage job filename matches the processing job filename
    // We need to find the processing job to get the jobId for account lookup
    const { searchParams } = new URL(request.url);
    const processingJobId = searchParams.get('processingJobId');

    let tierStats = null;
    let accounts: any[] = [];

    if (processingJobId) {
      const pJobId = parseInt(processingJobId);
      tierStats = getTriageJobStats(pJobId);

      // Get accounts with triage data
      const rawAccounts = getAccountsByJob(pJobId);
      accounts = rawAccounts.map(acc => {
        let triageData = null;
        if (acc.triage_data) {
          try {
            triageData = JSON.parse(acc.triage_data);
          } catch {
            triageData = null;
          }
        }
        return {
          id: acc.id,
          companyName: acc.company_name,
          domain: acc.domain,
          industry: acc.industry,
          triageAuth0Tier: acc.triage_auth0_tier,
          triageOktaTier: acc.triage_okta_tier,
          triageSummary: acc.triage_summary,
          triageData,
          triagedAt: acc.triaged_at,
        };
      });
    }

    const progressPercent = job.total_accounts > 0
      ? Math.round((job.processed_count / job.total_accounts) * 100)
      : 0;

    const active = isTriageJobActive(triageJobId);

    return NextResponse.json({
      job: {
        id: job.id,
        filename: job.filename,
        totalAccounts: job.total_accounts,
        processedCount: job.processed_count,
        failedCount: job.failed_count,
        status: job.status,
        currentAccount: job.current_account,
        paused: job.paused,
        progressPercent,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at,
      },
      active,
      tierStats,
      accounts,
    });
  } catch (error) {
    console.error('Error fetching triage job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch triage job' },
      { status: 500 }
    );
  }
}
