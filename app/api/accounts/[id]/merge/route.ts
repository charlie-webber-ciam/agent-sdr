import { NextResponse } from 'next/server';
import { getAccount, mergeAccounts } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const keepId = parseInt(id);
    if (isNaN(keepId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(keepId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await request.json();
    const { mergeFromId } = body;
    if (!mergeFromId || typeof mergeFromId !== 'number') {
      return NextResponse.json({ error: 'mergeFromId is required' }, { status: 400 });
    }
    if (mergeFromId === keepId) {
      return NextResponse.json({ error: 'Cannot merge an account with itself' }, { status: 400 });
    }

    const fromAccount = getAccount(mergeFromId);
    if (!fromAccount) {
      return NextResponse.json({ error: 'Source account not found' }, { status: 404 });
    }

    const result = mergeAccounts(keepId, mergeFromId);
    return NextResponse.json({ ...result, keptAccountId: keepId, deletedAccountId: mergeFromId });
  } catch (error) {
    console.error('Error merging accounts:', error);
    return NextResponse.json({ error: 'Failed to merge accounts' }, { status: 500 });
  }
}
