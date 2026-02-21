import { NextResponse } from 'next/server';
import { getAccount, reorderProspects } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await request.json();
    const { orderedIds, parentChanges } = body;

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 });
    }

    reorderProspects(accountId, orderedIds, parentChanges);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering prospects:', error);
    return NextResponse.json({ error: 'Failed to reorder prospects' }, { status: 500 });
  }
}
