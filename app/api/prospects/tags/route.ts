import { NextResponse } from 'next/server';
import { getProspectFilterMetadata } from '@/lib/db';

export async function GET() {
  try {
    const metadata = getProspectFilterMetadata();
    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error fetching prospect tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}
