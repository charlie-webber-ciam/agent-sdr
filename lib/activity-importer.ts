import { parse } from 'csv-parse/sync';
import {
  Account,
  findAccountFuzzy,
  createActivityImportJob,
  getActivityImportJob,
  updateActivityImportJob,
  createActivity,
  findExistingActivity,
  getDb,
} from './db';

// Column header alias map — maps CSV headers to internal field names
const HEADER_ALIASES: Record<string, string> = {
  'created date': 'created_date',
  'date': 'created_date',
  'subject': 'subject',
  'subject line': 'subject',
  'comments': 'comments',
  'comment': 'comments',
  'body': 'comments',
  'notes': 'comments',
  'account name': 'account_name',
  'account': 'account_name',
  'company': 'account_name',
  'company name': 'account_name',
};

interface NormalizedRow {
  created_date: string;
  subject: string;
  comments: string;
  account_name: string;
}

export interface AccountMatchResult {
  accountName: string;
  status: 'exact' | 'fuzzy_single' | 'ambiguous' | 'unmatched';
  matchedAccount?: Account;
  candidates?: Account[];
}

export interface ActivityImportResult {
  jobId: number;
  totalRows: number;
  matchedAccounts: AccountMatchResult[];
  unmatchedAccounts: AccountMatchResult[];
  ambiguousAccounts: AccountMatchResult[];
  activitiesCreated: number;
}

function normalizeHeaders(row: Record<string, string>): NormalizedRow {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const key = HEADER_ALIASES[header.toLowerCase().trim()];
    if (key) {
      normalized[key] = (value || '').trim();
    }
  }
  return normalized as unknown as NormalizedRow;
}

/**
 * Parse date from D/MM/YYYY or DD/MM/YYYY format to ISO YYYY-MM-DD
 */
function parseDateToISO(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;

  const trimmed = dateStr.trim();

  // Try D/MM/YYYY or DD/MM/YYYY
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];

    // Basic validation
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try ISO format as fallback
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  return null;
}

export async function importActivityCSV(csvContent: string, filename: string): Promise<ActivityImportResult> {
  // Step 1: Parse CSV
  const rawRows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows = rawRows.map(normalizeHeaders);

  // Step 2: Validate required columns
  if (rows.length === 0) {
    throw new Error('CSV file has no data rows');
  }

  // Check that at least account_name and subject exist by inspecting first row
  const firstRow = rows[0];
  if (!firstRow.account_name && firstRow.account_name !== '') {
    throw new Error('CSV must have an "Account Name" column');
  }
  if (!firstRow.subject && firstRow.subject !== '') {
    throw new Error('CSV must have a "Subject" column');
  }

  // Filter out rows without required fields
  const validRows = rows.filter(r => r.account_name && r.subject);

  if (validRows.length === 0) {
    throw new Error('No valid rows found (each row needs account_name and subject)');
  }

  // Create import job
  const jobId = createActivityImportJob(filename);
  updateActivityImportJob(jobId, {
    total_rows: validRows.length,
    status: 'processing',
  });

  // Step 3: Group rows by account name
  const rowsByAccount = new Map<string, NormalizedRow[]>();
  for (const row of validRows) {
    const name = row.account_name;
    if (!rowsByAccount.has(name)) {
      rowsByAccount.set(name, []);
    }
    rowsByAccount.get(name)!.push(row);
  }

  // Step 4: Match accounts
  const accountMatches = new Map<string, AccountMatchResult>();
  for (const accountName of rowsByAccount.keys()) {
    const result = findAccountFuzzy(accountName);

    if (result.exact) {
      accountMatches.set(accountName, {
        accountName,
        status: 'exact',
        matchedAccount: result.exact,
      });
    } else if (result.fuzzy.length === 1) {
      accountMatches.set(accountName, {
        accountName,
        status: 'fuzzy_single',
        matchedAccount: result.fuzzy[0],
      });
    } else if (result.fuzzy.length > 1) {
      accountMatches.set(accountName, {
        accountName,
        status: 'ambiguous',
        candidates: result.fuzzy,
      });
    } else {
      accountMatches.set(accountName, {
        accountName,
        status: 'unmatched',
      });
    }
  }

  // Step 5: Import activities for matched accounts
  let activitiesCreated = 0;

  const matchedResults: AccountMatchResult[] = [];
  const unmatchedResults: AccountMatchResult[] = [];
  const ambiguousResults: AccountMatchResult[] = [];

  for (const match of accountMatches.values()) {
    if (match.status === 'ambiguous') {
      ambiguousResults.push(match);
      continue;
    }
    if (match.status === 'unmatched') {
      unmatchedResults.push(match);
      continue;
    }

    matchedResults.push(match);
    const account = match.matchedAccount!;
    const accountRows = rowsByAccount.get(match.accountName) || [];

    for (const row of accountRows) {
      const createdDate = parseDateToISO(row.created_date);
      const subject = row.subject;
      const comments = row.comments || '';

      // Dedup check
      if (findExistingActivity(account.id, createdDate, subject)) {
        continue;
      }

      createActivity(account.id, createdDate, subject, comments, jobId);
      activitiesCreated++;
    }
  }

  // Update job with final counts
  updateActivityImportJob(jobId, {
    matched_accounts: matchedResults.length,
    unmatched_accounts: unmatchedResults.length,
    ambiguous_accounts: ambiguousResults.length,
    activities_created: activitiesCreated,
    status: ambiguousResults.length > 0 ? 'pending_resolution' : 'completed',
    completed_at: ambiguousResults.length > 0 ? undefined : new Date().toISOString(),
  });

  return {
    jobId,
    totalRows: validRows.length,
    matchedAccounts: matchedResults,
    unmatchedAccounts: unmatchedResults,
    ambiguousAccounts: ambiguousResults,
    activitiesCreated,
  };
}

/**
 * Resolve ambiguous account matches and import their activities
 */
export function resolveAmbiguousActivityMatches(
  jobId: number,
  resolutions: Array<{ accountName: string; selectedAccountId: number }>,
  csvContent: string
): { activitiesCreated: number } {
  // Re-parse the CSV
  const rawRows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows = rawRows.map(normalizeHeaders);

  // Group rows by account name
  const rowsByAccount = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    if (!row.account_name || !row.subject) continue;
    if (!rowsByAccount.has(row.account_name)) {
      rowsByAccount.set(row.account_name, []);
    }
    rowsByAccount.get(row.account_name)!.push(row);
  }

  let activitiesCreated = 0;

  for (const resolution of resolutions) {
    const accountId = resolution.selectedAccountId;
    const accountRows = rowsByAccount.get(resolution.accountName) || [];

    for (const row of accountRows) {
      const createdDate = parseDateToISO(row.created_date);
      const subject = row.subject;
      const comments = row.comments || '';

      if (findExistingActivity(accountId, createdDate, subject)) {
        continue;
      }

      createActivity(accountId, createdDate, subject, comments, jobId);
      activitiesCreated++;
    }
  }

  // Update job
  const job = getActivityImportJob(jobId);
  if (job) {
    updateActivityImportJob(jobId, {
      matched_accounts: (job.matched_accounts || 0) + resolutions.length,
      ambiguous_accounts: Math.max(0, (job.ambiguous_accounts || 0) - resolutions.length),
      activities_created: (job.activities_created || 0) + activitiesCreated,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  }

  return { activitiesCreated };
}

/**
 * Create minimal account records for unmatched CSV account names,
 * then import their activities.
 */
export function createAccountsFromUnmatchedActivities(
  jobId: number,
  accountNames: string[],
  csvContent: string
): { accountsCreated: number; activitiesCreated: number; createdAccounts: Array<{ id: number; company_name: string }> } {
  const db = getDb();

  // Re-parse the CSV
  const rawRows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows = rawRows.map(normalizeHeaders);

  const rowsByAccount = new Map<string, NormalizedRow[]>();
  for (const row of rows) {
    if (!row.account_name || !row.subject) continue;
    if (!rowsByAccount.has(row.account_name)) {
      rowsByAccount.set(row.account_name, []);
    }
    rowsByAccount.get(row.account_name)!.push(row);
  }

  let activitiesCreated = 0;
  const createdAccounts: Array<{ id: number; company_name: string }> = [];
  const now = Date.now();

  for (let i = 0; i < accountNames.length; i++) {
    const name = accountNames[i];
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const domain = `no-domain-${sanitized}-${now}-${i}.placeholder`;

    const insertResult = db.prepare(`
      INSERT INTO accounts (company_name, domain, industry, job_id)
      VALUES (?, ?, 'Unknown', NULL)
    `).run(name, domain);
    const accountId = insertResult.lastInsertRowid as number;
    createdAccounts.push({ id: accountId, company_name: name });

    const accountRows = rowsByAccount.get(name) || [];
    for (const row of accountRows) {
      const createdDate = parseDateToISO(row.created_date);
      createActivity(accountId, createdDate, row.subject, row.comments || '', jobId);
      activitiesCreated++;
    }
  }

  // Update job stats
  const job = getActivityImportJob(jobId);
  if (job) {
    updateActivityImportJob(jobId, {
      matched_accounts: (job.matched_accounts || 0) + accountNames.length,
      unmatched_accounts: Math.max(0, (job.unmatched_accounts || 0) - accountNames.length),
      activities_created: (job.activities_created || 0) + activitiesCreated,
    });
  }

  return { accountsCreated: accountNames.length, activitiesCreated, createdAccounts };
}

// Re-export for convenience
export { getActivityImportJob };
