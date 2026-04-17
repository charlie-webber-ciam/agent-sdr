import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildOverviewRecordFromStorage, hasMeaningfulOverviewContent } from '@/lib/account-overview';
import { generateAccountOverviewDraft } from '@/lib/account-overview-agent';
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
    if (!overwrite && hasMeaningfulOverviewContent(existingOverview)) {
      return NextResponse.json({ error: 'Overview draft already exists', code: 'overview_exists' }, { status: 409 });
    }

    const notes = getAccountNotes(accountId);
    const keyPeople = getProspectsByAccount(accountId).filter((prospect) => (
      KEY_PERSON_ROLES.has(prospect.role_type || '') ||
      SENIOR_TITLE_PATTERN.test(prospect.title || '')
    ));

    const overview = await generateAccountOverviewDraft({
      account,
      notes,
      keyPeople,
    });

    const generatedAt = new Date().toISOString();
    const stored = upsertAccountOverview(accountId, {
      priorities_json: JSON.stringify(overview.priorities),
      value_drivers_json: JSON.stringify(overview.valueDrivers),
      triggers_json: JSON.stringify(overview.triggers),
      business_model_markdown: overview.businessModelMarkdown,
      business_structure_json: JSON.stringify(overview.businessStructure),
      tech_stack_json: JSON.stringify(overview.techStack),
      generated_at: generatedAt,
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

    console.error('Error generating account overview:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate overview draft' }, { status: 500 });
  }
}
