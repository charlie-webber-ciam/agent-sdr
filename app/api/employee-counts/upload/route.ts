import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { createEmployeeCountJob } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read and parse CSV
    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Validate CSV has required column
    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    const firstRecord = records[0] as any;
    // Support multiple naming conventions for the account name column
    const nameKey = ['Account Name', 'account_name', 'company_name', 'Account_Name', 'Company_Name']
      .find(k => firstRecord[k] !== undefined);
    if (!nameKey) {
      return NextResponse.json(
        { error: 'CSV must have an "Account Name" or "company_name" column' },
        { status: 400 }
      );
    }

    // Normalize to account_name
    const accounts = records.map((record: any) => ({
      account_name: record[nameKey],
    })).filter((account: any) => account.account_name); // Remove empty entries

    if (accounts.length === 0) {
      return NextResponse.json({ error: 'No valid accounts found in CSV' }, { status: 400 });
    }

    // Create job in database
    const jobId = createEmployeeCountJob(file.name, accounts.length);

    return NextResponse.json({
      jobId,
      totalAccounts: accounts.length,
      accounts, // Return accounts for processing
      message: `CSV uploaded successfully. ${accounts.length} accounts ready for processing.`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process CSV' },
      { status: 500 }
    );
  }
}
