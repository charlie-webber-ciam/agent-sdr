import { NextResponse } from 'next/server';
import { getProspectList, getProspectListItems, addProspectsToList, removeProspectFromList } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const id = parseInt(listId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const list = getProspectList(id);
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

    const items = getProspectListItems(id);
    return NextResponse.json({ items, list });
  } catch (error) {
    console.error('Error fetching list items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const id = parseInt(listId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    if (!body.prospectIds || !Array.isArray(body.prospectIds)) {
      return NextResponse.json({ error: 'prospectIds array is required' }, { status: 400 });
    }

    const added = addProspectsToList(id, body.prospectIds);
    return NextResponse.json({ added }, { status: 201 });
  } catch (error) {
    console.error('Error adding prospects to list:', error);
    return NextResponse.json({ error: 'Failed to add prospects' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const id = parseInt(listId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    if (!body.prospectId) return NextResponse.json({ error: 'prospectId is required' }, { status: 400 });

    const removed = removeProspectFromList(id, body.prospectId);
    return NextResponse.json({ removed });
  } catch (error) {
    console.error('Error removing prospect from list:', error);
    return NextResponse.json({ error: 'Failed to remove prospect' }, { status: 500 });
  }
}
