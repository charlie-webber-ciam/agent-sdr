import { NextRequest, NextResponse } from 'next/server';
import { getAccount, getProspectsByAccount, updateProspectAIData } from '@/lib/db';
import { classifyAccountProspects, OrgMapperRequest } from '@/lib/prospect-org-mapper-agent';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);
    if (isNaN(accountId)) {
      return NextResponse.json({ success: false, error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    const prospects = getProspectsByAccount(accountId);
    if (prospects.length === 0) {
      return NextResponse.json({ success: false, error: 'No prospects found for this account' }, { status: 400 });
    }

    const agentRequest: OrgMapperRequest = {
      prospects: prospects.map(p => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        title: p.title,
        email: p.email,
        department: p.department,
        linkedin_url: p.linkedin_url,
      })),
      company_name: account.company_name,
      industry: account.industry,
    };

    const result = await classifyAccountProspects(agentRequest);

    // Update each prospect in the database
    let updatedCount = 0;
    for (const c of result.classifications) {
      updateProspectAIData(c.id, {
        department_tag: c.department,
        seniority_level: c.seniority,
        icp_fit: c.icp_fit ? 1 : 0,
        icp_reason: c.icp_reason || undefined,
      });
      updatedCount++;
    }

    // Build response with prospect details
    const prospectMap = new Map(prospects.map(p => [p.id, p]));
    const results = result.classifications.map(c => {
      const p = prospectMap.get(c.id);
      return {
        prospect_id: c.id,
        first_name: p?.first_name || '',
        last_name: p?.last_name || '',
        title: p?.title || null,
        department: c.department,
        seniority: c.seniority,
        icp_fit: c.icp_fit,
        icp_reason: c.icp_reason,
      };
    });

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      total_prospects: prospects.length,
      summary: result.summary,
      results,
    });
  } catch (error) {
    console.error('[map-prospects] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to map prospects' },
      { status: 500 }
    );
  }
}
