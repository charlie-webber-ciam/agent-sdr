import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { createJob, createAccount, findDuplicateDomains } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();

    // Parse CSV
    let records: any[];
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid CSV format' },
        { status: 400 }
      );
    }

    // Validate CSV has required columns
    if (records.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    const requiredColumns = ['company_name', 'domain', 'industry'];
    const firstRecord = records[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRecord));

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingColumns.join(', ')}`,
          hint: 'CSV must have columns: company_name, domain, industry'
        },
        { status: 400 }
      );
    }

    // Validate max 100 accounts
    if (records.length > 100) {
      return NextResponse.json(
        { error: `Too many accounts. Maximum is 100, got ${records.length}` },
        { status: 400 }
      );
    }

    // Validate each record has non-empty values
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record.company_name || !record.domain || !record.industry) {
        return NextResponse.json(
          {
            error: `Row ${i + 2} has empty required fields (company_name, domain, or industry)`
          },
          { status: 400 }
        );
      }
    }

    // Extract all domains from CSV and normalize them
    const domains = records.map(r => r.domain.toLowerCase().trim());

    // Check for duplicates within the CSV itself
    const csvDuplicates = domains.filter((domain, index) =>
      domains.indexOf(domain) !== index
    );

    if (csvDuplicates.length > 0) {
      return NextResponse.json(
        {
          error: 'CSV contains duplicate domains',
          duplicates: [...new Set(csvDuplicates)],
          hint: 'Each domain should appear only once in the CSV'
        },
        { status: 400 }
      );
    }

    // Check for existing accounts with these domains
    const existingDomains = findDuplicateDomains(domains);

    // Filter out records with existing domains
    const newRecords = records.filter(
      record => !existingDomains.includes(record.domain.toLowerCase().trim())
    );
    const skippedRecords = records.filter(
      record => existingDomains.includes(record.domain.toLowerCase().trim())
    );

    if (newRecords.length === 0) {
      return NextResponse.json(
        {
          error: 'All accounts already exist',
          totalRecords: records.length,
          skippedCount: skippedRecords.length,
          skippedDomains: existingDomains,
          message: 'No new accounts to import. All domains already exist in the database.'
        },
        { status: 400 }
      );
    }

    // Create processing job with NEW accounts count
    const jobId = createJob(file.name, newRecords.length);

    // Insert only new accounts
    for (const record of newRecords) {
      createAccount(
        record.company_name,
        record.domain.toLowerCase().trim(),
        record.industry,
        jobId
      );
    }

    // Trigger background processing
    // We'll make a non-blocking call to start the processing
    fetch(`${request.headers.get('origin')}/api/process/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch(err => {
      console.error('Failed to trigger processing:', err);
    });

    return NextResponse.json({
      success: true,
      jobId,
      totalRecords: records.length,
      newAccounts: newRecords.length,
      skippedCount: skippedRecords.length,
      skippedDomains: existingDomains,
      message: skippedRecords.length > 0
        ? `Successfully uploaded ${newRecords.length} new accounts. Skipped ${skippedRecords.length} duplicates.`
        : `Successfully uploaded ${newRecords.length} accounts`,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
