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
    db.pragma('foreign_keys = ON');

    // Initialize schema
    const schema = readFileSync(join(process.cwd(), 'lib', 'schema.sql'), 'utf-8');
    db.exec(schema);

    // Initialize employee count schema
    const employeeCountSchema = readFileSync(join(process.cwd(), 'lib', 'employee-count-schema.sql'), 'utf-8');
    db.exec(employeeCountSchema);

    // Run migrations to add new columns
    migrateDatabase(db);

    // Reset any accounts stuck in 'processing' from a previous server crash
    const resetCount = resetStuckProcessingAccounts(db);
    if (resetCount > 0) {
      console.log(`✓ Reset ${resetCount} stuck 'processing' account(s) to 'pending'`);
    }
  }

  return db;
}

/**
 * Reset accounts stuck in 'processing' status back to 'pending'.
 * This handles the case where the server was killed mid-processing.
 */
export function resetStuckProcessingAccounts(database?: Database.Database): number {
  const d = database || getDb();
  const stmt = d.prepare(`
    UPDATE accounts
    SET research_status = 'pending',
        error_message = NULL,
        updated_at = datetime('now')
    WHERE research_status = 'processing'
  `);
  const result = stmt.run();
  return result.changes;
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
  // Okta Workforce Identity Research Fields
  okta_current_iam_solution: string | null;
  okta_workforce_info: string | null;
  okta_security_incidents: string | null;
  okta_news_and_funding: string | null;
  okta_tech_transformation: string | null;
  okta_ecosystem: string | null;
  okta_prospects: string | null; // JSON string
  okta_research_summary: string | null;
  okta_opportunity_type: 'net_new' | 'competitive_displacement' | 'expansion' | 'unknown' | null;
  okta_priority_score: number | null;
  okta_processed_at: string | null;
  // Okta Categorization Fields
  okta_tier: 'A' | 'B' | 'C' | null;
  okta_estimated_annual_revenue: string | null;
  okta_estimated_user_volume: string | null;
  okta_use_cases: string | null; // JSON array
  okta_skus: string | null; // JSON array
  okta_sdr_notes: string | null;
  okta_last_edited_at: string | null;
  okta_ai_suggestions: string | null; // JSON
  okta_account_owner: string | null;
  // Research model tracking
  research_model: string | null;
  // Triage fields
  triage_auth0_tier: 'A' | 'B' | 'C' | null;
  triage_okta_tier: 'A' | 'B' | 'C' | null;
  triage_summary: string | null;
  triage_data: string | null; // JSON string of TriageResult
  triaged_at: string | null;
}

export interface ProcessingJob {
  id: number;
  filename: string;
  total_accounts: number;
  processed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_account_id: number | null;
  paused: number; // SQLite boolean (0/1)
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

export interface TriageJob {
  id: number;
  filename: string;
  total_accounts: number;
  processed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_account: string | null;
  paused: number; // SQLite boolean (0/1)
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
  auth0AccountOwner?: string,
  oktaAccountOwner?: string
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
    INSERT INTO accounts (company_name, domain, industry, job_id, auth0_account_owner, okta_account_owner)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(companyName, finalDomain, industry, jobId, auth0AccountOwner || null, oktaAccountOwner || null);
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

export function updateAccountResearchModel(id: number, model: string): void {
  const db = getDb();
  db.prepare("UPDATE accounts SET research_model = ?, updated_at = datetime('now') WHERE id = ?").run(model, id);
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

// Auth0-specific research update (extracted for dual-agent support)
export function updateAccountAuth0Research(
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

// Okta-specific research update
export function updateAccountOktaResearch(
  id: number,
  research: {
    current_iam_solution?: string;
    workforce_info?: string;
    security_incidents?: string;
    news_and_funding?: string;
    tech_transformation?: string;
    okta_ecosystem?: string;
    prospects?: string;
    research_summary?: string;
    opportunity_type?: 'net_new' | 'competitive_displacement' | 'expansion' | 'unknown';
    priority_score?: number;
  }
) {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  // Map research fields to okta_ prefixed columns
  const fieldMapping: Record<string, string> = {
    current_iam_solution: 'okta_current_iam_solution',
    workforce_info: 'okta_workforce_info',
    security_incidents: 'okta_security_incidents',
    news_and_funding: 'okta_news_and_funding',
    tech_transformation: 'okta_tech_transformation',
    okta_ecosystem: 'okta_ecosystem',
    prospects: 'okta_prospects',
    research_summary: 'okta_research_summary',
    opportunity_type: 'okta_opportunity_type',
    priority_score: 'okta_priority_score',
  };

  Object.entries(research).forEach(([key, value]) => {
    if (value !== undefined) {
      const dbField = fieldMapping[key];
      if (dbField) {
        fields.push(`${dbField} = ?`);
        values.push(value);
      }
    }
  });

  if (fields.length === 0) return;

  // Update okta_processed_at timestamp
  fields.push('okta_processed_at = datetime(\'now\')');
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

// Okta SDR metadata update function
export function updateOktaAccountMetadata(
  id: number,
  updates: {
    okta_tier?: 'A' | 'B' | 'C' | null;
    okta_estimated_annual_revenue?: string;
    okta_estimated_user_volume?: string;
    okta_use_cases?: string; // JSON string
    okta_skus?: string; // JSON string
    okta_sdr_notes?: string;
    okta_last_edited_at?: string;
    okta_ai_suggestions?: string; // JSON string
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

export function updateJobTotalAccounts(id: number, totalAccounts: number) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE processing_jobs
    SET total_accounts = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(totalAccounts, id);
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

  const oktaTierStats = db.prepare(`
    SELECT
      SUM(CASE WHEN okta_tier = 'A' THEN 1 ELSE 0 END) as oktaTierA,
      SUM(CASE WHEN okta_tier = 'B' THEN 1 ELSE 0 END) as oktaTierB,
      SUM(CASE WHEN okta_tier = 'C' THEN 1 ELSE 0 END) as oktaTierC,
      SUM(CASE WHEN okta_tier IS NULL AND okta_processed_at IS NOT NULL THEN 1 ELSE 0 END) as oktaUncategorized
    FROM accounts
  `).get() as any;

  const oktaSkuStats = db.prepare(`
    SELECT
      SUM(CASE WHEN okta_skus LIKE '%Workforce Identity Cloud%' THEN 1 ELSE 0 END) as oktaSkuWorkforce,
      SUM(CASE WHEN okta_skus LIKE '%Identity Governance%' THEN 1 ELSE 0 END) as oktaSkuGovernance,
      SUM(CASE WHEN okta_skus LIKE '%Privileged Access%' THEN 1 ELSE 0 END) as oktaSkuPrivilegedAccess,
      SUM(CASE WHEN okta_skus LIKE '%Identity Threat Protection%' THEN 1 ELSE 0 END) as oktaSkuThreatProtection,
      SUM(CASE WHEN okta_skus LIKE '%Okta for AI Agents%' THEN 1 ELSE 0 END) as oktaSkuAIAgents
    FROM accounts
    WHERE okta_processed_at IS NOT NULL
  `).get() as any;

  return {
    ...basicStats,
    ...tierStats,
    ...skuStats,
    ...oktaTierStats,
    ...oktaSkuStats,
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
    // Explicitly delete child rows as a safety net alongside CASCADE
    db.prepare('DELETE FROM prospects WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM account_tags WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM section_comments WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM account_notes WHERE account_id = ?').run(id);

    const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting account:', error);
    return false;
  }
}

// Bulk account deletion function
export function deleteAccountsByIds(ids: number[]): number {
  if (ids.length === 0) return 0;

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');

  // Explicitly delete child rows as a safety net alongside CASCADE
  db.prepare(`DELETE FROM prospects WHERE account_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM account_tags WHERE account_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM section_comments WHERE account_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM account_notes WHERE account_id IN (${placeholders})`).run(...ids);

  const stmt = db.prepare(`DELETE FROM accounts WHERE id IN (${placeholders})`);
  const result = stmt.run(...ids);
  return result.changes;
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
  // Okta filters
  oktaTier?: string | 'unassigned';
  oktaSku?: string;
  oktaUseCase?: string;
  oktaMinPriority?: number;
  oktaAccountOwner?: string;
  // Triage filters
  triageAuth0Tier?: string;
  triageOktaTier?: string;
  freshness?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}): { accounts: Account[]; total: number } {
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

  // Auth0 filters
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

  // Okta filters
  if (filters.oktaTier) {
    if (filters.oktaTier === 'unassigned') {
      query += ' AND okta_tier IS NULL';
    } else {
      query += ' AND okta_tier = ?';
      params.push(filters.oktaTier);
    }
  }

  if (filters.oktaSku) {
    query += ' AND okta_skus LIKE ?';
    params.push(`%${filters.oktaSku}%`);
  }

  if (filters.oktaUseCase) {
    query += ' AND okta_use_cases LIKE ?';
    params.push(`%${filters.oktaUseCase}%`);
  }

  if (filters.oktaMinPriority !== undefined) {
    query += ' AND okta_priority_score >= ?';
    params.push(filters.oktaMinPriority);
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

  if (filters.oktaAccountOwner) {
    if (filters.oktaAccountOwner === 'unassigned') {
      query += " AND (okta_account_owner IS NULL OR okta_account_owner = '')";
    } else {
      query += ' AND okta_account_owner LIKE ?';
      params.push(`%${filters.oktaAccountOwner}%`);
    }
  }

  // Triage tier filters
  if (filters.triageAuth0Tier) {
    if (filters.triageAuth0Tier === 'unassigned') {
      query += ' AND triage_auth0_tier IS NULL';
    } else {
      query += ' AND triage_auth0_tier = ?';
      params.push(filters.triageAuth0Tier);
    }
  }

  if (filters.triageOktaTier) {
    if (filters.triageOktaTier === 'unassigned') {
      query += ' AND triage_okta_tier IS NULL';
    } else {
      query += ' AND triage_okta_tier = ?';
      params.push(filters.triageOktaTier);
    }
  }

  if (filters.freshness) {
    if (filters.freshness === 'fresh') {
      query += " AND processed_at >= datetime('now', '-30 days')";
    } else if (filters.freshness === 'aging') {
      query += " AND processed_at < datetime('now', '-30 days') AND processed_at >= datetime('now', '-60 days')";
    } else if (filters.freshness === 'stale') {
      query += " AND processed_at < datetime('now', '-60 days')";
    }
  }

  // Get total count before applying limit/offset
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countStmt = db.prepare(countQuery);
  const countResult = countStmt.get(...params) as { total: number };
  const total = countResult.total;

  // Sorting (default to priority_score)
  const sortBy = filters.sortBy || 'priority_score';
  const validSortFields = ['processed_at', 'priority_score', 'tier', 'company_name', 'created_at', 'okta_priority_score', 'okta_tier'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'priority_score';
  query += ` ORDER BY ${sortField} DESC, created_at DESC`;

  // Pagination (only apply if limit is specified)
  if (filters.limit !== undefined) {
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const stmt = db.prepare(query);
  const accounts = stmt.all(...params) as Account[];

  return { accounts, total };
}

// Get unique filter options for dropdowns
export function getFilterMetadata(): {
  industries: string[];
  tiers: string[];
  accountOwners: string[];
  oktaAccountOwners: string[];
  skus: string[];
  useCases: string[];
  oktaSkus: string[];
  oktaUseCases: string[];
} {
  const db = getDb();

  // Get unique industries
  const industriesStmt = db.prepare('SELECT DISTINCT industry FROM accounts WHERE industry IS NOT NULL ORDER BY industry');
  const industries = (industriesStmt.all() as Array<{ industry: string }>).map(row => row.industry);

  // Get unique tiers
  const tiersStmt = db.prepare('SELECT DISTINCT tier FROM accounts WHERE tier IS NOT NULL ORDER BY tier');
  const tiers = (tiersStmt.all() as Array<{ tier: string }>).map(row => row.tier);

  // Get unique account owners (Auth0)
  const ownersStmt = db.prepare("SELECT DISTINCT auth0_account_owner FROM accounts WHERE auth0_account_owner IS NOT NULL AND auth0_account_owner != '' ORDER BY auth0_account_owner");
  const accountOwners = (ownersStmt.all() as Array<{ auth0_account_owner: string }>).map(row => row.auth0_account_owner);

  // Get unique account owners (Okta)
  const oktaOwnersStmt = db.prepare("SELECT DISTINCT okta_account_owner FROM accounts WHERE okta_account_owner IS NOT NULL AND okta_account_owner != '' ORDER BY okta_account_owner");
  const oktaAccountOwners = (oktaOwnersStmt.all() as Array<{ okta_account_owner: string }>).map(row => row.okta_account_owner);

  // Get all Auth0 SKUs (need to parse JSON arrays)
  const skusStmt = db.prepare('SELECT DISTINCT auth0_skus FROM accounts WHERE auth0_skus IS NOT NULL');
  const skuResults = skusStmt.all() as Array<{ auth0_skus: string }>;
  const skusSet = new Set<string>();
  skuResults.forEach(row => {
    try {
      const skus = JSON.parse(row.auth0_skus);
      if (Array.isArray(skus)) {
        skus.forEach(sku => skusSet.add(sku));
      }
    } catch (e) {
      // Skip invalid JSON
    }
  });
  const skus = Array.from(skusSet).sort();

  // Get all Auth0 use cases (need to parse JSON arrays)
  const useCasesStmt = db.prepare('SELECT DISTINCT use_cases FROM accounts WHERE use_cases IS NOT NULL');
  const useCaseResults = useCasesStmt.all() as Array<{ use_cases: string }>;
  const useCasesSet = new Set<string>();
  useCaseResults.forEach(row => {
    try {
      const cases = JSON.parse(row.use_cases);
      if (Array.isArray(cases)) {
        cases.forEach(uc => useCasesSet.add(uc));
      }
    } catch (e) {
      // Skip invalid JSON
    }
  });
  const useCases = Array.from(useCasesSet).sort();

  // Get all Okta SKUs (need to parse JSON arrays)
  const oktaSkusStmt = db.prepare('SELECT DISTINCT okta_skus FROM accounts WHERE okta_skus IS NOT NULL');
  const oktaSkuResults = oktaSkusStmt.all() as Array<{ okta_skus: string }>;
  const oktaSkusSet = new Set<string>();
  oktaSkuResults.forEach(row => {
    try {
      const skus = JSON.parse(row.okta_skus);
      if (Array.isArray(skus)) {
        skus.forEach(sku => oktaSkusSet.add(sku));
      }
    } catch (e) {
      // Skip invalid JSON
    }
  });
  const oktaSkus = Array.from(oktaSkusSet).sort();

  // Get all Okta use cases (need to parse JSON arrays)
  const oktaUseCasesStmt = db.prepare('SELECT DISTINCT okta_use_cases FROM accounts WHERE okta_use_cases IS NOT NULL');
  const oktaUseCaseResults = oktaUseCasesStmt.all() as Array<{ okta_use_cases: string }>;
  const oktaUseCasesSet = new Set<string>();
  oktaUseCaseResults.forEach(row => {
    try {
      const cases = JSON.parse(row.okta_use_cases);
      if (Array.isArray(cases)) {
        cases.forEach(uc => oktaUseCasesSet.add(uc));
      }
    } catch (e) {
      // Skip invalid JSON
    }
  });
  const oktaUseCases = Array.from(oktaUseCasesSet).sort();

  return {
    industries,
    tiers,
    accountOwners,
    oktaAccountOwners,
    skus,
    useCases,
    oktaSkus,
    oktaUseCases,
  };
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

// Parallel processing support functions

/**
 * Get multiple pending accounts for parallel processing
 */
export function getMultiplePendingAccounts(jobId: number, limit: number): Account[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM accounts
    WHERE job_id = ? AND research_status = 'pending'
    ORDER BY id
    LIMIT ?
  `);
  return stmt.all(jobId, limit) as Account[];
}

/**
 * Update account status with transaction support and retry logic for SQLITE_BUSY
 */
export function updateAccountStatusSafe(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  errorMessage?: string,
  maxRetries: number = 3
): void {
  const db = getDb();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const transaction = db.transaction(() => {
        const stmt = db.prepare(`
          UPDATE accounts
          SET research_status = ?,
              error_message = ?,
              updated_at = datetime('now'),
              processed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE processed_at END
          WHERE id = ?
        `);
        stmt.run(status, errorMessage || null, status, id);
      });

      transaction();
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a SQLITE_BUSY error
      if (lastError.message.includes('SQLITE_BUSY') && attempt < maxRetries - 1) {
        // Wait and retry
        const delay = 100 * Math.pow(2, attempt);
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
        continue;
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to update account status');
}

/**
 * Update account research with transaction support
 */
export function updateAccountResearchSafe(
  id: number,
  research: {
    current_auth_solution?: string;
    customer_base_info?: string;
    security_incidents?: string;
    news_and_funding?: string;
    tech_transformation?: string;
    prospects?: string;
    research_summary?: string;
  },
  maxRetries: number = 3
): void {
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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const transaction = db.transaction(() => {
        const stmt = db.prepare(`
          UPDATE accounts SET ${fields.join(', ')}
          WHERE id = ?
        `);
        stmt.run(...values);
      });

      transaction();
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes('SQLITE_BUSY') && attempt < maxRetries - 1) {
        const delay = 100 * Math.pow(2, attempt);
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
        continue;
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to update account research');
}

/**
 * Update Auth0 research with transaction support
 */
export function updateAccountAuth0ResearchSafe(
  id: number,
  research: {
    current_auth_solution?: string;
    customer_base_info?: string;
    security_incidents?: string;
    news_and_funding?: string;
    tech_transformation?: string;
    prospects?: string;
    research_summary?: string;
  },
  maxRetries: number = 3
): void {
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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const transaction = db.transaction(() => {
        const stmt = db.prepare(`
          UPDATE accounts SET ${fields.join(', ')}
          WHERE id = ?
        `);
        stmt.run(...values);
      });

      transaction();
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes('SQLITE_BUSY') && attempt < maxRetries - 1) {
        const delay = 100 * Math.pow(2, attempt);
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
        continue;
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to update Auth0 research');
}

/**
 * Update Okta research with transaction support
 */
export function updateAccountOktaResearchSafe(
  id: number,
  research: {
    current_iam_solution?: string;
    workforce_info?: string;
    security_incidents?: string;
    news_and_funding?: string;
    tech_transformation?: string;
    okta_ecosystem?: string;
    prospects?: string;
    research_summary?: string;
    opportunity_type?: 'net_new' | 'competitive_displacement' | 'expansion' | 'unknown';
    priority_score?: number;
  },
  maxRetries: number = 3
): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  // Map research fields to okta_ prefixed columns
  const fieldMapping: Record<string, string> = {
    current_iam_solution: 'okta_current_iam_solution',
    workforce_info: 'okta_workforce_info',
    security_incidents: 'okta_security_incidents',
    news_and_funding: 'okta_news_and_funding',
    tech_transformation: 'okta_tech_transformation',
    okta_ecosystem: 'okta_ecosystem',
    prospects: 'okta_prospects',
    research_summary: 'okta_research_summary',
    opportunity_type: 'okta_opportunity_type',
    priority_score: 'okta_priority_score',
  };

  Object.entries(research).forEach(([key, value]) => {
    if (value !== undefined) {
      const dbField = fieldMapping[key];
      if (dbField) {
        fields.push(`${dbField} = ?`);
        values.push(value);
      }
    }
  });

  if (fields.length === 0) return;

  fields.push('okta_processed_at = datetime(\'now\')');
  fields.push('updated_at = datetime(\'now\')');
  values.push(id);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const transaction = db.transaction(() => {
        const stmt = db.prepare(`
          UPDATE accounts SET ${fields.join(', ')}
          WHERE id = ?
        `);
        stmt.run(...values);
      });

      transaction();
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes('SQLITE_BUSY') && attempt < maxRetries - 1) {
        const delay = 100 * Math.pow(2, attempt);
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
        continue;
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to update Okta research');
}

/**
 * Update account metadata with transaction support
 */
export function updateAccountMetadataSafe(
  id: number,
  updates: {
    tier?: 'A' | 'B' | 'C' | null;
    estimated_annual_revenue?: string;
    estimated_user_volume?: string;
    use_cases?: string;
    auth0_skus?: string;
    sdr_notes?: string;
    priority_score?: number;
    last_edited_at?: string;
    ai_suggestions?: string;
  },
  maxRetries: number = 3
): void {
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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const transaction = db.transaction(() => {
        const stmt = db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
      });

      transaction();
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes('SQLITE_BUSY') && attempt < maxRetries - 1) {
        const delay = 100 * Math.pow(2, attempt);
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
        continue;
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to update account metadata');
}

/**
 * Update Okta account metadata with transaction support
 */
export function updateOktaAccountMetadataSafe(
  id: number,
  updates: {
    okta_tier?: 'A' | 'B' | 'C' | null;
    okta_estimated_annual_revenue?: string;
    okta_estimated_user_volume?: string;
    okta_use_cases?: string;
    okta_skus?: string;
    okta_sdr_notes?: string;
    okta_last_edited_at?: string;
    okta_ai_suggestions?: string;
  },
  maxRetries: number = 3
): void {
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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const transaction = db.transaction(() => {
        const stmt = db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
      });

      transaction();
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes('SQLITE_BUSY') && attempt < maxRetries - 1) {
        const delay = 100 * Math.pow(2, attempt);
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait
        }
        continue;
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to update Okta account metadata');
}

// Preprocessing job operations

export interface PreprocessingJob {
  id: number;
  filename: string;
  total_accounts: number;
  processed_count: number;
  removed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_company: string | null;
  output_filename: string | null;
  paused: number; // SQLite boolean (0/1)
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface PreprocessingResult {
  id: number;
  job_id: number;
  original_company_name: string;
  original_domain: string | null;
  original_industry: string;
  validated_company_name: string | null;
  validated_domain: string | null;
  is_duplicate: number; // SQLite boolean (0/1)
  is_active: number; // SQLite boolean (0/1)
  should_include: number; // SQLite boolean (0/1)
  validation_notes: string | null;
  created_at: string;
}

export function createPreprocessingJob(filename: string, totalAccounts: number): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO preprocessing_jobs (filename, total_accounts)
    VALUES (?, ?)
  `);
  const result = stmt.run(filename, totalAccounts);
  return result.lastInsertRowid as number;
}

export function getPreprocessingJob(id: number): PreprocessingJob | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM preprocessing_jobs WHERE id = ?');
  return stmt.get(id) as PreprocessingJob | undefined;
}

export function getAllPreprocessingJobs(limit: number = 10): PreprocessingJob[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM preprocessing_jobs
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as PreprocessingJob[];
}

export function updatePreprocessingJobStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  currentCompany?: string | null,
  outputFilename?: string | null
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE preprocessing_jobs
    SET status = ?,
        current_company = ?,
        output_filename = ?,
        updated_at = datetime('now'),
        completed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
    WHERE id = ?
  `);
  stmt.run(status, currentCompany || null, outputFilename || null, status, id);
}

export function updatePreprocessingJobProgress(
  id: number,
  processedCount: number,
  removedCount: number,
  failedCount: number
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE preprocessing_jobs
    SET processed_count = ?,
        removed_count = ?,
        failed_count = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(processedCount, removedCount, failedCount, id);
}

export function createPreprocessingResult(result: {
  job_id: number;
  original_company_name: string;
  original_domain?: string | null;
  original_industry: string;
  validated_company_name?: string | null;
  validated_domain?: string | null;
  is_duplicate?: boolean;
  is_active?: boolean;
  should_include?: boolean;
  validation_notes?: string | null;
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO preprocessing_results (
      job_id,
      original_company_name,
      original_domain,
      original_industry,
      validated_company_name,
      validated_domain,
      is_duplicate,
      is_active,
      should_include,
      validation_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertResult = stmt.run(
    result.job_id,
    result.original_company_name,
    result.original_domain || null,
    result.original_industry,
    result.validated_company_name || null,
    result.validated_domain || null,
    result.is_duplicate ? 1 : 0,
    result.is_active !== undefined ? (result.is_active ? 1 : 0) : 1,
    result.should_include !== undefined ? (result.should_include ? 1 : 0) : 1,
    result.validation_notes || null
  );
  return insertResult.lastInsertRowid as number;
}

export function getPreprocessingResults(jobId: number): PreprocessingResult[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM preprocessing_results
    WHERE job_id = ?
    ORDER BY id
  `);
  return stmt.all(jobId) as PreprocessingResult[];
}

export function getValidPreprocessingResults(jobId: number): PreprocessingResult[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM preprocessing_results
    WHERE job_id = ? AND should_include = 1
    ORDER BY id
  `);
  return stmt.all(jobId) as PreprocessingResult[];
}

// Pause/Resume/Cancel operations for processing jobs

export function pauseProcessingJob(jobId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE processing_jobs
    SET paused = 1,
        updated_at = datetime('now')
    WHERE id = ? AND status = 'processing'
  `);
  stmt.run(jobId);
}

export function resumeProcessingJob(jobId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE processing_jobs
    SET paused = 0,
        updated_at = datetime('now')
    WHERE id = ? AND status = 'processing'
  `);
  stmt.run(jobId);
}

export function cancelProcessingJob(jobId: number): void {
  const db = getDb();

  // Only cancel jobs that are still pending or processing
  db.prepare(`
    UPDATE processing_jobs
    SET status = 'failed',
        paused = 0,
        updated_at = datetime('now'),
        completed_at = datetime('now')
    WHERE id = ? AND status IN ('pending', 'processing')
  `).run(jobId);

  // Reset any accounts that were processing to pending
  db.prepare(`
    UPDATE accounts
    SET research_status = 'pending',
        updated_at = datetime('now')
    WHERE job_id = ? AND research_status = 'processing'
  `).run(jobId);
}

export function deleteProcessingJob(jobId: number): boolean {
  const db = getDb();

  try {
    // Delete child rows of accounts belonging to this job
    db.prepare('DELETE FROM prospects WHERE account_id IN (SELECT id FROM accounts WHERE job_id = ?)').run(jobId);
    db.prepare('DELETE FROM account_tags WHERE account_id IN (SELECT id FROM accounts WHERE job_id = ?)').run(jobId);
    db.prepare('DELETE FROM section_comments WHERE account_id IN (SELECT id FROM accounts WHERE job_id = ?)').run(jobId);
    db.prepare('DELETE FROM account_notes WHERE account_id IN (SELECT id FROM accounts WHERE job_id = ?)').run(jobId);

    // Delete associated accounts
    db.prepare('DELETE FROM accounts WHERE job_id = ?').run(jobId);

    // Delete job
    const result = db.prepare('DELETE FROM processing_jobs WHERE id = ?').run(jobId);

    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting processing job:', error);
    return false;
  }
}

// Pause/Resume/Cancel operations for preprocessing jobs

export function pausePreprocessingJob(jobId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE preprocessing_jobs
    SET paused = 1,
        updated_at = datetime('now')
    WHERE id = ? AND status = 'processing'
  `);
  stmt.run(jobId);
}

export function resumePreprocessingJob(jobId: number): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE preprocessing_jobs
    SET paused = 0,
        updated_at = datetime('now')
    WHERE id = ? AND status = 'processing'
  `);
  stmt.run(jobId);
}

export function cancelPreprocessingJob(jobId: number): void {
  const db = getDb();

  // Update job status to failed (cancelled)
  db.prepare(`
    UPDATE preprocessing_jobs
    SET status = 'failed',
        paused = 0,
        updated_at = datetime('now'),
        completed_at = datetime('now')
    WHERE id = ?
  `).run(jobId);
}

export function deletePreprocessingJob(jobId: number): boolean {
  const db = getDb();

  try {
    // Delete associated results
    db.prepare('DELETE FROM preprocessing_results WHERE job_id = ?').run(jobId);

    // Delete job
    const result = db.prepare('DELETE FROM preprocessing_jobs WHERE id = ?').run(jobId);

    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting preprocessing job:', error);
    return false;
  }
}

// Staleness detection functions

export interface StaleAccountStats {
  fresh: number;   // <30 days
  aging: number;   // 30-60 days
  stale: number;   // 60-90 days
  veryStale: number; // >90 days
}

export function getStaleAccountStats(_thresholdDays: number = 60): StaleAccountStats {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT
      SUM(CASE WHEN processed_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as fresh,
      SUM(CASE WHEN processed_at < datetime('now', '-30 days') AND processed_at >= datetime('now', '-60 days') THEN 1 ELSE 0 END) as aging,
      SUM(CASE WHEN processed_at < datetime('now', '-60 days') AND processed_at >= datetime('now', '-90 days') THEN 1 ELSE 0 END) as stale,
      SUM(CASE WHEN processed_at < datetime('now', '-90 days') THEN 1 ELSE 0 END) as veryStale
    FROM accounts
    WHERE research_status = 'completed' AND processed_at IS NOT NULL
  `);
  const result = stmt.get() as any;
  return {
    fresh: result.fresh || 0,
    aging: result.aging || 0,
    stale: result.stale || 0,
    veryStale: result.veryStale || 0,
  };
}

export function getStaleAccounts(thresholdDays: number, limit?: number): Account[] {
  const db = getDb();
  let query = `
    SELECT * FROM accounts
    WHERE research_status = 'completed'
      AND processed_at IS NOT NULL
      AND processed_at < datetime('now', '-${thresholdDays} days')
    ORDER BY processed_at ASC
  `;
  if (limit) {
    query += ` LIMIT ${limit}`;
  }
  const stmt = db.prepare(query);
  return stmt.all() as Account[];
}

export function refreshAccountResearch(
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

  // Only update AI-generated research fields, preserving SDR-edited fields
  Object.entries(research).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  fields.push("processed_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`
    UPDATE accounts SET ${fields.join(', ')}
    WHERE id = ?
  `);
  stmt.run(...values);
}

// Employee Count Job operations

export interface EmployeeCountJob {
  id: number;
  filename: string;
  total_accounts: number;
  processed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_company: string | null;
  output_filename: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface EmployeeCountResult {
  id: number;
  job_id: number;
  account_name: string;
  linkedin_employee_count: string | null;
  dnb_employee_count: string | null;
  error_message: string | null;
  created_at: string;
}

export function createEmployeeCountJob(filename: string, totalAccounts: number): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO employee_count_jobs (filename, total_accounts)
    VALUES (?, ?)
  `);
  const result = stmt.run(filename, totalAccounts);
  return result.lastInsertRowid as number;
}

export function getEmployeeCountJob(id: number): EmployeeCountJob | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM employee_count_jobs WHERE id = ?');
  return stmt.get(id) as EmployeeCountJob | undefined;
}

export function getAllEmployeeCountJobs(limit: number = 10): EmployeeCountJob[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM employee_count_jobs
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as EmployeeCountJob[];
}

export function updateEmployeeCountJobStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  currentCompany?: string | null,
  outputFilename?: string | null
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE employee_count_jobs
    SET status = ?,
        current_company = ?,
        output_filename = ?,
        updated_at = datetime('now'),
        completed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
    WHERE id = ?
  `);
  stmt.run(status, currentCompany || null, outputFilename || null, status, id);
}

export function updateEmployeeCountJobProgress(
  id: number,
  processedCount: number,
  failedCount: number
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE employee_count_jobs
    SET processed_count = ?,
        failed_count = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(processedCount, failedCount, id);
}

export function createEmployeeCountResult(result: {
  job_id: number;
  account_name: string;
  linkedin_employee_count?: string | null;
  dnb_employee_count?: string | null;
  error_message?: string | null;
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO employee_count_results (
      job_id,
      account_name,
      linkedin_employee_count,
      dnb_employee_count,
      error_message
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertResult = stmt.run(
    result.job_id,
    result.account_name,
    result.linkedin_employee_count || null,
    result.dnb_employee_count || null,
    result.error_message || null
  );
  return insertResult.lastInsertRowid as number;
}

export function getEmployeeCountResults(jobId: number): EmployeeCountResult[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM employee_count_results
    WHERE job_id = ?
    ORDER BY id
  `);
  return stmt.all(jobId) as EmployeeCountResult[];
}

// Reprocessing query functions

export interface ReprocessingStats {
  completedTotal: number;
  missingOkta: number;
  missingAuth0: number;
  hasBoth: number;
}

export function getReprocessingStats(): ReprocessingStats {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as completedTotal,
      SUM(CASE
        WHEN processed_at IS NOT NULL AND current_auth_solution IS NOT NULL
             AND okta_processed_at IS NULL
        THEN 1 ELSE 0
      END) as missingOkta,
      SUM(CASE
        WHEN okta_processed_at IS NOT NULL
             AND (current_auth_solution IS NULL OR processed_at IS NULL)
        THEN 1 ELSE 0
      END) as missingAuth0,
      SUM(CASE
        WHEN processed_at IS NOT NULL AND current_auth_solution IS NOT NULL
             AND okta_processed_at IS NOT NULL
        THEN 1 ELSE 0
      END) as hasBoth
    FROM accounts
    WHERE research_status = 'completed'
  `);
  const result = stmt.get() as any;
  return {
    completedTotal: result.completedTotal || 0,
    missingOkta: result.missingOkta || 0,
    missingAuth0: result.missingAuth0 || 0,
    hasBoth: result.hasBoth || 0,
  };
}

export function getAccountsForReprocessing(filters: {
  scope: 'missing_okta' | 'missing_auth0' | 'all_completed';
  industry?: string;
  limit?: number;
}): { accounts: Account[]; total: number } {
  const db = getDb();
  let query = "SELECT * FROM accounts WHERE research_status = 'completed'";
  const params: any[] = [];

  if (filters.scope === 'missing_okta') {
    query += ' AND processed_at IS NOT NULL AND current_auth_solution IS NOT NULL AND okta_processed_at IS NULL';
  } else if (filters.scope === 'missing_auth0') {
    query += ' AND okta_processed_at IS NOT NULL AND (current_auth_solution IS NULL OR processed_at IS NULL)';
  }
  // 'all_completed' uses the base WHERE clause

  if (filters.industry) {
    query += ' AND industry = ?';
    params.push(filters.industry);
  }

  // Get total count before applying limit
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countStmt = db.prepare(countQuery);
  const countResult = countStmt.get(...params) as { total: number };
  const total = countResult.total;

  query += ' ORDER BY processed_at DESC, id';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const stmt = db.prepare(query);
  const accounts = stmt.all(...params) as Account[];

  return { accounts, total };
}

// Triage job operations

export function createTriageJob(filename: string, totalAccounts: number): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO triage_jobs (filename, total_accounts)
    VALUES (?, ?)
  `);
  const result = stmt.run(filename, totalAccounts);
  return result.lastInsertRowid as number;
}

export function getTriageJob(id: number): TriageJob | undefined {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM triage_jobs WHERE id = ?');
  return stmt.get(id) as TriageJob | undefined;
}

export function getAllTriageJobs(limit: number = 10): TriageJob[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM triage_jobs
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as TriageJob[];
}

export function updateTriageJobStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  currentAccount?: string | null
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE triage_jobs
    SET status = ?,
        current_account = ?,
        updated_at = datetime('now'),
        completed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
    WHERE id = ?
  `);
  stmt.run(status, currentAccount || null, status, id);
}

export function updateTriageJobProgress(
  id: number,
  processedCount: number,
  failedCount: number
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE triage_jobs
    SET processed_count = ?,
        failed_count = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(processedCount, failedCount, id);
}

export function updateAccountTriage(
  id: number,
  triage: {
    triage_auth0_tier: 'A' | 'B' | 'C';
    triage_okta_tier: 'A' | 'B' | 'C';
    triage_summary: string;
    triage_data: string; // JSON string
  }
) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE accounts
    SET triage_auth0_tier = ?,
        triage_okta_tier = ?,
        triage_summary = ?,
        triage_data = ?,
        triaged_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(
    triage.triage_auth0_tier,
    triage.triage_okta_tier,
    triage.triage_summary,
    triage.triage_data,
    id
  );
}

export function getTriageJobStats(jobId: number): {
  auth0: { tierA: number; tierB: number; tierC: number };
  okta: { tierA: number; tierB: number; tierC: number };
  total: number;
} {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT
      SUM(CASE WHEN triage_auth0_tier = 'A' THEN 1 ELSE 0 END) as auth0TierA,
      SUM(CASE WHEN triage_auth0_tier = 'B' THEN 1 ELSE 0 END) as auth0TierB,
      SUM(CASE WHEN triage_auth0_tier = 'C' THEN 1 ELSE 0 END) as auth0TierC,
      SUM(CASE WHEN triage_okta_tier = 'A' THEN 1 ELSE 0 END) as oktaTierA,
      SUM(CASE WHEN triage_okta_tier = 'B' THEN 1 ELSE 0 END) as oktaTierB,
      SUM(CASE WHEN triage_okta_tier = 'C' THEN 1 ELSE 0 END) as oktaTierC,
      COUNT(*) as total
    FROM accounts
    WHERE job_id = ? AND triaged_at IS NOT NULL
  `);
  const result = stmt.get(jobId) as any;
  return {
    auth0: {
      tierA: result.auth0TierA || 0,
      tierB: result.auth0TierB || 0,
      tierC: result.auth0TierC || 0,
    },
    okta: {
      tierA: result.oktaTierA || 0,
      tierB: result.oktaTierB || 0,
      tierC: result.oktaTierC || 0,
    },
    total: result.total || 0,
  };
}

export function getAccountsByJobAndTriageTier(
  jobId: number,
  tierType: 'auth0' | 'okta',
  tier: 'A' | 'B' | 'C'
): Account[] {
  const db = getDb();
  const column = tierType === 'auth0' ? 'triage_auth0_tier' : 'triage_okta_tier';
  const stmt = db.prepare(`
    SELECT * FROM accounts
    WHERE job_id = ? AND ${column} = ?
    ORDER BY id
  `);
  return stmt.all(jobId, tier) as Account[];
}

// Triage job cancel/delete operations

export function cancelTriageJob(jobId: number): void {
  const db = getDb();

  // Only cancel jobs that are still pending or processing
  db.prepare(`
    UPDATE triage_jobs
    SET status = 'failed',
        paused = 0,
        updated_at = datetime('now'),
        completed_at = datetime('now')
    WHERE id = ? AND status IN ('pending', 'processing')
  `).run(jobId);
}

export function deleteTriageJob(jobId: number): boolean {
  const db = getDb();

  try {
    // Reset triage data on associated accounts (triage jobs use processing_jobs.id as job_id)
    // We can't know the processing job ID from the triage job alone, so we clear based
    // on the triage job's filename matching. Instead, just delete the triage job record.
    const result = db.prepare('DELETE FROM triage_jobs WHERE id = ?').run(jobId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting triage job:', error);
    return false;
  }
}

// Categorization job cancel/delete operations

export function cancelCategorizationJob(jobId: number): void {
  const db = getDb();

  // Only cancel jobs that are still pending or processing
  db.prepare(`
    UPDATE categorization_jobs
    SET status = 'failed',
        current_account_id = NULL,
        updated_at = datetime('now'),
        completed_at = datetime('now')
    WHERE id = ? AND status IN ('pending', 'processing')
  `).run(jobId);
}

export function deleteCategorizationJob(jobId: number): boolean {
  const db = getDb();

  try {
    const result = db.prepare('DELETE FROM categorization_jobs WHERE id = ?').run(jobId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting categorization job:', error);
    return false;
  }
}

// ─── Preset Tags ────────────────────────────────────────────────────────────

export const PRESET_TAGS = [
  'Current Auth0 Customer',
  'Current Okta Customer',
  'Common Customer (Auth0 + Okta)',
  'Former Auth0 Customer',
  'Former Okta Customer',
  'Competitor Customer',
  'Partner',
  'Strategic Account',
  'Do Not Contact',
] as const;

// ─── Account Tags ───────────────────────────────────────────────────────────

export interface AccountTag {
  id: number;
  account_id: number;
  tag: string;
  tag_type: string;
  created_at: string;
}

export function getAccountTags(accountId: number): AccountTag[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM account_tags WHERE account_id = ? ORDER BY created_at');
  return stmt.all(accountId) as AccountTag[];
}

export function addAccountTag(accountId: number, tag: string, tagType: 'preset' | 'custom'): AccountTag {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO account_tags (account_id, tag, tag_type)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(accountId, tag, tagType);
  return {
    id: result.lastInsertRowid as number,
    account_id: accountId,
    tag,
    tag_type: tagType,
    created_at: new Date().toISOString(),
  };
}

export function removeAccountTag(accountId: number, tag: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM account_tags WHERE account_id = ? AND tag = ?');
  const result = stmt.run(accountId, tag);
  return result.changes > 0;
}

export function getAllUniqueTags(): string[] {
  const db = getDb();
  const stmt = db.prepare('SELECT DISTINCT tag FROM account_tags ORDER BY tag');
  return (stmt.all() as Array<{ tag: string }>).map(r => r.tag);
}

// ─── Section Comments ───────────────────────────────────────────────────────

export interface SectionComment {
  id: number;
  account_id: number;
  perspective: string;
  section_key: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function getSectionComments(accountId: number): SectionComment[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM section_comments WHERE account_id = ? ORDER BY created_at');
  return stmt.all(accountId) as SectionComment[];
}

export function upsertSectionComment(accountId: number, perspective: string, sectionKey: string, content: string): SectionComment {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO section_comments (account_id, perspective, section_key, content)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, perspective, section_key)
    DO UPDATE SET content = excluded.content, updated_at = datetime('now')
  `);
  stmt.run(accountId, perspective, sectionKey, content);
  const result = db.prepare(
    'SELECT * FROM section_comments WHERE account_id = ? AND perspective = ? AND section_key = ?'
  ).get(accountId, perspective, sectionKey) as SectionComment;
  return result;
}

export function deleteSectionComment(accountId: number, perspective: string, sectionKey: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM section_comments WHERE account_id = ? AND perspective = ? AND section_key = ?');
  const result = stmt.run(accountId, perspective, sectionKey);
  return result.changes > 0;
}

// ─── Account Notes ──────────────────────────────────────────────────────────

export interface AccountNote {
  id: number;
  account_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export function getAccountNotes(accountId: number): AccountNote[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM account_notes WHERE account_id = ? ORDER BY created_at DESC');
  return stmt.all(accountId) as AccountNote[];
}

export function createAccountNote(accountId: number, content: string): AccountNote {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO account_notes (account_id, content)
    VALUES (?, ?)
  `);
  const result = stmt.run(accountId, content);
  return db.prepare('SELECT * FROM account_notes WHERE id = ?').get(result.lastInsertRowid) as AccountNote;
}

export function updateAccountNote(noteId: number, content: string): AccountNote | undefined {
  const db = getDb();
  db.prepare("UPDATE account_notes SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, noteId);
  return db.prepare('SELECT * FROM account_notes WHERE id = ?').get(noteId) as AccountNote | undefined;
}

export function deleteAccountNote(noteId: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM account_notes WHERE id = ?').run(noteId);
  return result.changes > 0;
}

// ─── Prospects ──────────────────────────────────────────────────────────────

export interface Prospect {
  id: number;
  account_id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  linkedin_url: string | null;
  department: string | null;
  notes: string | null;
  role_type: 'decision_maker' | 'champion' | 'influencer' | 'blocker' | 'end_user' | 'unknown' | null;
  relationship_status: 'new' | 'engaged' | 'warm' | 'cold';
  source: 'manual' | 'salesforce_import' | 'ai_research';
  mailing_address: string | null;
  lead_source: string | null;
  last_activity_date: string | null;
  do_not_call: number;
  description: string | null;
  parent_prospect_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProspectImportJob {
  id: number;
  filename: string;
  total_contacts: number;
  matched_count: number;
  unmatched_count: number;
  created_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function createProspect(data: {
  account_id: number;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  linkedin_url?: string;
  department?: string;
  notes?: string;
  role_type?: string;
  relationship_status?: string;
  source?: string;
  mailing_address?: string;
  lead_source?: string;
  last_activity_date?: string;
  do_not_call?: number;
  description?: string;
  parent_prospect_id?: number;
  sort_order?: number;
}): Prospect {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO prospects (
      account_id, first_name, last_name, title, email, phone, mobile, linkedin_url,
      department, notes, role_type, relationship_status, source,
      mailing_address, lead_source, last_activity_date, do_not_call,
      description, parent_prospect_id, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.account_id,
    data.first_name,
    data.last_name,
    data.title || null,
    data.email || null,
    data.phone || null,
    data.mobile || null,
    data.linkedin_url || null,
    data.department || null,
    data.notes || null,
    data.role_type || null,
    data.relationship_status || 'new',
    data.source || 'manual',
    data.mailing_address || null,
    data.lead_source || null,
    data.last_activity_date || null,
    data.do_not_call || 0,
    data.description || null,
    data.parent_prospect_id || null,
    data.sort_order || 0
  );
  return db.prepare('SELECT * FROM prospects WHERE id = ?').get(result.lastInsertRowid) as Prospect;
}

export function getProspect(id: number): Prospect | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Prospect | undefined;
}

export function updateProspect(id: number, data: Partial<Omit<Prospect, 'id' | 'created_at' | 'updated_at'>>): Prospect | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return getProspect(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE prospects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM prospects WHERE id = ?').get(id) as Prospect | undefined;
}

export function deleteProspect(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM prospects WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getProspectsByAccount(accountId: number): Prospect[] {
  const db = getDb();
  return db.prepare('SELECT * FROM prospects WHERE account_id = ? ORDER BY sort_order, id').all(accountId) as Prospect[];
}

export function getProspectCountByAccount(accountId: number): number {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM prospects WHERE account_id = ?').get(accountId) as { count: number };
  return result.count;
}

export function reorderProspects(accountId: number, orderedIds: number[], parentChanges?: { id: number; newParentId: number | null }[]): void {
  const db = getDb();
  const transaction = db.transaction(() => {
    orderedIds.forEach((prospectId, index) => {
      db.prepare("UPDATE prospects SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?")
        .run(index, prospectId, accountId);
    });
    if (parentChanges) {
      for (const change of parentChanges) {
        db.prepare("UPDATE prospects SET parent_prospect_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?")
          .run(change.newParentId, change.id, accountId);
      }
    }
  });
  transaction();
}

export function getProspectsWithFilters(filters: {
  search?: string;
  tier?: string;
  oktaTier?: string;
  roleType?: string;
  industry?: string;
  source?: string;
  relationshipStatus?: string;
  limit?: number;
  offset?: number;
}): { prospects: (Prospect & { company_name: string; domain: string; account_tier: string | null; account_okta_tier: string | null; account_industry: string })[]; total: number } {
  const db = getDb();
  let query = `
    SELECT p.*, a.company_name, a.domain, a.tier as account_tier, a.okta_tier as account_okta_tier, a.industry as account_industry
    FROM prospects p
    JOIN accounts a ON p.account_id = a.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.search) {
    query += " AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ? OR p.title LIKE ? OR a.company_name LIKE ?)";
    const s = `%${filters.search}%`;
    params.push(s, s, s, s, s);
  }

  if (filters.tier) {
    query += ' AND a.tier = ?';
    params.push(filters.tier);
  }

  if (filters.oktaTier) {
    query += ' AND a.okta_tier = ?';
    params.push(filters.oktaTier);
  }

  if (filters.roleType) {
    query += ' AND p.role_type = ?';
    params.push(filters.roleType);
  }

  if (filters.industry) {
    query += ' AND a.industry = ?';
    params.push(filters.industry);
  }

  if (filters.source) {
    query += ' AND p.source = ?';
    params.push(filters.source);
  }

  if (filters.relationshipStatus) {
    query += ' AND p.relationship_status = ?';
    params.push(filters.relationshipStatus);
  }

  const countQuery = query.replace(/SELECT p\.\*, a\.company_name.*?FROM/, 'SELECT COUNT(*) as total FROM');
  const countResult = db.prepare(countQuery).get(...params) as { total: number };

  query += ' ORDER BY a.company_name, p.sort_order, p.id';

  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const prospects = db.prepare(query).all(...params) as any[];
  return { prospects, total: countResult.total };
}

export function bulkCreateProspects(prospects: Array<{
  account_id: number;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  linkedin_url?: string;
  department?: string;
  notes?: string;
  role_type?: string;
  relationship_status?: string;
  source?: string;
  mailing_address?: string;
  lead_source?: string;
  last_activity_date?: string;
  do_not_call?: number;
  description?: string;
}>): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO prospects (
      account_id, first_name, last_name, title, email, phone, mobile, linkedin_url,
      department, notes, role_type, relationship_status, source,
      mailing_address, lead_source, last_activity_date, do_not_call, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    let count = 0;
    for (const p of prospects) {
      stmt.run(
        p.account_id,
        p.first_name,
        p.last_name,
        p.title || null,
        p.email || null,
        p.phone || null,
        p.mobile || null,
        p.linkedin_url || null,
        p.department || null,
        p.notes || null,
        p.role_type || null,
        p.relationship_status || 'new',
        p.source || 'salesforce_import',
        p.mailing_address || null,
        p.lead_source || null,
        p.last_activity_date || null,
        p.do_not_call || 0,
        p.description || null
      );
      count++;
    }
    return count;
  });

  return transaction();
}

export function findAccountByDomainOrName(domain: string | null, companyName: string): Account | undefined {
  const db = getDb();
  if (domain) {
    const byDomain = db.prepare("SELECT * FROM accounts WHERE domain = ? AND domain NOT LIKE '%.placeholder'").get(domain) as Account | undefined;
    if (byDomain) return byDomain;
  }
  return db.prepare('SELECT * FROM accounts WHERE LOWER(company_name) = LOWER(?)').get(companyName) as Account | undefined;
}

// Prospect import job CRUD

export function createProspectImportJob(filename: string, totalContacts: number): number {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO prospect_import_jobs (filename, total_contacts) VALUES (?, ?)');
  return stmt.run(filename, totalContacts).lastInsertRowid as number;
}

export function getProspectImportJob(id: number): ProspectImportJob | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM prospect_import_jobs WHERE id = ?').get(id) as ProspectImportJob | undefined;
}

export function updateProspectImportJob(id: number, updates: Partial<Omit<ProspectImportJob, 'id' | 'created_at'>>): void {
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
  values.push(id);
  db.prepare(`UPDATE prospect_import_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteEmployeeCountJob(jobId: number): boolean {
  const db = getDb();

  try {
    // Delete associated results
    db.prepare('DELETE FROM employee_count_results WHERE job_id = ?').run(jobId);

    // Delete job
    const result = db.prepare('DELETE FROM employee_count_jobs WHERE id = ?').run(jobId);

    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting employee count job:', error);
    return false;
  }
}

// ─── Opportunity Import Types & Functions ────────────────────────────────────

export interface OpportunityImportJob {
  id: number;
  filename: string;
  total_rows: number;
  unique_opportunities: number;
  unique_contacts: number;
  matched_accounts: number;
  unmatched_accounts: number;
  prospects_created: number;
  opportunities_created: number;
  champions_tagged: number;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SalesforceOpportunity {
  id: number;
  account_id: number;
  import_job_id: number;
  opportunity_name: string;
  stage: string | null;
  last_stage_change_date: string | null;
  business_use_case: string | null;
  win_loss_description: string | null;
  why_do_anything: string | null;
  why_do_it_now: string | null;
  why_solve_problem: string | null;
  why_okta: string | null;
  steps_to_close: string | null;
  economic_buyer: string | null;
  metrics: string | null;
  decision_process: string | null;
  paper_process: string | null;
  identify_pain: string | null;
  decision_criteria: string | null;
  champions: string | null;
  champion_title: string | null;
  compelling_event: string | null;
  competition: string | null;
  created_at: string;
}

export interface OpportunityProspectLink {
  id: number;
  opportunity_id: number;
  prospect_id: number;
  created_at: string;
}

// Fuzzy account matching
const COMPANY_SUFFIXES = /\s*(,?\s*(Inc\.?|Corp\.?|Corporation|Ltd\.?|Pty\.?\s*Ltd\.?|LLC|L\.L\.C\.?|Co\.?|Limited|Group|Holdings|PLC|GmbH|AG|S\.A\.?|N\.V\.?|B\.V\.?))+\s*$/i;

function normalizeCompanyName(name: string): string {
  return name.replace(COMPANY_SUFFIXES, '').trim();
}

export function findAccountFuzzy(name: string): { exact?: Account; fuzzy: Account[] } {
  const db = getDb();

  // 1. Exact match (case-insensitive)
  const exact = db.prepare('SELECT * FROM accounts WHERE LOWER(company_name) = LOWER(?)').get(name) as Account | undefined;
  if (exact) {
    return { exact, fuzzy: [] };
  }

  // 2. Suffix-stripped match
  const normalized = normalizeCompanyName(name);
  const suffixMatches = db.prepare(`
    SELECT * FROM accounts
    WHERE LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(company_name,
      ' Inc.', ''), ' Inc', ''), ' Corp.', ''), ' Corp', ''), ' Corporation', ''), ' Ltd.', ''),
      ' Ltd', ''), ' LLC', ''), ' Co.', ''), ' Co', ''), ' Limited', ''), ' Group', ''))
    LIKE LOWER(?)
  `).all(normalized) as Account[];

  if (suffixMatches.length === 1) {
    return { exact: suffixMatches[0], fuzzy: [] };
  }
  if (suffixMatches.length > 1) {
    return { fuzzy: suffixMatches };
  }

  // 3. LIKE match
  const likeMatches = db.prepare(
    "SELECT * FROM accounts WHERE LOWER(company_name) LIKE '%' || LOWER(?) || '%'"
  ).all(normalized) as Account[];

  if (likeMatches.length === 1) {
    return { exact: likeMatches[0], fuzzy: [] };
  }

  return { fuzzy: likeMatches };
}

// Opportunity import job CRUD
export function createOpportunityImportJob(filename: string): number {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO opportunity_import_jobs (filename) VALUES (?)');
  return stmt.run(filename).lastInsertRowid as number;
}

export function getOpportunityImportJob(id: number): OpportunityImportJob | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM opportunity_import_jobs WHERE id = ?').get(id) as OpportunityImportJob | undefined;
}

export function updateOpportunityImportJob(id: number, updates: Partial<Omit<OpportunityImportJob, 'id' | 'created_at'>>): void {
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
  values.push(id);
  db.prepare(`UPDATE opportunity_import_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// Salesforce opportunity CRUD
export function createSalesforceOpportunity(data: {
  account_id: number;
  import_job_id: number;
  opportunity_name: string;
  stage?: string;
  last_stage_change_date?: string;
  business_use_case?: string;
  win_loss_description?: string;
  why_do_anything?: string;
  why_do_it_now?: string;
  why_solve_problem?: string;
  why_okta?: string;
  steps_to_close?: string;
  economic_buyer?: string;
  metrics?: string;
  decision_process?: string;
  paper_process?: string;
  identify_pain?: string;
  decision_criteria?: string;
  champions?: string;
  champion_title?: string;
  compelling_event?: string;
  competition?: string;
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO salesforce_opportunities (
      account_id, import_job_id, opportunity_name, stage, last_stage_change_date,
      business_use_case, win_loss_description, why_do_anything, why_do_it_now,
      why_solve_problem, why_okta, steps_to_close,
      economic_buyer, metrics, decision_process, paper_process,
      identify_pain, decision_criteria, champions, champion_title,
      compelling_event, competition
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    data.account_id, data.import_job_id, data.opportunity_name,
    data.stage || null, data.last_stage_change_date || null,
    data.business_use_case || null, data.win_loss_description || null,
    data.why_do_anything || null, data.why_do_it_now || null,
    data.why_solve_problem || null, data.why_okta || null,
    data.steps_to_close || null,
    data.economic_buyer || null, data.metrics || null,
    data.decision_process || null, data.paper_process || null,
    data.identify_pain || null, data.decision_criteria || null,
    data.champions || null, data.champion_title || null,
    data.compelling_event || null, data.competition || null
  ).lastInsertRowid as number;
}

export function findExistingOpportunity(accountId: number, opportunityName: string): SalesforceOpportunity | undefined {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM salesforce_opportunities WHERE account_id = ? AND opportunity_name = ?'
  ).get(accountId, opportunityName) as SalesforceOpportunity | undefined;
}

export function getOpportunitiesByAccount(accountId: number): SalesforceOpportunity[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM salesforce_opportunities WHERE account_id = ? ORDER BY last_stage_change_date DESC, created_at DESC'
  ).all(accountId) as SalesforceOpportunity[];
}

export function getOpportunityProspects(opportunityId: number): Prospect[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.* FROM prospects p
    JOIN opportunity_prospects op ON op.prospect_id = p.id
    WHERE op.opportunity_id = ?
    ORDER BY p.sort_order, p.last_name
  `).all(opportunityId) as Prospect[];
}

export function linkOpportunityProspect(opportunityId: number, prospectId: number): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO opportunity_prospects (opportunity_id, prospect_id) VALUES (?, ?)
  `).run(opportunityId, prospectId);
}

export function getOpportunitiesWithProspects(accountId: number): Array<SalesforceOpportunity & { linkedProspects: Prospect[] }> {
  const opportunities = getOpportunitiesByAccount(accountId);
  return opportunities.map(opp => ({
    ...opp,
    linkedProspects: getOpportunityProspects(opp.id),
  }));
}

// ─── Feature 1: Global opportunities listing ────────────────────────────────

export interface OpportunityWithAccount extends SalesforceOpportunity {
  company_name: string;
  domain: string | null;
  industry: string;
  tier: string | null;
  okta_tier: string | null;
  prospect_count: number;
}

export function getOpportunitiesWithFilters(filters: {
  search?: string;
  stage?: string;
  tier?: string;
  industry?: string;
  limit?: number;
  offset?: number;
}): { opportunities: OpportunityWithAccount[]; total: number } {
  const db = getDb();
  const { search, stage, tier, industry, limit = 50, offset = 0 } = filters;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push(`(so.opportunity_name LIKE ? OR a.company_name LIKE ? OR so.business_use_case LIKE ?)`);
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (stage) {
    whereClauses.push(`so.stage = ?`);
    params.push(stage);
  }
  if (tier) {
    whereClauses.push(`a.tier = ?`);
    params.push(tier);
  }
  if (industry) {
    whereClauses.push(`a.industry = ?`);
    params.push(industry);
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM salesforce_opportunities so
    JOIN accounts a ON a.id = so.account_id
    ${where}
  `).get(...params) as { total: number };

  const rows = db.prepare(`
    SELECT
      so.*,
      a.company_name,
      a.domain,
      a.industry,
      a.tier,
      a.okta_tier,
      (SELECT COUNT(*) FROM opportunity_prospects op WHERE op.opportunity_id = so.id) as prospect_count
    FROM salesforce_opportunities so
    JOIN accounts a ON a.id = so.account_id
    ${where}
    ORDER BY so.last_stage_change_date DESC, so.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as OpportunityWithAccount[];

  return { opportunities: rows, total: countRow.total };
}

// ─── Feature 2: Prospect deduplication ──────────────────────────────────────

export function findExistingProspectByEmailOrName(
  accountId: number,
  email: string | undefined,
  firstName: string,
  lastName: string
): Prospect | undefined {
  const db = getDb();
  // Check by email first (case-insensitive)
  if (email) {
    const byEmail = db.prepare(
      'SELECT * FROM prospects WHERE account_id = ? AND email IS NOT NULL AND lower(email) = lower(?)'
    ).get(accountId, email) as Prospect | undefined;
    if (byEmail) return byEmail;
  }
  // Fallback: check by first + last name
  return db.prepare(
    'SELECT * FROM prospects WHERE account_id = ? AND lower(first_name) = lower(?) AND lower(last_name) = lower(?)'
  ).get(accountId, firstName, lastName) as Prospect | undefined;
}

// ─── Feature 4: Duplicate account detection and cleanup ─────────────────────

export interface DuplicatePairRow {
  id1: number;
  company_name_1: string;
  domain_1: string | null;
  industry_1: string;
  tier_1: string | null;
  prospect_count_1: number;
  opportunity_count_1: number;
  id2: number;
  company_name_2: string;
  domain_2: string | null;
  industry_2: string;
  tier_2: string | null;
  prospect_count_2: number;
  opportunity_count_2: number;
}

export function findPotentialDuplicateAccounts(): DuplicatePairRow[] {
  const db = getDb();
  return db.prepare(`
    WITH cleaned AS (
      SELECT
        id,
        company_name,
        domain,
        industry,
        tier,
        lower(
          trim(
            replace(replace(replace(replace(replace(replace(
              company_name,
              ' Inc.', ''), ' Inc', ''), ' Corp.', ''), ' Corp', ''),
              ' LLC', ''), ' Ltd', '')
          )
        ) AS cleaned_name
      FROM accounts
    )
    SELECT
      a1.id AS id1,
      a1.company_name AS company_name_1,
      a1.domain AS domain_1,
      a1.industry AS industry_1,
      a1.tier AS tier_1,
      (SELECT COUNT(*) FROM prospects WHERE account_id = a1.id) AS prospect_count_1,
      (SELECT COUNT(*) FROM salesforce_opportunities WHERE account_id = a1.id) AS opportunity_count_1,
      a2.id AS id2,
      a2.company_name AS company_name_2,
      a2.domain AS domain_2,
      a2.industry AS industry_2,
      a2.tier AS tier_2,
      (SELECT COUNT(*) FROM prospects WHERE account_id = a2.id) AS prospect_count_2,
      (SELECT COUNT(*) FROM salesforce_opportunities WHERE account_id = a2.id) AS opportunity_count_2
    FROM cleaned a1
    JOIN cleaned a2 ON a1.cleaned_name = a2.cleaned_name AND a1.id < a2.id
    WHERE NOT EXISTS (
      SELECT 1 FROM account_relationships ar
      WHERE (ar.account_id_1 = a1.id AND ar.account_id_2 = a2.id)
         OR (ar.account_id_1 = a2.id AND ar.account_id_2 = a1.id)
    )
    ORDER BY a1.company_name
    LIMIT 200
  `).all() as DuplicatePairRow[];
}

export function mergeAccounts(keepId: number, deleteId: number): { prospectsTransferred: number; opportunitiesTransferred: number } {
  const db = getDb();
  return db.transaction(() => {
    const prospectsResult = db.prepare(
      'UPDATE prospects SET account_id = ? WHERE account_id = ?'
    ).run(keepId, deleteId);

    const opportunitiesResult = db.prepare(
      'UPDATE salesforce_opportunities SET account_id = ? WHERE account_id = ?'
    ).run(keepId, deleteId);

    // Transfer tags (ignore conflicts)
    db.prepare(
      'INSERT OR IGNORE INTO account_tags (account_id, tag, tag_type) SELECT ?, tag, tag_type FROM account_tags WHERE account_id = ?'
    ).run(keepId, deleteId);

    // Transfer notes
    db.prepare(
      'UPDATE account_notes SET account_id = ? WHERE account_id = ?'
    ).run(keepId, deleteId);

    // Delete the merged account (CASCADE will clean up remaining foreign-key refs)
    db.prepare('DELETE FROM accounts WHERE id = ?').run(deleteId);

    return {
      prospectsTransferred: prospectsResult.changes,
      opportunitiesTransferred: opportunitiesResult.changes,
    };
  })();
}

export function createAccountRelationship(
  id1: number,
  id2: number,
  type: 'duplicate' | 'parent' | 'subsidiary' | 'formerly_known_as' | 'not_duplicate'
): void {
  const db = getDb();
  // Always store min id first to match UNIQUE constraint
  const [a, b] = id1 < id2 ? [id1, id2] : [id2, id1];
  db.prepare(`
    INSERT INTO account_relationships (account_id_1, account_id_2, relationship_type)
    VALUES (?, ?, ?)
    ON CONFLICT(account_id_1, account_id_2) DO UPDATE SET relationship_type = excluded.relationship_type
  `).run(a, b, type);
}

export interface AccountRelationshipRow {
  id: number;
  account_id_1: number;
  account_id_2: number;
  relationship_type: string;
  created_at: string;
  related_id: number;
  related_company_name: string;
  related_domain: string | null;
  related_industry: string;
  related_tier: string | null;
}

export function getAccountRelationships(accountId: number): AccountRelationshipRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      ar.*,
      CASE WHEN ar.account_id_1 = ? THEN ar.account_id_2 ELSE ar.account_id_1 END AS related_id,
      a.company_name AS related_company_name,
      a.domain AS related_domain,
      a.industry AS related_industry,
      a.tier AS related_tier
    FROM account_relationships ar
    JOIN accounts a ON a.id = CASE WHEN ar.account_id_1 = ? THEN ar.account_id_2 ELSE ar.account_id_1 END
    WHERE ar.account_id_1 = ? OR ar.account_id_2 = ?
    ORDER BY ar.created_at DESC
  `).all(accountId, accountId, accountId, accountId) as AccountRelationshipRow[];
}

// ─── Job Events (SSE streaming) ────────────────────────────────────────────────

export interface JobEvent {
  id: number;
  job_id: number;
  job_type: 'processing' | 'preprocessing';
  event_type: string;
  account_id: number | null;
  company_name: string | null;
  message: string;
  step_index: number | null;
  total_steps: number | null;
  created_at: string;
}

export function insertJobEvent(
  jobId: number,
  jobType: 'processing' | 'preprocessing',
  eventType: string,
  opts: {
    accountId?: number;
    companyName?: string;
    message: string;
    stepIndex?: number;
    totalSteps?: number;
  }
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO job_events (job_id, job_type, event_type, account_id, company_name, message, step_index, total_steps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    jobType,
    eventType,
    opts.accountId ?? null,
    opts.companyName ?? null,
    opts.message,
    opts.stepIndex ?? null,
    opts.totalSteps ?? null
  );
}

export function getJobEventsSince(
  jobId: number,
  jobType: 'processing' | 'preprocessing',
  sinceId: number
): JobEvent[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM job_events
    WHERE job_id = ? AND job_type = ? AND id > ?
    ORDER BY id ASC
  `).all(jobId, jobType, sinceId) as JobEvent[];
}

export function updateJobCurrentStep(jobId: number, step: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE processing_jobs SET current_step = ?, updated_at = datetime('now') WHERE id = ?
  `).run(step, jobId);
}
