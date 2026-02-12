import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { createPreprocessingJob } from '@/lib/db';

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

    // Validate required columns
    const requiredColumns = ['company_name', 'industry'];
    const firstRecord = records[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRecord));

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingColumns.join(', ')}. Required: company_name, industry. Optional: domain`,
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
    const validCompanies = companies.filter((c: any) => c.company_name && c.industry);

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
