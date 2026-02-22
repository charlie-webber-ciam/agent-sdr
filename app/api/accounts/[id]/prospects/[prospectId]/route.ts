import { NextResponse } from 'next/server';
import { getProspect, updateProspect, deleteProspect } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; prospectId: string }> }
) {
  try {
    const { id, prospectId } = await params;
    const accountId = parseInt(id);
    const pId = parseInt(prospectId);

    if (isNaN(accountId) || isNaN(pId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const prospect = getProspect(pId);
    if (!prospect || prospect.account_id !== accountId) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    return NextResponse.json(prospect);
  } catch (error) {
    console.error('Error fetching prospect:', error);
    return NextResponse.json({ error: 'Failed to fetch prospect' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; prospectId: string }> }
) {
  try {
    const { id, prospectId } = await params;
    const accountId = parseInt(id);
    const pId = parseInt(prospectId);

    if (isNaN(accountId) || isNaN(pId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const existing = getProspect(pId);
    if (!existing || existing.account_id !== accountId) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      'first_name', 'last_name', 'title', 'email', 'phone', 'linkedin_url',
      'department', 'notes', 'role_type', 'relationship_status', 'source',
      'mailing_address', 'lead_source', 'last_activity_date', 'do_not_call',
      'description', 'parent_prospect_id', 'sort_order',
      'value_tier', 'seniority_level', 'ai_summary', 'ai_processed_at',
      'department_tag', 'prospect_tags',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const updated = updateProspect(pId, updates);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating prospect:', error);
    return NextResponse.json({ error: 'Failed to update prospect' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; prospectId: string }> }
) {
  try {
    const { id, prospectId } = await params;
    const accountId = parseInt(id);
    const pId = parseInt(prospectId);

    if (isNaN(accountId) || isNaN(pId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const existing = getProspect(pId);
    if (!existing || existing.account_id !== accountId) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    deleteProspect(pId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting prospect:', error);
    return NextResponse.json({ error: 'Failed to delete prospect' }, { status: 500 });
  }
}
