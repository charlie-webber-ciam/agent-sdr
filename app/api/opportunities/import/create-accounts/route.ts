import { NextResponse } from 'next/server';
import { createAccountsFromUnmatched } from '@/lib/opportunity-importer';

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
    if (accountNames.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 account names per request' }, { status: 400 });
    }
    if (!csvContent || typeof csvContent !== 'string') {
      return NextResponse.json({ error: 'csvContent is required' }, { status: 400 });
    }

    const result = createAccountsFromUnmatched(jobId, accountNames, csvContent);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating accounts from unmatched:', error);
    return NextResponse.json({ error: 'Failed to create accounts' }, { status: 500 });
  }
}
