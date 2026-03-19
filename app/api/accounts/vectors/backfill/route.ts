import { NextResponse } from 'next/server';

import { createAndStartVectorBackfillJob } from '@/lib/account-vector-backfill';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawIds = Array.isArray(body?.accountIds) ? body.accountIds : undefined;
    const accountIds = rawIds
      ?.map((value: unknown) => Number(value))
      .filter((value: number) => Number.isFinite(value));

    const { jobId, totalAccounts } = createAndStartVectorBackfillJob(accountIds && accountIds.length > 0 ? accountIds : undefined);

    return NextResponse.json({
      jobId,
      totalAccounts,
      message: totalAccounts > 0
        ? 'Vector backfill job started.'
        : 'No completed accounts were eligible for vector indexing.',
    });
  } catch (error) {
    console.error('Error starting vector backfill job:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start vector backfill job' },
      { status: 500 }
    );
  }
}
