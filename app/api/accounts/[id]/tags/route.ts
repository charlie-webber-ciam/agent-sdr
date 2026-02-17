import { NextResponse } from 'next/server';
import { getAccount, getAccountTags, addAccountTag, removeAccountTag } from '@/lib/db';

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

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const tags = getAccountTags(accountId);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

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
    const { tag, tagType } = body;

    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      return NextResponse.json({ error: 'Tag is required' }, { status: 400 });
    }

    if (tagType !== 'preset' && tagType !== 'custom') {
      return NextResponse.json({ error: 'tagType must be "preset" or "custom"' }, { status: 400 });
    }

    const newTag = addAccountTag(accountId, tag.trim(), tagType);
    return NextResponse.json({ tag: newTag });
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Tag already exists on this account' }, { status: 409 });
    }
    console.error('Error adding tag:', error);
    return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const body = await request.json();
    const { tag } = body;

    if (!tag || typeof tag !== 'string') {
      return NextResponse.json({ error: 'Tag is required' }, { status: 400 });
    }

    const removed = removeAccountTag(accountId, tag);
    if (!removed) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing tag:', error);
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
  }
}
