import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const VALID_STATUSES = new Set(['new', 'engaged', 'warm', 'cold']);
const MAX_IDS = 1000;

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { ids, relationship_status } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    if (ids.length > MAX_IDS) {
      return NextResponse.json({ error: `Cannot update more than ${MAX_IDS} prospects at once` }, { status: 400 });
    }

    if (!relationship_status || !VALID_STATUSES.has(relationship_status)) {
      return NextResponse.json(
        { error: `relationship_status must be one of: ${[...VALID_STATUSES].join(', ')}` },
        { status: 400 }
      );
    }

    // Validate all ids are numbers
    if (!ids.every((id: unknown) => typeof id === 'number' && Number.isInteger(id))) {
      return NextResponse.json({ error: 'All ids must be integers' }, { status: 400 });
    }

    const db = getDb();
    const stmt = db.prepare(
      "UPDATE prospects SET relationship_status = ?, updated_at = datetime('now') WHERE id = ?"
    );

    const updateAll = db.transaction((prospectIds: number[]) => {
      let updated = 0;
      for (const id of prospectIds) {
        const result = stmt.run(relationship_status, id);
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
