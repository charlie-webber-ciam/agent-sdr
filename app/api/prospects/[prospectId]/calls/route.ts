import { NextResponse } from 'next/server';
import { getProspect, getProspectCalls, createProspectCall, updateProspectCallCounts } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  try {
    const { prospectId } = await params;
    const pId = parseInt(prospectId);
    if (isNaN(pId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const calls = getProspectCalls(pId);
    return NextResponse.json({ calls });
  } catch (error) {
    console.error('Error fetching prospect calls:', error);
    return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  try {
    const { prospectId } = await params;
    const pId = parseInt(prospectId);
    if (isNaN(pId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const prospect = getProspect(pId);
    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

    const body = await request.json();
    const call = createProspectCall({
      prospect_id: pId,
      account_id: prospect.account_id,
      outcome: body.outcome,
      notes: body.notes,
      duration_sec: body.duration_sec,
      called_at: body.called_at,
    });

    updateProspectCallCounts(pId);
    return NextResponse.json(call, { status: 201 });
  } catch (error) {
    console.error('Error creating prospect call:', error);
    return NextResponse.json({ error: 'Failed to create call' }, { status: 500 });
  }
}
