import { NextResponse } from 'next/server';

import { compareAccounts } from '@/lib/account-similarity';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leftAccountId = parseInt(searchParams.get('leftAccountId') || '', 10);
    const rightAccountId = parseInt(searchParams.get('rightAccountId') || '', 10);

    if (!Number.isFinite(leftAccountId) || !Number.isFinite(rightAccountId)) {
      return NextResponse.json(
        { error: 'leftAccountId and rightAccountId are required.' },
        { status: 400 }
      );
    }

    const comparison = await compareAccounts(leftAccountId, rightAccountId);
    return NextResponse.json(comparison);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compare accounts';
    const status = message.includes('not found') ? 404 : 500;

    console.error('Error comparing accounts:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
