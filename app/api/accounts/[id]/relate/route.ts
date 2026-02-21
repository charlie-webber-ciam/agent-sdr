import { NextResponse } from 'next/server';
import { getAccount, createAccountRelationship } from '@/lib/db';

const VALID_TYPES = ['duplicate', 'parent', 'subsidiary', 'formerly_known_as', 'not_duplicate'] as const;
type RelationshipType = typeof VALID_TYPES[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await request.json();
    const { relatedAccountId, relationshipType } = body;

    if (!relatedAccountId || typeof relatedAccountId !== 'number') {
      return NextResponse.json({ error: 'relatedAccountId is required' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(relationshipType as RelationshipType)) {
      return NextResponse.json({ error: `relationshipType must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    const relatedAccount = getAccount(relatedAccountId);
    if (!relatedAccount) {
      return NextResponse.json({ error: 'Related account not found' }, { status: 404 });
    }

    createAccountRelationship(accountId, relatedAccountId, relationshipType as RelationshipType);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating account relationship:', error);
    return NextResponse.json({ error: 'Failed to create relationship' }, { status: 500 });
  }
}
