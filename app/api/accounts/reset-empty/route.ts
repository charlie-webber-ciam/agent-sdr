import { NextResponse } from 'next/server';
import { getEmptyCompletedAccountCount, resetEmptyCompletedAccounts } from '@/lib/db';

export async function GET() {
  try {
    const count = getEmptyCompletedAccountCount();
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Failed to get empty-completed account count:', error);
    return NextResponse.json({ error: 'Failed to query accounts' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const resetCount = resetEmptyCompletedAccounts();
    return NextResponse.json({ resetCount });
  } catch (error) {
    console.error('Failed to reset empty-completed accounts:', error);
    return NextResponse.json({ error: 'Failed to reset accounts' }, { status: 500 });
  }
}
