import { NextResponse } from 'next/server';
import { updateProspectEdge, deleteProspectEdge } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  try {
    const { edgeId } = await params;
    const edgeIdNum = parseInt(edgeId);
    if (isNaN(edgeIdNum)) {
      return NextResponse.json({ error: 'Invalid edge ID' }, { status: 400 });
    }

    const body = await request.json();
    const { label } = body;

    const edge = updateProspectEdge(edgeIdNum, { label });
    if (!edge) {
      return NextResponse.json({ error: 'Edge not found' }, { status: 404 });
    }

    return NextResponse.json(edge);
  } catch (error) {
    console.error('Error updating prospect edge:', error);
    return NextResponse.json({ error: 'Failed to update edge' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  try {
    const { edgeId } = await params;
    const edgeIdNum = parseInt(edgeId);
    if (isNaN(edgeIdNum)) {
      return NextResponse.json({ error: 'Invalid edge ID' }, { status: 400 });
    }

    const deleted = deleteProspectEdge(edgeIdNum);
    if (!deleted) {
      return NextResponse.json({ error: 'Edge not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prospect edge:', error);
    return NextResponse.json({ error: 'Failed to delete edge' }, { status: 500 });
  }
}
