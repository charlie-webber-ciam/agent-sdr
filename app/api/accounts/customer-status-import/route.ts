import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';

import { Account, createAccount, getDb } from '@/lib/db';
import { CustomerStatus, normalizeCustomerStatus } from '@/lib/customer-status';

const COLUMN_ALIASES: Record<string, string> = {
  'account name': 'company_name',
  'account_name': 'company_name',
  'company name': 'company_name',
  'company_name': 'company_name',
  'customer status': 'customer_status',
  'customer_status': 'customer_status',
  'website': 'domain',
  'domain': 'domain',
  'primary industry': 'industry',
  'primary_industry': 'industry',
  'industry': 'industry',
};

function normalizeRecords(records: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (records.length === 0) return records;

  const actualHeaders = Object.keys(records[0]);
  const headerMap: Record<string, string> = {};

  for (const header of actualHeaders) {
    const normalized = COLUMN_ALIASES[header.toLowerCase().trim()];
    if (normalized) {
      headerMap[header] = normalized;
    }
  }

  if (actualHeaders.every((header) => !headerMap[header] || headerMap[header] === header)) {
    return records;
  }

  return records.map((record) => {
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const internalKey = headerMap[key] || key;
      if (!(internalKey in mapped)) {
        mapped[internalKey] = value;
      }
    }
    return mapped;
  });
}

function normalizeCompanyKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function addAccountToLookupMaps(
  account: LookupAccount,
  accountsByDomain: Map<string, LookupAccount[]>,
  accountsByCompanyKey: Map<string, LookupAccount[]>
) {
  if (account.domain) {
    const existingDomainMatches = accountsByDomain.get(account.domain) || [];
    existingDomainMatches.push(account);
    accountsByDomain.set(account.domain, existingDomainMatches);
  }

  const companyKey = normalizeCompanyKey(account.company_name);
  const existingCompanyMatches = accountsByCompanyKey.get(companyKey) || [];
  existingCompanyMatches.push(account);
  accountsByCompanyKey.set(companyKey, existingCompanyMatches);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileContent = await file.text();

    let records: Array<Record<string, unknown>>;
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    if (records.length > 15000) {
      return NextResponse.json(
        { error: `Too many rows. Maximum is 15,000, got ${records.length}` },
        { status: 400 }
      );
    }

    records = normalizeRecords(records);

    const firstRecord = records[0];
    if (!('company_name' in firstRecord)) {
      return NextResponse.json(
        {
          error: 'Missing required column: Account Name',
          hint: 'CSV must include "Account Name" and "Customer Status". Extra columns are ignored.',
        },
        { status: 400 }
      );
    }

    if (!('customer_status' in firstRecord)) {
      return NextResponse.json(
        {
          error: 'Missing required column: Customer Status',
          hint: 'Accepted values are blank, "Okta Customer", "Auth0 Customer", or "Common Customer".',
        },
        { status: 400 }
      );
    }

    const invalidStatuses: string[] = [];
    const dedupedRecords = new Map<string, {
      companyName: string;
      customerStatus: CustomerStatus | null;
      domain: string | null;
      industry: string | null;
    }>();
    let csvDuplicates = 0;

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const companyName = normalizeOptionalString(record.company_name);

      if (!companyName) {
        return NextResponse.json({ error: `Row ${index + 2} has an empty Account Name` }, { status: 400 });
      }

      const rawCustomerStatus = typeof record.customer_status === 'string' ? record.customer_status : '';
      const customerStatus = normalizeCustomerStatus(rawCustomerStatus);
      if (rawCustomerStatus.trim() && !customerStatus) {
        invalidStatuses.push(`Row ${index + 2}: "${rawCustomerStatus}"`);
        continue;
      }

      const domain = normalizeOptionalString(record.domain)?.toLowerCase() || null;
      const industry = normalizeOptionalString(record.industry);
      const lookupKey = domain ? `domain:${domain}` : `name:${normalizeCompanyKey(companyName)}`;

      if (dedupedRecords.has(lookupKey)) {
        csvDuplicates += 1;
      }

      dedupedRecords.set(lookupKey, {
        companyName,
        customerStatus,
        domain,
        industry,
      });
    }

    if (invalidStatuses.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid Customer Status values found',
          details: invalidStatuses.slice(0, 10),
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const existingAccounts = db.prepare('SELECT * FROM accounts ORDER BY id').all() as Account[];
    const accountsByDomain = new Map<string, LookupAccount[]>();
    const accountsByCompanyKey = new Map<string, LookupAccount[]>();

    for (const account of existingAccounts) {
      addAccountToLookupMaps(account, accountsByDomain, accountsByCompanyKey);
    }

    const updateStmt = db.prepare(`
      UPDATE accounts
      SET customer_status = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);

    let createdAccounts = 0;
    let updatedAccounts = 0;
    let matchedRows = 0;
    let clearedAccounts = 0;

    const runImport = db.transaction(() => {
      for (const record of dedupedRecords.values()) {
        const matches = record.domain
          ? accountsByDomain.get(record.domain) || accountsByCompanyKey.get(normalizeCompanyKey(record.companyName)) || []
          : accountsByCompanyKey.get(normalizeCompanyKey(record.companyName)) || [];

        if (matches.length > 0) {
          matchedRows += 1;
          for (const match of matches) {
            updateStmt.run(record.customerStatus, match.id);
            match.customer_status = record.customerStatus;
            updatedAccounts += 1;
            if (record.customerStatus === null) {
              clearedAccounts += 1;
            }
          }
          continue;
        }

        const accountId = createAccount(
          record.companyName,
          record.domain,
          record.industry || '',
          null,
          undefined,
          undefined,
          record.customerStatus
        );

        createdAccounts += 1;

        addAccountToLookupMaps(
          {
            id: accountId,
            company_name: record.companyName,
            domain: record.domain,
            customer_status: record.customerStatus,
          },
          accountsByDomain,
          accountsByCompanyKey
        );
      }
    });

    runImport();

    return NextResponse.json({
      success: true,
      totalRows: records.length,
      processedRows: dedupedRecords.size,
      csvDuplicates,
      matchedRows,
      updatedAccounts,
      createdAccounts,
      clearedAccounts,
      message: `Processed ${dedupedRecords.size} accounts: ${updatedAccounts} updated, ${createdAccounts} created.`,
    });
  } catch (error) {
    console.error('Customer status import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import customer statuses',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
type LookupAccount = Pick<Account, 'id' | 'company_name' | 'domain' | 'customer_status'>;
