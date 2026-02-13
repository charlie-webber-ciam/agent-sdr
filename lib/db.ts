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

    // Initialize employee count schema
    const employeeCountSchema = readFileSync(join(process.cwd(), 'lib', 'employee-count-schema.sql'), 'utf-8');
    db.exec(employeeCountSchema);

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
    // Delete the account (CASCADE will handle foreign keys if needed)
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

  // Update job status to failed (cancelled)
  db.prepare(`
    UPDATE processing_jobs
    SET status = 'failed',
        paused = 0,
        updated_at = datetime('now'),
        completed_at = datetime('now')
    WHERE id = ?
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
