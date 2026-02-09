import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { migrateDatabase } from './migrate';

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log('✓ Created data directory');
}

const DB_PATH = join(dataDir, 'accounts.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // Initialize schema
    const schema = readFileSync(join(process.cwd(), 'lib', 'schema.sql'), 'utf-8');
    db.exec(schema);

    // Run migrations to add new columns
    migrateDatabase(db);
  }

  return db;
}

// Account types
export interface Account {
  id: number;
  company_name: string;
  domain: string | null;
  industry: string;
  research_status: 'pending' | 'processing' | 'completed' | 'failed';
  current_auth_solution: string | null;
  customer_base_info: string | null;
  security_incidents: string | null;
  news_and_funding: string | null;
  tech_transformation: string | null;
  prospects: string | null; // JSON string
  research_summary: string | null;
  error_message: string | null;
  job_id: number | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  // SDR Enhancement Fields
  tier: 'A' | 'B' | 'C' | null;
  estimated_annual_revenue: string | null;
  estimated_user_volume: string | null;
  use_cases: string | null; // JSON array
  auth0_skus: string | null; // JSON array
  sdr_notes: string | null;
  priority_score: number | null;
  last_edited_at: string | null;
  ai_suggestions: string | null; // JSON
  auth0_account_owner: string | null;
}

export interface ProcessingJob {
  id: number;
  filename: string;
  total_accounts: number;
  processed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_account_id: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CategorizationJob {
  id: number;
  name: string;
  total_accounts: number;
  processed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_account_id: number | null;
  filters: string | null; // JSON string
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Account operations
export function createAccount(
  companyName: string,
  domain: string | null,
  industry: string,
  jobId: number,
  auth0AccountOwner?: string
): number {
  const db = getDb();

  // Generate a unique dummy domain if none provided
  let finalDomain = domain;
  if (!finalDomain) {
    const sanitizedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const timestamp = Date.now();
    finalDomain = `no-domain-${sanitizedName}-${timestamp}.placeholder`;
  }

  const stmt = db.prepare(`
    INSERT INTO accounts (company_name, domain, industry, job_id, auth0_account_owner)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(companyName, finalDomain, industry, jobId, auth0AccountOwner || null);
  return result.lastInsertRowid as number;
}

export function getAccount(id: number): Account | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
  return stmt.get(id) as Account | undefined;
}

export function getAccountsByJob(jobId: number): Account[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM accounts WHERE job_id = ? ORDER BY id');
  return stmt.all(jobId) as Account[];
}

export function getAllAccounts(
  search?: string,
  industry?: string,
  status?: string,
  limit: number = 100,
  offset: number = 0
): Account[] {
  const db = getDb();
  let query = 'SELECT * FROM accounts WHERE 1=1';
  const params: any[] = [];

  if (search) {
    query += ' AND (company_name LIKE ? OR domain LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }

  if (industry) {
    query += ' AND industry = ?';
    params.push(industry);
  }

  if (status) {
    query += ' AND research_status = ?';
    params.push(status);
  }

  query += ' ORDER BY processed_at DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  return stmt.all(...params) as Account[];
}

export function getNextPendingAccount(jobId: number): Account | undefined {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM accounts
    WHERE job_id = ? AND research_status = 'pending'
    ORDER BY id
    LIMIT 1
  `);
  return stmt.get(jobId) as Account | undefined;
}

export function updateAccountStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  errorMessage?: string
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE accounts
    SET research_status = ?,
        error_message = ?,
        updated_at = datetime('now'),
        processed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE processed_at END
    WHERE id = ?
  `);
  stmt.run(status, errorMessage || null, status, id);
}

export function updateAccountResearch(
  id: number,
  research: {
    current_auth_solution?: string;
    customer_base_info?: string;
    security_incidents?: string;
    news_and_funding?: string;
    tech_transformation?: string;
    prospects?: string;
    research_summary?: string;
  }
) {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(research).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return;

  fields.push('updated_at = datetime(\'now\')');
  values.push(id);

  const stmt = db.prepare(`
    UPDATE accounts SET ${fields.join(', ')}
    WHERE id = ?
  `);
  stmt.run(...values);
}

// SDR metadata update function
export function updateAccountMetadata(
  id: number,
  updates: {
    tier?: 'A' | 'B' | 'C' | null;
    estimated_annual_revenue?: string;
    estimated_user_volume?: string;
    use_cases?: string; // JSON string
    auth0_skus?: string; // JSON string
    sdr_notes?: string;
    priority_score?: number;
    last_edited_at?: string;
    ai_suggestions?: string; // JSON string
  }
) {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return;

  fields.push('updated_at = datetime(\'now\')');
  values.push(id);

  const stmt = db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

// Job operations
export function createJob(filename: string, totalAccounts: number): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO processing_jobs (filename, total_accounts)
    VALUES (?, ?)
  `);
  const result = stmt.run(filename, totalAccounts);
  return result.lastInsertRowid as number;
}

export function getJob(id: number): ProcessingJob | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM processing_jobs WHERE id = ?');
  return stmt.get(id) as ProcessingJob | undefined;
}

export function getAllJobs(limit: number = 10): ProcessingJob[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM processing_jobs
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as ProcessingJob[];
}

export function updateJobStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  currentAccountId?: number | null
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE processing_jobs
    SET status = ?,
        current_account_id = ?,
        updated_at = datetime('now'),
        completed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
    WHERE id = ?
  `);
  stmt.run(status, currentAccountId || null, status, id);
}

export function updateJobProgress(id: number, processedCount: number, failedCount: number) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE processing_jobs
    SET processed_count = ?,
        failed_count = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(processedCount, failedCount, id);
}

export function getAccountStats(): {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
} {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN research_status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN research_status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN research_status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN research_status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM accounts
  `);
  return stmt.get() as any;
}

// Enhanced stats with tier and SKU information
export function getEnhancedStats() {
  const db = getDb();

  const basicStats = getAccountStats();

  const tierStats = db.prepare(`
    SELECT
      SUM(CASE WHEN tier = 'A' THEN 1 ELSE 0 END) as tierA,
      SUM(CASE WHEN tier = 'B' THEN 1 ELSE 0 END) as tierB,
      SUM(CASE WHEN tier = 'C' THEN 1 ELSE 0 END) as tierC,
      SUM(CASE WHEN tier IS NULL AND research_status = 'completed' THEN 1 ELSE 0 END) as uncategorized
    FROM accounts
  `).get() as any;

  const skuStats = db.prepare(`
    SELECT
      SUM(CASE WHEN auth0_skus LIKE '%Core%' THEN 1 ELSE 0 END) as skuCore,
      SUM(CASE WHEN auth0_skus LIKE '%FGA%' THEN 1 ELSE 0 END) as skuFGA,
      SUM(CASE WHEN auth0_skus LIKE '%Auth for AI%' THEN 1 ELSE 0 END) as skuAuthForAI
    FROM accounts
    WHERE research_status = 'completed'
  `).get() as any;

  return {
    ...basicStats,
    ...tierStats,
    ...skuStats,
  };
}

// Get high priority accounts
export function getHighPriorityAccounts(limit: number = 5): Account[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM accounts
    WHERE research_status = 'completed' AND priority_score >= 7
    ORDER BY priority_score DESC, last_edited_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as Account[];
}

// Duplicate detection functions
export function findAccountByDomain(domain: string): Account | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM accounts WHERE domain = ?');
  return stmt.get(domain) as Account | undefined;
}

export function findDuplicateDomains(domains: string[]): string[] {
  const db = getDb();
  const placeholders = domains.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT domain FROM accounts
    WHERE domain IN (${placeholders})
  `);
  const results = stmt.all(...domains) as Array<{ domain: string }>;
  return results.map(r => r.domain);
}

// Account deletion function
export function deleteAccount(id: number): boolean {
  const db = getDb();

  try {
    // Delete the account (CASCADE will handle foreign keys if needed)
    const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting account:', error);
    return false;
  }
}

// Enhanced filtering with tier, SKU, priority
export function getAccountsWithFilters(filters: {
  search?: string;
  industry?: string;
  status?: string;
  tier?: string | 'unassigned';
  sku?: string;
  useCase?: string;
  minPriority?: number;
  revenue?: string;
  accountOwner?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}): Account[] {
  const db = getDb();
  let query = 'SELECT * FROM accounts WHERE 1=1';
  const params: any[] = [];

  if (filters.search) {
    query += ' AND (company_name LIKE ? OR domain LIKE ?)';
    const searchPattern = `%${filters.search}%`;
    params.push(searchPattern, searchPattern);
  }

  if (filters.industry) {
    query += ' AND industry = ?';
    params.push(filters.industry);
  }

  if (filters.status) {
    query += ' AND research_status = ?';
    params.push(filters.status);
  }

  if (filters.tier) {
    if (filters.tier === 'unassigned') {
      query += ' AND tier IS NULL';
    } else {
      query += ' AND tier = ?';
      params.push(filters.tier);
    }
  }

  if (filters.sku) {
    query += ' AND auth0_skus LIKE ?';
    params.push(`%${filters.sku}%`);
  }

  if (filters.useCase) {
    query += ' AND use_cases LIKE ?';
    params.push(`%${filters.useCase}%`);
  }

  if (filters.minPriority !== undefined) {
    query += ' AND priority_score >= ?';
    params.push(filters.minPriority);
  }

  if (filters.revenue) {
    query += ' AND estimated_annual_revenue LIKE ?';
    params.push(`%${filters.revenue}%`);
  }

  if (filters.accountOwner) {
    if (filters.accountOwner === 'unassigned') {
      query += " AND (auth0_account_owner IS NULL OR auth0_account_owner = '')";
    } else {
      query += ' AND auth0_account_owner LIKE ?';
      params.push(`%${filters.accountOwner}%`);
    }
  }

  // Sorting (default to priority_score)
  const sortBy = filters.sortBy || 'priority_score';
  const validSortFields = ['processed_at', 'priority_score', 'tier', 'company_name', 'created_at'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'priority_score';
  query += ` ORDER BY ${sortField} DESC, created_at DESC`;

  // Pagination
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  return stmt.all(...params) as Account[];
}

// Retry functionality for failed accounts
export function resetAccountToPending(accountId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE accounts
    SET research_status = 'pending',
        error_message = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(accountId);
}

// Reset multiple accounts to pending (useful for reprocessing)
export function resetAccountsToPending(accountIds: number[]): number {
  if (accountIds.length === 0) return 0;

  const db = getDb();
  const placeholders = accountIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    UPDATE accounts
    SET research_status = 'pending',
        error_message = NULL,
        updated_at = datetime('now')
    WHERE id IN (${placeholders})
  `);
  const result = stmt.run(...accountIds);
  return result.changes;
}

// Get all pending accounts (optionally by job)
export function getPendingAccounts(jobId?: number): Account[] {
  const db = getDb();
  let query = 'SELECT * FROM accounts WHERE research_status = \'pending\'';
  const params: any[] = [];

  if (jobId !== undefined) {
    query += ' AND job_id = ?';
    params.push(jobId);
  }

  query += ' ORDER BY id';

  const stmt = db.prepare(query);
  return stmt.all(...params) as Account[];
}

// Reset job to allow reprocessing
export function resetJobToPending(jobId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE processing_jobs
    SET status = 'pending',
        current_account_id = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(jobId);
}

export function getAccountsByIds(ids: number[]): Account[] {
  if (ids.length === 0) return [];

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT * FROM accounts
    WHERE id IN (${placeholders})
  `);
  return stmt.all(...ids) as Account[];
}

export function updateAccountJobId(accountId: number, jobId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE accounts
    SET job_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(jobId, accountId);
}

// Categorization job operations
export function createCategorizationJob(
  name: string,
  totalAccounts: number,
  filters?: Record<string, any>
): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO categorization_jobs (name, total_accounts, filters)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(name, totalAccounts, filters ? JSON.stringify(filters) : null);
  return result.lastInsertRowid as number;
}

export function getCategorizationJob(id: number): CategorizationJob | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM categorization_jobs WHERE id = ?');
  return stmt.get(id) as CategorizationJob | undefined;
}

export function getAllCategorizationJobs(limit: number = 10): CategorizationJob[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM categorization_jobs
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as CategorizationJob[];
}

export function updateCategorizationJobStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  currentAccountId?: number | null
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE categorization_jobs
    SET status = ?,
        current_account_id = ?,
        updated_at = datetime('now'),
        completed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
    WHERE id = ?
  `);
  stmt.run(status, currentAccountId || null, status, id);
}

export function updateCategorizationJobProgress(
  id: number,
  processedCount: number,
  failedCount: number
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE categorization_jobs
    SET processed_count = ?,
        failed_count = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(processedCount, failedCount, id);
}

// Get accounts for categorization based on filters
export function getAccountsForCategorization(filters: {
  uncategorizedOnly?: boolean;
  industry?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  accountIds?: number[];
  limit?: number;
}): Account[] {
  const db = getDb();
  let query = 'SELECT * FROM accounts WHERE 1=1';
  const params: any[] = [];

  // Specific account IDs take precedence
  if (filters.accountIds && filters.accountIds.length > 0) {
    const placeholders = filters.accountIds.map(() => '?').join(',');
    query += ` AND id IN (${placeholders})`;
    params.push(...filters.accountIds);
  } else {
    // Status filter (default to completed)
    query += ' AND research_status = ?';
    params.push(filters.status || 'completed');

    // Uncategorized only
    if (filters.uncategorizedOnly) {
      query += ' AND tier IS NULL';
    }

    // Industry filter
    if (filters.industry) {
      query += ' AND industry = ?';
      params.push(filters.industry);
    }

    // Date range filter
    if (filters.dateFrom) {
      query += ' AND processed_at >= ?';
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ' AND processed_at <= ?';
      params.push(filters.dateTo);
    }
  }

  query += ' ORDER BY processed_at DESC, id';

  // Limit
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const stmt = db.prepare(query);
  return stmt.all(...params) as Account[];
}
