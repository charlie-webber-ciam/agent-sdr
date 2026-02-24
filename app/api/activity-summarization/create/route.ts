import { NextResponse } from 'next/server';
import {
  createCategorizationJob,
  getAccountsForActivitySummarization,
} from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { unsummarizedOnly = true, limit } = body;

    const filters = { unsummarizedOnly, limit };

    // Get accounts that match the filters to determine count
    const accounts = getAccountsForActivitySummarization(filters);

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No accounts found with activities matching the specified filters',
        totalAccounts: 0,
      });
    }

    const name = `Summarize Activities${unsummarizedOnly ? ' (unsummarized only)' : ' (all)'} - ${accounts.length} accounts`;
    const jobId = createCategorizationJob(name, accounts.length, filters);

    console.log(`Created activity summarization job ${jobId}: ${name}`);

    return NextResponse.json({
      success: true,
      jobId,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    console.error('Failed to create activity summarization job:', error);
    return NextResponse.json(
      { error: 'Failed to create activity summarization job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
