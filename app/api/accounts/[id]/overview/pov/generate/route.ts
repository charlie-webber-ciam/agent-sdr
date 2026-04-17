import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildOverviewRecordFromStorage, hasMeaningfulOverviewContent, hasMeaningfulPov, normalizeOverviewInput } from '@/lib/account-overview';
import { generateAccountOverviewPov } from '@/lib/account-overview-agent';
import { getAccount, getAccountNotes, getAccountOverview, getProspectsByAccount, upsertAccountOverview } from '@/lib/db';

const requestSchema = z.object({
  overwrite: z.boolean().optional().default(false),
});

const KEY_PERSON_ROLES = new Set(['decision_maker', 'champion', 'influencer', 'blocker']);
const SENIOR_TITLE_PATTERN = /\b(chief|ceo|cfo|cmo|ciso|cto|cio|coo|founder|president|managing director|general manager|vp|vice president|head|director)\b/i;

export async function POST(
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

    if (account.research_status !== 'completed') {
      return NextResponse.json({ error: 'Account research not completed yet' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { overwrite } = requestSchema.parse(body);

    const existingOverview = buildOverviewRecordFromStorage(getAccountOverview(accountId));
    if (!hasMeaningfulOverviewContent(existingOverview)) {
      return NextResponse.json({ error: 'Generate or save the account overview before generating the POV' }, { status: 400 });
    }

    if (!overwrite && hasMeaningfulPov(existingOverview)) {
      return NextResponse.json({ error: 'Strategic POV already exists', code: 'pov_exists' }, { status: 409 });
    }

    const notes = getAccountNotes(accountId);
    const keyPeople = getProspectsByAccount(accountId).filter((prospect) => (
      KEY_PERSON_ROLES.has(prospect.role_type || '') ||
      SENIOR_TITLE_PATTERN.test(prospect.title || '')
    ));

    const povMarkdown = await generateAccountOverviewPov({
      account,
      notes,
      keyPeople,
      overview: normalizeOverviewInput(existingOverview),
    });

    const generatedAt = new Date().toISOString();
    const stored = upsertAccountOverview(accountId, {
      pov_markdown: povMarkdown,
      pov_generated_at: generatedAt,
      last_edited_at: generatedAt,
    });

    return NextResponse.json({
      success: true,
      overview: buildOverviewRecordFromStorage(stored),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: error.issues }, { status: 400 });
    }

    console.error('Error generating strategic POV:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate strategic POV' }, { status: 500 });
  }
}
