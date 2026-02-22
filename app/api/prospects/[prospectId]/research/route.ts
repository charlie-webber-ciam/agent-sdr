import { NextResponse } from 'next/server';
import { getProspect, updateProspectAIData, getAccount } from '@/lib/db';
import { researchProspect } from '@/lib/prospect-researcher';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  try {
    const { prospectId } = await params;
    const pId = parseInt(prospectId);
    if (isNaN(pId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const prospect = getProspect(pId);
    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

    const account = getAccount(prospect.account_id);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const result = await researchProspect(
      `${prospect.first_name} ${prospect.last_name}`,
      account.company_name,
      account.domain,
      account.industry
    );

    const updated = updateProspectAIData(pId, {
      ai_summary: result.summary,
      ai_processed_at: new Date().toISOString(),
      seniority_level: result.seniority_level,
      department_tag: result.department_tag,
      value_tier: result.value_tier_suggestion,
      prospect_tags: JSON.stringify(result.key_signals),
    });

    return NextResponse.json({ prospect: updated, research: result });
  } catch (error) {
    console.error('Error researching prospect:', error);
    return NextResponse.json({ error: 'Failed to research prospect' }, { status: 500 });
  }
}
