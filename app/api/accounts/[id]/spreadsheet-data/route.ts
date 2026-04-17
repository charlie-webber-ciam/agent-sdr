import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const accountId = parseInt(id);
  if (isNaN(accountId)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
  }

  const db = getDb();
  const row = db.prepare(
    'SELECT research_status, sdr_notes, command_of_message, spreadsheet_perspective, spreadsheet_messaging FROM accounts WHERE id = ?'
  ).get(accountId) as any;

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    status: row.research_status,
    sdrNotes: row.sdr_notes ?? null,
    commandOfMessage: row.command_of_message ?? null,
    spreadsheetPerspective: row.spreadsheet_perspective ?? null,
    spreadsheetMessaging: row.spreadsheet_messaging ?? null,
  });
}
