import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { createJob, createAccount, findDuplicateDomains, updateJobTotalAccounts } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = (formData.get('mode') as string) || 'research';

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

    const requiredColumns = ['company_name', 'industry'];
    const firstRecord = records[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRecord));

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingColumns.join(', ')}`,
          hint: 'CSV must have columns: company_name, industry (domain is optional)'
        },
        { status: 400 }
      );
    }

    // Validate max 10000 accounts
    if (records.length > 10000) {
      return NextResponse.json(
        { error: `Too many accounts. Maximum is 10,000, got ${records.length}` },
        { status: 400 }
      );
    }

    // Validate each record has non-empty required values
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record.company_name || !record.industry) {
        return NextResponse.json(
          {
            error: `Row ${i + 2} has empty required fields (company_name or industry)`
          },
          { status: 400 }
        );
      }
    }

    // Remove duplicates within CSV (keep first occurrence)
    const seenDomains = new Set<string>();
    const deduplicatedRecords: any[] = [];
    const csvDuplicateRecords: any[] = [];

    for (const record of records) {
      const domain = record.domain?.toLowerCase().trim();

      if (domain) {
        // Has a domain - check if we've seen it before in this CSV
        if (seenDomains.has(domain)) {
          csvDuplicateRecords.push(record);
          continue; // Skip this duplicate
        }
        seenDomains.add(domain);
      }

      // Either no domain, or first occurrence of this domain
      deduplicatedRecords.push(record);
    }

    // Extract domains from deduplicated records for database check
    const domainsToCheck = deduplicatedRecords
      .filter(r => r.domain && r.domain.trim())
      .map(r => r.domain.toLowerCase().trim());

    // Check for existing accounts with these domains in database
    const existingDomains = domainsToCheck.length > 0 ? findDuplicateDomains(domainsToCheck) : [];

    // Filter out records with domains that exist in database
    const newRecords = deduplicatedRecords.filter(record => {
      const domain = record.domain?.toLowerCase().trim();
      // Include if no domain or domain doesn't exist in database
      return !domain || !existingDomains.includes(domain);
    });

    const dbDuplicateRecords = deduplicatedRecords.filter(record => {
      const domain = record.domain?.toLowerCase().trim();
      // Skip if domain exists in database
      return domain && existingDomains.includes(domain);
    });

    // Calculate total skipped
    const totalSkipped = csvDuplicateRecords.length + dbDuplicateRecords.length;

    if (newRecords.length === 0) {
      return NextResponse.json(
        {
          error: 'No new accounts to import',
          totalRecords: records.length,
          csvDuplicates: csvDuplicateRecords.length,
          dbDuplicates: dbDuplicateRecords.length,
          totalSkipped: totalSkipped,
          existingDomains: existingDomains,
          message: `All ${records.length} accounts were duplicates (${csvDuplicateRecords.length} within CSV, ${dbDuplicateRecords.length} already in database).`
        },
        { status: 400 }
      );
    }

    // Create processing job with NEW accounts count
    const jobId = createJob(file.name, newRecords.length);

    // Insert only new accounts
    let lateSkipped = 0;
    for (const record of newRecords) {
      const domain = record.domain?.trim() ? record.domain.toLowerCase().trim() : null;
      try {
        createAccount(
          record.company_name,
          domain,
          record.industry,
          jobId,
          record.auth0_account_owner || undefined,
          record.okta_account_owner || undefined
        );
      } catch (err: any) {
        if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          lateSkipped++;
          continue;
        }
        throw err;
      }
    }

    // Adjust job total and counts if any were skipped at insert time
    const actualInserted = newRecords.length - lateSkipped;
    if (lateSkipped > 0) {
      updateJobTotalAccounts(jobId, actualInserted);
    }

    if (actualInserted === 0) {
      return NextResponse.json(
        {
          error: 'No new accounts to import',
          totalRecords: records.length,
          csvDuplicates: csvDuplicateRecords.length,
          dbDuplicates: dbDuplicateRecords.length + lateSkipped,
          totalSkipped: totalSkipped + lateSkipped,
          message: `All ${records.length} accounts were duplicates.`
        },
        { status: 400 }
      );
    }

    // Only auto-trigger processing in research mode
    if (mode === 'research') {
      fetch(`${request.headers.get('origin')}/api/process/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      }).catch(err => {
        console.error('Failed to trigger processing:', err);
      });
    }

    // Build detailed message
    const totalDbDuplicates = dbDuplicateRecords.length + lateSkipped;
    let message = `Successfully uploaded ${actualInserted} new accounts`;
    const messageParts: string[] = [];

    if (csvDuplicateRecords.length > 0) {
      messageParts.push(`${csvDuplicateRecords.length} CSV duplicates removed`);
    }
    if (totalDbDuplicates > 0) {
      messageParts.push(`${totalDbDuplicates} already in database`);
    }

    if (messageParts.length > 0) {
      message += `. Skipped: ${messageParts.join(', ')}.`;
    }

    return NextResponse.json({
      success: true,
      jobId,
      totalRecords: records.length,
      newAccounts: actualInserted,
      csvDuplicates: csvDuplicateRecords.length,
      dbDuplicates: totalDbDuplicates,
      totalSkipped: totalSkipped + lateSkipped,
      message: message,
      mode,
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
