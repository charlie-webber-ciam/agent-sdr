import { NextResponse } from 'next/server';
import { getAccount, bulkUpsertProspectPositions } from '@/lib/db';

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
    const { positions } = body;

    if (!Array.isArray(positions)) {
      return NextResponse.json({ error: 'positions must be an array' }, { status: 400 });
    }

    bulkUpsertProspectPositions(
      accountId,
      positions.map((p: { prospectId?: number; ghostKey?: string; x: number; y: number; nodeType?: string }) => ({
        prospectId: p.prospectId || null,
        ghostKey: p.ghostKey || null,
        x: p.x,
        y: p.y,
        nodeType: p.nodeType || 'structured',
      }))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving prospect positions:', error);
    return NextResponse.json({ error: 'Failed to save positions' }, { status: 500 });
  }
}
