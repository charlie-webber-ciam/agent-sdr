import { NextResponse } from 'next/server';
import { createAccountsFromUnmatchedActivities } from '@/lib/activity-importer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jobId, accountNames, csvContent } = body;

    if (!jobId || typeof jobId !== 'number') {
      return NextResponse.json({ error: 'jobId is required and must be a number' }, { status: 400 });
    }
    if (!Array.isArray(accountNames) || accountNames.length === 0) {
      return NextResponse.json({ error: 'accountNames must be a non-empty array' }, { status: 400 });
    }
    if (accountNames.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 account names per request' }, { status: 400 });
    }
    if (!csvContent || typeof csvContent !== 'string') {
      return NextResponse.json({ error: 'csvContent is required' }, { status: 400 });
    }

    const result = createAccountsFromUnmatchedActivities(jobId, accountNames, csvContent);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating accounts from unmatched activities:', error);
    return NextResponse.json({ error: 'Failed to create accounts' }, { status: 500 });
  }
}
