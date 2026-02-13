import { NextResponse } from 'next/server';
import { deleteAccountsByIds } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountIds } = body;

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { error: 'accountIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const ids = accountIds.map(Number).filter((id: number) => !isNaN(id) && id > 0);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No valid account IDs provided' },
        { status: 400 }
      );
    }

    const deletedCount = deleteAccountsByIds(ids);

    return NextResponse.json({
      success: true,
      deletedCount,
      requestedCount: ids.length,
    });
  } catch (error) {
    console.error('Error bulk deleting accounts:', error);
    return NextResponse.json(
      { error: 'Failed to delete accounts' },
      { status: 500 }
    );
  }
}
