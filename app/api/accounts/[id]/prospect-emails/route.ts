import { NextResponse } from 'next/server';
import { getProspectEmailsByAccount } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const emails = getProspectEmailsByAccount(accountId);
    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Failed to get prospect emails:', error);
    return NextResponse.json(
      { error: 'Failed to get emails' },
      { status: 500 }
    );
  }
}
