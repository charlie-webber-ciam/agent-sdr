import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { createPreprocessingJob } from '@/lib/db';

// Map common CSV header variations to internal field names.
const COLUMN_ALIASES: Record<string, string> = {
  'account name':        'company_name',
  'account_name':        'company_name',
  'company name':        'company_name',
  'company_name':        'company_name',
  'website':             'domain',
  'domain':              'domain',
  'primary industry':    'industry',
  'primary_industry':    'industry',
  'industry':            'industry',
  'auth0 account owner': 'auth0_account_owner',
  'auth0_account_owner': 'auth0_account_owner',
  'account owner':       'okta_account_owner',
  'account_owner':       'okta_account_owner',
  'okta account owner':  'okta_account_owner',
  'okta_account_owner':  'okta_account_owner',
};

function normalizeRecords(records: any[]): any[] {
  if (records.length === 0) return records;
  const actualHeaders = Object.keys(records[0]);
  const headerMap: Record<string, string> = {};
  for (const header of actualHeaders) {
    const normalized = COLUMN_ALIASES[header.toLowerCase().trim()];
    if (normalized) headerMap[header] = normalized;
  }
  if (actualHeaders.every(h => !headerMap[h] || headerMap[h] === h)) return records;
  return records.map(record => {
    const mapped: any = {};
    for (const [origKey, value] of Object.entries(record)) {
      const internalKey = headerMap[origKey] || origKey;
      if (!(internalKey in mapped)) mapped[internalKey] = value;
    }
    return mapped;
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    let records: any[];
    try {
      records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Failed to parse CSV file. Please check the format.' },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    // Normalize column names (supports both old and new header conventions)
    records = normalizeRecords(records);

    const firstRecord = records[0];
    if (!('company_name' in firstRecord)) {
      return NextResponse.json(
        {
          error: 'Missing required column: Account Name',
          hint: 'CSV must have an "Account Name" column. Optional: Website, Primary Industry',
        },
        { status: 400 }
      );
    }

    // Validate row limit (10,000 max)
    if (records.length > 10000) {
      return NextResponse.json(
        { error: `Too many rows. Maximum 10,000 rows allowed. Found: ${records.length}` },
        { status: 400 }
      );
    }

    // Extract companies (no duplicate removal yet - that happens during preprocessing)
    const companies = records.map((record: any) => ({
      company_name: record.company_name?.trim() || '',
      domain: record.domain?.trim() || null,
      industry: record.industry?.trim() || '',
    }));

    // Filter out empty company names
    const validCompanies = companies.filter((c: any) => c.company_name);

    if (validCompanies.length === 0) {
      return NextResponse.json(
        { error: 'No valid companies found in CSV' },
        { status: 400 }
      );
    }

    // Create preprocessing job
    const jobId = createPreprocessingJob(file.name, validCompanies.length);

    console.log(
      `Created preprocessing job ${jobId}: ${validCompanies.length} companies from ${file.name}`
    );

    return NextResponse.json({
      success: true,
      jobId,
      totalCompanies: validCompanies.length,
      companies: validCompanies,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}
