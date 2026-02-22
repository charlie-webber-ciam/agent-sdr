import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import {
  findAccountByDomainOrName,
  bulkCreateProspects,
  createProspectImportJob,
  updateProspectImportJob,
  getProspectsByAccount,
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

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
      source?: string;
    }> = [];
    const unmatched: Array<Record<string, string>> = [];

    for (const record of normalizedRecords) {
      if (!record.first_name || !record.last_name) continue;

      const accountName = record.account_name || '';
      const account = accountName ? findAccountByDomainOrName(null, accountName) : undefined;

      if (account) {
        matched.push({
          account_id: account.id,
          first_name: record.first_name,
          last_name: record.last_name,
          title: record.title || undefined,
          email: record.email || undefined,
          phone: record.phone || undefined,
          mobile: record.mobile || undefined,
          linkedin_url: record.linkedin_url || undefined,
          department: record.department || undefined,
          mailing_address: record.mailing_address || undefined,
          lead_source: record.lead_source || undefined,
          do_not_call: record.do_not_call === 'true' || record.do_not_call === '1' ? 1 : 0,
          description: record.description || undefined,
          source: 'salesforce_import',
        });
      } else {
        unmatched.push(record);
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

    for (const [accountId, prospects] of byAccount) {
      const existing = getProspectsByAccount(accountId);
      for (const p of prospects) {
        const isDup = existing.some(e => {
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
        if (isDup) {
          skippedCount++;
        } else {
          dedupedMatched.push(p);
          // Add to local existing list so same CSV doesn't create intra-file dups
          existing.push({ first_name: p.first_name, last_name: p.last_name, email: p.email } as any);
        }
      }
    }

    let createdCount = 0;
    if (dedupedMatched.length > 0) {
      createdCount = bulkCreateProspects(dedupedMatched);

      // Set contact_readiness for newly imported rows
      const db = getDb();
      db.prepare(`
        UPDATE prospects SET contact_readiness = CASE
          WHEN (phone IS NOT NULL OR mobile IS NOT NULL) AND (do_not_call IS NULL OR do_not_call = 0) THEN 'dial_ready'
          WHEN email IS NOT NULL THEN 'email_ready'
          WHEN linkedin_url IS NOT NULL THEN 'social_ready'
          ELSE 'incomplete'
        END WHERE contact_readiness IS NULL
      `).run();
    }

    updateProspectImportJob(jobId, {
      matched_count: matched.length,
      unmatched_count: unmatched.length,
      created_count: createdCount,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      jobId,
      totalContacts: normalizedRecords.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      createdCount,
      skippedCount,
      unmatchedContacts: unmatched.slice(0, 100), // Limit unmatched preview
    });
  } catch (error) {
    console.error('Error importing prospects:', error);
    return NextResponse.json({ error: 'Failed to import prospects' }, { status: 500 });
  }
}
