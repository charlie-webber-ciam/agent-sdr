import { NextResponse } from 'next/server';
import { summarizeAccountActivities } from '@/lib/activity-summarizer-agent';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const summary = await summarizeAccountActivities(accountId);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error summarizing activities:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to summarize activities' },
      { status: 500 }
    );
  }
}
