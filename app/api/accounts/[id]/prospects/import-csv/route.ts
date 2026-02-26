import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import {
  getAccount,
  findExistingProspectByEmailOrName,
  createProspect,
  updateProspectAIData,
} from '@/lib/db';
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const buildHierarchy = formData.get('buildHierarchy') !== 'false';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const csvText = await file.text();
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    const createdIds: number[] = [];

    for (const row of records) {
      // Normalize column names (Salesforce classic uses various casings)
      const normalized = normalizeColumns(row);

      const firstName = normalized.first_name;
      const lastName = normalized.last_name;
      const title = normalized.title;

      if (!firstName || !lastName) {
        skipped++;
        continue;
      }

      // Check for duplicates
      const existing = findExistingProspectByEmailOrName(
        accountId,
        normalized.email || undefined,
        firstName,
        lastName
      );

      if (existing) {
        skipped++;
        continue;
      }

      const seniority = title ? inferSeniority(title) : 'unknown';
      const roleType = title ? inferRoleType(title) : 'unknown';
      const department = title ? inferDepartment(title) : 'Other';

      const prospect = createProspect({
        account_id: accountId,
        first_name: firstName,
        last_name: lastName,
        title: title || undefined,
        email: normalized.email || undefined,
        phone: normalized.phone || undefined,
        department,
        role_type: roleType,
        relationship_status: 'new',
        source: normalized.source === 'salesforce' ? 'salesforce_import' : 'manual',
        lead_source: normalized.lead_source || undefined,
        last_activity_date: normalized.last_activity_date || undefined,
        sfdc_id: normalized.sfdc_id || undefined,
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

    // Build hierarchy after import
    let hierarchyUpdates = 0;
    if (buildHierarchy && created > 0) {
      try {
        const stats = await buildHierarchyForAccount(account);
        hierarchyUpdates = stats.hierarchyUpdates;
      } catch (err) {
        console.error('Hierarchy building failed after CSV import:', err);
      }
    }

    return NextResponse.json({
      totalRows: records.length,
      created,
      skipped,
      hierarchyUpdates,
      createdIds,
    });
  } catch (error) {
    console.error('Failed to import CSV prospects:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}

/**
 * Normalize Salesforce CSV column names to a consistent format.
 * Handles various casings and naming conventions.
 */
function normalizeColumns(row: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  const keyMap: Record<string, string> = {};

  // Build lowercase lookup
  for (const key of Object.keys(row)) {
    keyMap[key.toLowerCase().replace(/[\s_-]+/g, '_')] = row[key];
  }

  result.first_name = keyMap.first_name || keyMap.firstname || keyMap.first || '';
  result.last_name = keyMap.last_name || keyMap.lastname || keyMap.last || '';
  result.title = keyMap.title || keyMap.job_title || keyMap.jobtitle || '';
  result.email = keyMap.email || keyMap.email_address || '';
  result.phone = keyMap.phone || keyMap.phone_number || keyMap.business_phone || '';
  result.lead_source = keyMap.lead_source || keyMap.leadsource || '';
  result.last_activity_date = keyMap.last_activity_date || keyMap.last_activity || keyMap.date_added || keyMap.created_date || '';
  result.sfdc_id = keyMap.contact_id || keyMap.id || keyMap.sfdc_id || '';
  result.account_name = keyMap.account_name || keyMap.company || keyMap.company_name || '';
  result.source = 'salesforce';

  return result;
}

function inferSeniority(title: string): string {
  const t = title.toLowerCase();
  if (/\b(chief|ceo|cto|cfo|coo|cio|ciso|cpo|cmo)\b/.test(t)) return 'c_suite';
  if (/\b(vp|vice president|svp|evp)\b/.test(t)) return 'vp';
  if (/\b(director)\b/.test(t)) return 'director';
  if (/\b(head|manager|lead)\b/.test(t)) return 'manager';
  return 'individual_contributor';
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
  if (/\b(ceo|coo|chief executive|chief operating)\b/.test(t)) return 'Executive';
  return 'Other';
}
