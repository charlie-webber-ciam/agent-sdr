import { NextResponse } from 'next/server';
import { reorderListItems } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;
    const id = parseInt(listId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    if (!body.orderedProspectIds || !Array.isArray(body.orderedProspectIds)) {
      return NextResponse.json({ error: 'orderedProspectIds array is required' }, { status: 400 });
    }

    reorderListItems(id, body.orderedProspectIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering list items:', error);
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
  }
}
