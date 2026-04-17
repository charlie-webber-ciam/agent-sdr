import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountOverviewInputSchema, buildOverviewRecordFromStorage, normalizeOverviewInput } from '@/lib/account-overview';
import { getAccount, upsertAccountOverview } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (Number.isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const raw = await request.json();
    const overview = accountOverviewInputSchema.parse(normalizeOverviewInput(raw));
    const editedAt = new Date().toISOString();

    const stored = upsertAccountOverview(accountId, {
      priorities_json: JSON.stringify(overview.priorities),
      value_drivers_json: JSON.stringify(overview.valueDrivers),
      triggers_json: JSON.stringify(overview.triggers),
      business_model_markdown: overview.businessModelMarkdown,
      business_structure_json: JSON.stringify(overview.businessStructure),
      tech_stack_json: JSON.stringify(overview.techStack),
      pov_markdown: overview.povMarkdown,
      last_edited_at: editedAt,
    });

    return NextResponse.json({
      success: true,
      overview: buildOverviewRecordFromStorage(stored),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid overview payload', details: error.issues }, { status: 400 });
    }

    console.error('Error saving account overview:', error);
    return NextResponse.json({ error: 'Failed to save account overview' }, { status: 500 });
  }
}
