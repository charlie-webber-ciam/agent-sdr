import { NextResponse } from 'next/server';
import { getAccount, createProspectEdge } from '@/lib/db';

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
    const { sourceProspectId, sourceGhostKey, targetProspectId, targetGhostKey, label } = body;

    if (!sourceProspectId && !sourceGhostKey) {
      return NextResponse.json({ error: 'Source prospect or ghost key required' }, { status: 400 });
    }
    if (!targetProspectId && !targetGhostKey) {
      return NextResponse.json({ error: 'Target prospect or ghost key required' }, { status: 400 });
    }

    const edge = createProspectEdge({
      account_id: accountId,
      source_prospect_id: sourceProspectId || null,
      source_ghost_key: sourceGhostKey || null,
      target_prospect_id: targetProspectId || null,
      target_ghost_key: targetGhostKey || null,
      label: label || null,
    });

    return NextResponse.json(edge);
  } catch (error) {
    console.error('Error creating prospect edge:', error);
    return NextResponse.json({ error: 'Failed to create edge' }, { status: 500 });
  }
}
