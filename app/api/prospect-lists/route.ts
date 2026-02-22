import { NextResponse } from 'next/server';
import { getAllProspectLists, createProspectList } from '@/lib/db';

export async function GET() {
  try {
    const lists = getAllProspectLists();
    return NextResponse.json({ lists });
  } catch (error) {
    console.error('Error fetching prospect lists:', error);
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const list = createProspectList({
      name: body.name,
      description: body.description,
      list_type: body.list_type,
      filters: body.filters ? JSON.stringify(body.filters) : undefined,
    });

    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    console.error('Error creating prospect list:', error);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
