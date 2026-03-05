import { NextResponse } from 'next/server';
import {
  createCategorizationJob,
  getAccountsForHqStateAssignment,
} from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { unassignedOnly = true, limit } = body;

    const filters = { unassignedOnly, limit };

    // Get accounts that match the filters to determine count
    const accounts = getAccountsForHqStateAssignment(filters);

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No accounts found matching the specified filters',
        totalAccounts: 0,
      });
    }

    const name = `HQ State Assignment${unassignedOnly ? ' (unassigned only)' : ' (all)'} - ${accounts.length} accounts`;
    const jobId = createCategorizationJob(name, accounts.length, filters);

    console.log(`Created HQ state job ${jobId}: ${name}`);

    return NextResponse.json({
      success: true,
      jobId,
      totalAccounts: accounts.length,
    });
  } catch (error) {
    console.error('Failed to create HQ state job:', error);
    return NextResponse.json(
      { error: 'Failed to create HQ state job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
