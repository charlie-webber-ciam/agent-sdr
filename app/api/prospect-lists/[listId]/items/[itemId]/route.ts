import { NextResponse } from 'next/server';
import { markListItemCompleted } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  try {
    const { listId, itemId } = await params;
    const lId = parseInt(listId);
    const prospectId = parseInt(itemId);
    if (isNaN(lId) || isNaN(prospectId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    markListItemCompleted(lId, prospectId, !!body.completed);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating list item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}
