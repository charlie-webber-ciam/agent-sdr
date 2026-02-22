import { NextResponse } from 'next/server';
import { getProspectsWithFilters, createProspectList, addProspectsToList } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, list_type, filters, account_id } = body;
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const { prospects } = getProspectsWithFilters({ ...filters, limit: 10000, offset: 0 });
    if (prospects.length === 0) {
      return NextResponse.json({ error: 'No prospects match filters' }, { status: 400 });
    }

    const list = createProspectList({ name, list_type: list_type || 'call', account_id });
    const ids = prospects.map(p => p.id);
    addProspectsToList(list.id, ids);

    return NextResponse.json({ listId: list.id, count: ids.length }, { status: 201 });
  } catch (error) {
    console.error('Error building prospect list:', error);
    return NextResponse.json({ error: 'Failed to build list' }, { status: 500 });
  }
}
