import { NextResponse } from 'next/server';
import { getProspectList, updateProspectList, deleteProspectList } from '@/lib/db';

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

    return NextResponse.json(list);
  } catch (error) {
    console.error('Error fetching prospect list:', error);
    return NextResponse.json({ error: 'Failed to fetch list' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const id = parseInt(listId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const updated = updateProspectList(id, body);
    if (!updated) return NextResponse.json({ error: 'List not found' }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating prospect list:', error);
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const id = parseInt(listId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const deleted = deleteProspectList(id);
    if (!deleted) return NextResponse.json({ error: 'List not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prospect list:', error);
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
  }
}
