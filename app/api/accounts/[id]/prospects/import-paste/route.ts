import { NextResponse } from 'next/server';
import {
  getAccount,
  findExistingProspectByEmailOrName,
  createProspect,
  updateProspectAIData,
} from '@/lib/db';
import { parseZoomInfoText } from '@/lib/zoominfo-parser';
import { assessContactReadiness } from '@/lib/prospect-contact-readiness';
import { buildHierarchyForAccount } from '@/lib/prospect-map-builder-processor';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);

    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await request.json();
    const { text, buildHierarchy } = body as { text: string; buildHierarchy?: boolean };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const parsed = parseZoomInfoText(text);

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: 'Could not parse any prospects from the pasted text. Check the format.' },
        { status: 400 }
      );
    }

    let created = 0;
    let skipped = 0;
    const createdIds: number[] = [];

    for (const p of parsed) {
      // Skip prospects not matching this account's company (different company in paste)
      // Allow through if company name partially matches or account has no strict match needed
      const existing = findExistingProspectByEmailOrName(
        accountId,
        undefined,
        p.first_name,
        p.last_name
      );

      if (existing) {
        skipped++;
        continue;
      }

      // Infer seniority from title
      const seniority = inferSeniority(p.title);
      const roleType = inferRoleType(p.title);

      const prospect = createProspect({
        account_id: accountId,
        first_name: p.first_name,
        last_name: p.last_name,
        title: p.title,
        department: inferDepartment(p.title),
        role_type: roleType,
        relationship_status: 'new',
        source: 'manual',
      });

      try {
        const readiness = assessContactReadiness(prospect);
        updateProspectAIData(prospect.id, {
          seniority_level: seniority,
          contact_readiness: readiness,
        });
      } catch {
        // non-critical
      }

      createdIds.push(prospect.id);
      created++;
    }

    // Optionally build hierarchy after import
    let hierarchyUpdates = 0;
    if (buildHierarchy !== false && created > 0) {
      try {
        const stats = await buildHierarchyForAccount(account);
        hierarchyUpdates = stats.hierarchyUpdates;
      } catch (err) {
        console.error('Hierarchy building failed after import:', err);
        // Non-fatal — prospects are still created
      }
    }

    return NextResponse.json({
      parsed: parsed.length,
      created,
      skipped,
      hierarchyUpdates,
      createdIds,
    });
  } catch (error) {
    console.error('Failed to import pasted prospects:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

function inferSeniority(title: string): string {
  const t = title.toLowerCase();
  if (/\b(chief|ceo|cto|cfo|coo|cio|ciso|cpo|cmo)\b/.test(t)) return 'c_suite';
  if (/\b(vp|vice president|svp|evp)\b/.test(t)) return 'vp';
  if (/\b(director)\b/.test(t)) return 'director';
  if (/\b(head|manager|lead)\b/.test(t)) return 'manager';
  if (/\b(controller|architect|engineer|analyst|specialist)\b/.test(t)) return 'individual_contributor';
  return 'unknown';
}

function inferRoleType(title: string): string {
  const t = title.toLowerCase();
  if (/\b(chief|ceo|cto|cfo|coo|cio|ciso|vp|vice president|svp|evp|president)\b/.test(t)) return 'decision_maker';
  if (/\b(director|head)\b/.test(t)) return 'influencer';
  if (/\b(manager|lead|controller)\b/.test(t)) return 'champion';
  return 'unknown';
}

function inferDepartment(title: string): string {
  const t = title.toLowerCase();
  if (/\b(security|ciso|risk|governance|compliance)\b/.test(t)) return 'Security';
  if (/\b(engineer|development|developer|tech|cto|delivery|platform)\b/.test(t)) return 'Engineering';
  if (/\b(it |information technology|infrastructure|operations|application)\b/.test(t)) return 'IT';
  if (/\b(product|cpo)\b/.test(t)) return 'Product';
  if (/\b(finance|financial|cfo|controller|billing|payments)\b/.test(t)) return 'Finance';
  if (/\b(people|culture|hr|human)\b/.test(t)) return 'People';
  if (/\b(strategy|business development)\b/.test(t)) return 'Strategy';
  if (/\b(ceo|coo|chief executive|chief operating|project management)\b/.test(t)) return 'Executive';
  if (/\b(investment|registry)\b/.test(t)) return 'Operations';
  return 'Other';
}
