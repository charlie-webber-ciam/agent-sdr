import { stringify } from 'csv-stringify/sync';
import { Account } from './db';

export interface ExportAccount {
  id: number;
  company_name: string;
  domain: string | null;
  industry: string;
  tier: 'A' | 'B' | 'C' | null;
  priority_score: number | null;
  estimated_annual_revenue: string | null;
  estimated_user_volume: string | null;
  auth0_skus: string[];
  use_cases: string[];
  auth0_account_owner: string | null;
  research_summary: string | null;
  current_auth_solution: string | null;
  customer_base_info: string | null;
  security_incidents: string | null;
  news_and_funding: string | null;
  tech_transformation: string | null;
  prospects: any[];
  sdr_notes: string | null;
  processed_at: string | null;
  created_at: string;
  last_edited_at: string | null;
}

/**
 * Transform database account to export format
 * Parses JSON fields and handles null values
 */
export function transformAccountForExport(account: Account): ExportAccount {
  // Parse JSON fields safely
  const parseJSON = (value: string | null, fallback: any = []) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  return {
    id: account.id,
    company_name: account.company_name,
    domain: account.domain,
    industry: account.industry,
    tier: account.tier,
    priority_score: account.priority_score,
    estimated_annual_revenue: account.estimated_annual_revenue,
    estimated_user_volume: account.estimated_user_volume,
    auth0_skus: parseJSON(account.auth0_skus, []),
    use_cases: parseJSON(account.use_cases, []),
    auth0_account_owner: account.auth0_account_owner,
    research_summary: account.research_summary,
    current_auth_solution: account.current_auth_solution,
    customer_base_info: account.customer_base_info,
    security_incidents: account.security_incidents,
    news_and_funding: account.news_and_funding,
    tech_transformation: account.tech_transformation,
    prospects: parseJSON(account.prospects, []),
    sdr_notes: account.sdr_notes,
    processed_at: account.processed_at,
    created_at: account.created_at,
    last_edited_at: account.last_edited_at,
  };
}

/**
 * Generate CSV content from accounts array
 * Flattens nested JSON fields into comma-separated strings
 */
export function generateCSV(accounts: Account[]): string {
  const exportAccounts = accounts.map(transformAccountForExport);

  // Prepare data for CSV with flattened JSON fields
  const csvData = exportAccounts.map((account) => ({
    id: account.id,
    company_name: account.company_name,
    domain: account.domain || '',
    industry: account.industry,
    tier: account.tier || '',
    priority_score: account.priority_score ?? '',
    estimated_annual_revenue: account.estimated_annual_revenue || '',
    estimated_user_volume: account.estimated_user_volume || '',
    auth0_skus: account.auth0_skus.join(', '),
    use_cases: account.use_cases.join(', '),
    auth0_account_owner: account.auth0_account_owner || '',
    research_summary: account.research_summary || '',
    current_auth_solution: account.current_auth_solution || '',
    customer_base_info: account.customer_base_info || '',
    security_incidents: account.security_incidents || '',
    news_and_funding: account.news_and_funding || '',
    tech_transformation: account.tech_transformation || '',
    prospects: JSON.stringify(account.prospects),
    sdr_notes: account.sdr_notes || '',
    processed_at: account.processed_at || '',
    created_at: account.created_at,
    last_edited_at: account.last_edited_at || '',
  }));

  // Generate CSV with headers
  return stringify(csvData, {
    header: true,
    columns: [
      'id',
      'company_name',
      'domain',
      'industry',
      'tier',
      'priority_score',
      'estimated_annual_revenue',
      'estimated_user_volume',
      'auth0_skus',
      'use_cases',
      'auth0_account_owner',
      'research_summary',
      'current_auth_solution',
      'customer_base_info',
      'security_incidents',
      'news_and_funding',
      'tech_transformation',
      'prospects',
      'sdr_notes',
      'processed_at',
      'created_at',
      'last_edited_at',
    ],
  });
}

/**
 * Generate JSON export with metadata
 */
export function generateJSON(
  accounts: Account[],
  filters?: Record<string, any>
): string {
  const exportAccounts = accounts.map(transformAccountForExport);

  const exportData = {
    export_metadata: {
      export_date: new Date().toISOString(),
      total_accounts: accounts.length,
      format_version: '1.0',
      filters_applied: filters || {},
    },
    accounts: exportAccounts.map((account) => ({
      id: account.id,
      company_name: account.company_name,
      domain: account.domain,
      industry: account.industry,
      tier: account.tier,
      priority_score: account.priority_score,
      estimated_annual_revenue: account.estimated_annual_revenue,
      estimated_user_volume: account.estimated_user_volume,
      auth0_skus: account.auth0_skus,
      use_cases: account.use_cases,
      auth0_account_owner: account.auth0_account_owner,
      research: {
        summary: account.research_summary,
        current_auth_solution: account.current_auth_solution,
        customer_base_info: account.customer_base_info,
        security_incidents: account.security_incidents,
        news_and_funding: account.news_and_funding,
        tech_transformation: account.tech_transformation,
      },
      prospects: account.prospects,
      sdr_notes: account.sdr_notes,
      timestamps: {
        processed_at: account.processed_at,
        created_at: account.created_at,
        last_edited_at: account.last_edited_at,
      },
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate JavaScript file with data as a global variable
 */
export function generateJavaScript(
  accounts: Account[],
  filters?: Record<string, any>
): string {
  const jsonData = generateJSON(accounts, filters);
  return `var MyData = ${jsonData};`;
}

/**
 * Get filename for export with timestamp
 */
export function getExportFilename(format: 'csv' | 'json' | 'js' | 'zip', prefix = 'accounts-export'): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const extension = format === 'zip' ? 'zip' : format;
  return `${prefix}-${timestamp}.${extension}`;
}
