import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import {
  findAccountByDomainOrName,
  findAccountFuzzy,
  bulkCreateProspects,
  createProspectImportJob,
  updateProspectImportJob,
  getProspectsByAccount,
  updateProspect,
  getDb,
} from '@/lib/db';

const COLUMN_ALIASES: Record<string, string> = {
  'first name': 'first_name',
  'firstname': 'first_name',
  'first_name': 'first_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'last_name': 'last_name',
  'account name': 'account_name',
  'account': 'account_name',
  'company': 'account_name',
  'company name': 'account_name',
  'title': 'title',
  'job title': 'title',
  'email': 'email',
  'email address': 'email',
  'phone': 'phone',
  'phone number': 'phone',
  'mobile': 'mobile',
  'mobile phone': 'mobile',
  'department': 'department',
  'mailing address': 'mailing_address',
  'address': 'mailing_address',
  'mailing_address': 'mailing_address',
  'lead source': 'lead_source',
  'lead_source': 'lead_source',
  'leadsource': 'lead_source',
  'do not call': 'do_not_call',
  'do_not_call': 'do_not_call',
  'donotcall': 'do_not_call',
  'description': 'description',
  'linkedin': 'linkedin_url',
  'linkedin url': 'linkedin_url',
  'linkedin_url': 'linkedin_url',
  // Salesforce ID fields
  'contact id': 'sfdc_id',
  'contact_id': 'sfdc_id',
  'lead id': 'sfdc_id',
  'lead_id': 'sfdc_id',
  'sfdc_id': 'sfdc_id',
  // Lead-specific fields
  'reporting matched account': 'matched_account',
  'reporting matched account owner': 'matched_account_owner',
  'company / account': 'company_account',
  // Address parts (contact reports)
  'mailing street': 'mailing_street',
  'mailing city': 'mailing_city',
  'mailing state/province': 'mailing_state',
  'mailing zip/postal code': 'mailing_zip',
  'mailing country': 'mailing_country',
  // Address parts (lead reports)
  'street': 'street',
  'country': 'country',
  'region': 'region',
  // Enriched data
  'enriched mobile': 'enriched_mobile',
  'enriched phone': 'enriched_mobile',
  'enriched phone number': 'enriched_mobile',
  // Owner
  'account owner': 'account_owner',
};

function normalizeHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    if (COLUMN_ALIASES[normalized]) {
      mapping[header] = COLUMN_ALIASES[normalized];
    }
  }
  return mapping;
}

/**
 * Resolve the account name from a normalized record.
 * Leads: prefer "Reporting Matched Account", fall back to "Company / Account"
 * Contacts: use "Account Name"
 */
function resolveAccountName(record: Record<string, string>): string {
  return record.matched_account || record.account_name || record.company_account || '';
}

/**
 * Resolve the mailing address from separate fields or a combined field.
 */
function resolveMailingAddress(record: Record<string, string>): string {
  if (record.mailing_address) return record.mailing_address;
  const parts = [
    record.mailing_street || record.street,
    record.mailing_city,
    record.mailing_state,
    record.mailing_zip,
    record.mailing_country || record.country,
  ].filter(Boolean);
  return parts.join(', ');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sfdcType = (formData.get('sfdc_type') as string) || null; // 'lead' or 'contact'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    const headers = Object.keys(records[0]);
    const headerMapping = normalizeHeaders(headers);

    // Normalize each record
    const normalizedRecords = records.map(record => {
      const normalized: Record<string, string> = {};
      for (const [originalHeader, value] of Object.entries(record)) {
        const mappedKey = headerMapping[originalHeader];
        if (mappedKey) {
          normalized[mappedKey] = value;
        }
      }
      return normalized;
    });

    // Check required fields
    const hasFirstName = normalizedRecords.some(r => r.first_name);
    const hasLastName = normalizedRecords.some(r => r.last_name);
    if (!hasFirstName || !hasLastName) {
      return NextResponse.json(
        { error: 'CSV must contain First Name and Last Name columns' },
        { status: 400 }
      );
    }

    const jobId = createProspectImportJob(file.name, normalizedRecords.length);

    // Cache account lookups to avoid repeated DB queries for the same name
    const accountCache = new Map<string, { id: number; name: string } | null>();
    function findAccount(name: string): { id: number; name: string } | null {
      if (!name) return null;
      const cacheKey = name.toLowerCase();
      if (accountCache.has(cacheKey)) return accountCache.get(cacheKey)!;

      // Try exact match first, then fuzzy
      let account = findAccountByDomainOrName(null, name);
      if (!account) {
        const fuzzy = findAccountFuzzy(name);
        account = fuzzy.exact || fuzzy.fuzzy[0] || undefined;
      }
      const result = account ? { id: account.id, name: account.company_name } : null;
      accountCache.set(cacheKey, result);
      return result;
    }

    const matched: Array<{
      account_id: number;
      first_name: string;
      last_name: string;
      title?: string;
      email?: string;
      phone?: string;
      mobile?: string;
      linkedin_url?: string;
      department?: string;
      mailing_address?: string;
      lead_source?: string;
      do_not_call?: number;
      description?: string;
      notes?: string;
      source?: string;
      sfdc_id?: string;
      sfdc_type?: string;
      _enriched_mobile?: string; // stored separately after bulk insert
    }> = [];
    const unmatched: Array<{ name: string; company: string }> = [];

    // Track which accounts received prospects
    const affectedAccounts = new Map<number, { name: string; count: number }>();

    for (const record of normalizedRecords) {
      if (!record.first_name || !record.last_name) continue;

      const accountName = resolveAccountName(record);
      const accountMatch = findAccount(accountName);

      if (accountMatch) {
        const accountId = accountMatch.id;
        // Build notes for leads: include matched account owner (Okta owner)
        let notes: string | undefined;
        if (sfdcType === 'lead' && record.matched_account_owner) {
          notes = `Okta Owner: ${record.matched_account_owner}`;
        }

        const existing = affectedAccounts.get(accountId);
        if (existing) {
          existing.count++;
        } else {
          affectedAccounts.set(accountId, { name: accountMatch.name, count: 1 });
        }

        matched.push({
          account_id: accountId,
          first_name: record.first_name,
          last_name: record.last_name,
          title: record.title || undefined,
          email: record.email || undefined,
          phone: record.phone || undefined,
          mobile: record.mobile || undefined,
          linkedin_url: record.linkedin_url || undefined,
          department: record.department || undefined,
          mailing_address: resolveMailingAddress(record) || undefined,
          lead_source: record.lead_source || undefined,
          do_not_call: record.do_not_call === 'true' || record.do_not_call === '1' ? 1 : 0,
          description: record.description || undefined,
          notes,
          source: 'salesforce_import',
          sfdc_id: record.sfdc_id || undefined,
          sfdc_type: sfdcType || undefined,
          _enriched_mobile: record.enriched_mobile || undefined,
        });
      } else {
        unmatched.push({
          name: `${record.first_name} ${record.last_name}`,
          company: accountName,
        });
      }
    }

    // Dedup: group by account_id, check against existing prospects
    const byAccount = new Map<number, typeof matched>();
    for (const m of matched) {
      if (!byAccount.has(m.account_id)) byAccount.set(m.account_id, []);
      byAccount.get(m.account_id)!.push(m);
    }

    const dedupedMatched: typeof matched = [];
    let skippedCount = 0;
    let updatedCount = 0;

    // Fields that can be backfilled on existing prospects
    const MERGE_FIELDS = [
      'title', 'email', 'phone', 'mobile', 'linkedin_url', 'department',
      'mailing_address', 'lead_source', 'description', 'sfdc_id', 'sfdc_type',
      'notes', '_enriched_mobile',
    ] as const;

    for (const [accountId, prospects] of byAccount) {
      const existing = getProspectsByAccount(accountId);
      for (const p of prospects) {
        const dupMatch = existing.find(e => {
          if (p.email && e.email) {
            return e.email.toLowerCase() === p.email.toLowerCase();
          }
          if (!p.email && !e.email) {
            return (
              e.first_name.toLowerCase() === p.first_name.toLowerCase() &&
              e.last_name.toLowerCase() === p.last_name.toLowerCase()
            );
          }
          return false;
        });
        if (dupMatch) {
          // Merge: fill in any fields that are missing on the existing prospect
          const updates: Record<string, any> = {};
          for (const field of MERGE_FIELDS) {
            const newVal = (p as any)[field];
            if (!newVal) continue;
            // _enriched_mobile is handled separately after insert
            if (field === '_enriched_mobile') {
              const existingVal = (dupMatch as any).enriched_mobile;
              if (!existingVal) updates.enriched_mobile = newVal;
              continue;
            }
            const existingVal = (dupMatch as any)[field];
            if (!existingVal) {
              updates[field] = newVal;
            }
          }
          if (Object.keys(updates).length > 0) {
            updateProspect(dupMatch.id, updates);
            updatedCount++;
          }
          skippedCount++;
        } else {
          dedupedMatched.push(p);
          existing.push({ first_name: p.first_name, last_name: p.last_name, email: p.email } as any);
        }
      }
    }

    let createdCount = 0;
    if (dedupedMatched.length > 0) {
      // Strip _enriched_mobile before bulk insert (not a standard prospect column)
      const enrichedMobileMap = new Map<string, string>();
      const toInsert = dedupedMatched.map(({ _enriched_mobile, ...rest }) => {
        if (_enriched_mobile && rest.email) {
          enrichedMobileMap.set(rest.email.toLowerCase(), _enriched_mobile);
        }
        return rest;
      });

      createdCount = bulkCreateProspects(toInsert);

      // Set contact_readiness, sfdc_type, and enriched_mobile for newly imported rows
      const db = getDb();
      db.prepare(`
        UPDATE prospects SET contact_readiness = CASE
          WHEN (phone IS NOT NULL OR mobile IS NOT NULL) AND (do_not_call IS NULL OR do_not_call = 0) THEN 'dial_ready'
          WHEN email IS NOT NULL THEN 'email_ready'
          WHEN linkedin_url IS NOT NULL THEN 'social_ready'
          ELSE 'incomplete'
        END WHERE contact_readiness IS NULL
      `).run();

      // Update enriched_mobile for prospects that have it (column may not exist on older DBs)
      if (enrichedMobileMap.size > 0) {
        try {
          const updateStmt = db.prepare('UPDATE prospects SET enriched_mobile = ? WHERE LOWER(email) = ? AND enriched_mobile IS NULL');
          for (const [email, enrichedMobile] of enrichedMobileMap) {
            updateStmt.run(enrichedMobile, email);
          }
        } catch {
          // Column may not exist yet — migration runs on next restart
        }
      }
    }

    updateProspectImportJob(jobId, {
      matched_count: matched.length,
      unmatched_count: unmatched.length,
      created_count: createdCount,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // Build affected accounts list sorted by count desc
    const affectedAccountsList = Array.from(affectedAccounts.entries())
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      jobId,
      totalContacts: normalizedRecords.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      createdCount,
      skippedCount,
      updatedCount,
      unmatchedContacts: unmatched.slice(0, 100),
      affectedAccounts: affectedAccountsList,
    });
  } catch (error) {
    console.error('Error importing prospects:', error);
    return NextResponse.json({ error: 'Failed to import prospects' }, { status: 500 });
  }
}
