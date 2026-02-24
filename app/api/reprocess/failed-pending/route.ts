import { NextResponse } from 'next/server';
import {
  getAccountsByStatus,
  resetAccountToPending,
  createJob,
  updateAccountJobId,
  createCategorizationJob,
} from '@/lib/db';
import { processJob } from '@/lib/processor';
import { processCategorizationJob } from '@/lib/categorization-processor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      statuses = ['failed'],
      industry,
      limit,
    } = body;

    if (!action || !['research', 'categorize'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "research" or "categorize"' },
        { status: 400 }
      );
    }

    const validStatuses = ['failed', 'pending'];
    const filteredStatuses = (statuses as string[]).filter(s => validStatuses.includes(s)) as ('failed' | 'pending')[];
    if (filteredStatuses.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid status (failed, pending) is required' },
        { status: 400 }
      );
    }

    const { accounts, total } = getAccountsByStatus({
      statuses: filteredStatuses,
      industry: industry || undefined,
      limit: limit || undefined,
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found matching the specified filters', total: 0 },
        { status: 404 }
      );
    }

    const statusLabel = filteredStatuses.join(' + ');
    const timestamp = new Date().toLocaleString();

    if (action === 'research') {
      // Reset accounts to pending and create a processing job
      accounts.forEach((account) => {
        resetAccountToPending(account.id);
      });

      const jobFilename = `Retry ${statusLabel} (Research) - ${accounts.length} accounts - ${timestamp}`;
      const newJobId = createJob(jobFilename, accounts.length);

      accounts.forEach((account) => {
        updateAccountJobId(account.id, newJobId);
      });

      // Fire and forget
      processJob(newJobId).catch((error) => {
        console.error(`Background retry research failed for job ${newJobId}:`, error);
      });

      return NextResponse.json({
        success: true,
        jobId: newJobId,
        accountCount: accounts.length,
        totalMatching: total,
        redirectUrl: `/processing/${newJobId}`,
      });
    } else {
      // action === 'categorize'
      const name = `Retry ${statusLabel} (Categorize) - ${accounts.length} accounts - ${timestamp}`;
      const accountIds = accounts.map(a => a.id);
      const jobId = createCategorizationJob(name, accounts.length, { accountIds });

      processCategorizationJob(jobId).catch((error) => {
        console.error(`Background retry categorization failed for job ${jobId}:`, error);
      });

      return NextResponse.json({
        success: true,
        jobId,
        accountCount: accounts.length,
        totalMatching: total,
        redirectUrl: `/categorize/progress/${jobId}`,
      });
    }
  } catch (error) {
    console.error('Error retrying failed/pending accounts:', error);
    return NextResponse.json(
      { error: 'Failed to retry accounts' },
      { status: 500 }
    );
  }
}
