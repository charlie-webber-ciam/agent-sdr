import { NextResponse } from 'next/server';
import { findPotentialDuplicateAccounts } from '@/lib/db';

export async function GET() {
  try {
    const pairs = findPotentialDuplicateAccounts();
    return NextResponse.json({ pairs, total: pairs.length });
  } catch (error) {
    console.error('Error finding duplicate accounts:', error);
    return NextResponse.json({ error: 'Failed to find duplicate accounts' }, { status: 500 });
  }
}
