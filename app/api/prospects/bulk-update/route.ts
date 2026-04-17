import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const VALID_RELATIONSHIP_STATUSES = new Set(['new', 'engaged', 'warm', 'cold']);
const VALID_PROSPECT_STATUSES = new Set(['active', 'working', 'nurture', 'unqualified', 'no_longer_at_company']);
const MAX_IDS = 1000;

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { ids, relationship_status, prospect_status } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    if (ids.length > MAX_IDS) {
      return NextResponse.json({ error: `Cannot update more than ${MAX_IDS} prospects at once` }, { status: 400 });
    }

    if (!relationship_status && !prospect_status) {
      return NextResponse.json(
        { error: 'At least one of relationship_status or prospect_status is required' },
        { status: 400 }
      );
    }

    if (relationship_status && !VALID_RELATIONSHIP_STATUSES.has(relationship_status)) {
      return NextResponse.json(
        { error: `relationship_status must be one of: ${[...VALID_RELATIONSHIP_STATUSES].join(', ')}` },
        { status: 400 }
      );
    }

    if (prospect_status && !VALID_PROSPECT_STATUSES.has(prospect_status)) {
      return NextResponse.json(
        { error: `prospect_status must be one of: ${[...VALID_PROSPECT_STATUSES].join(', ')}` },
        { status: 400 }
      );
    }

    if (!ids.every((id: unknown) => typeof id === 'number' && Number.isInteger(id))) {
      return NextResponse.json({ error: 'All ids must be integers' }, { status: 400 });
    }

    const db = getDb();

    const setClauses: string[] = [];
    const setParams: any[] = [];
    if (relationship_status) {
      setClauses.push('relationship_status = ?');
      setParams.push(relationship_status);
    }
    if (prospect_status) {
      setClauses.push('prospect_status = ?');
      setParams.push(prospect_status);
    }
    setClauses.push("updated_at = datetime('now')");

    const stmt = db.prepare(
      `UPDATE prospects SET ${setClauses.join(', ')} WHERE id = ?`
    );

    const updateAll = db.transaction((prospectIds: number[]) => {
      let updated = 0;
      for (const id of prospectIds) {
        const result = stmt.run(...setParams, id);
        updated += result.changes;
      }
      return updated;
    });

    const updated = updateAll(ids);

    return NextResponse.json({ updated, total: ids.length });
  } catch (error) {
    console.error('Error bulk updating prospects:', error);
    return NextResponse.json({ error: 'Failed to bulk update prospects' }, { status: 500 });
  }
}
