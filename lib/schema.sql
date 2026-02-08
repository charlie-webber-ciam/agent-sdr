-- Accounts table - stores company information and research results
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL,
  research_status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  current_auth_solution TEXT,
  customer_base_info TEXT,
  security_incidents TEXT,
  news_and_funding TEXT,
  tech_transformation TEXT,
  prospects TEXT, -- JSON array of names/titles
  research_summary TEXT,
  error_message TEXT,
  job_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  -- SDR Enhancement Fields
  tier TEXT CHECK(tier IN ('A', 'B', 'C', NULL)),
  estimated_annual_revenue TEXT,
  estimated_user_volume TEXT,
  use_cases TEXT, -- JSON array
  auth0_skus TEXT, -- JSON array: ["Core", "FGA", "Auth for AI"]
  sdr_notes TEXT,
  priority_score INTEGER DEFAULT 5 CHECK(priority_score BETWEEN 1 AND 10),
  last_edited_at TEXT,
  ai_suggestions TEXT, -- JSON: stores AI-generated suggestions
  FOREIGN KEY (job_id) REFERENCES processing_jobs(id)
);

-- Processing jobs table - tracks batch processing status
CREATE TABLE IF NOT EXISTS processing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  total_accounts INTEGER NOT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  current_account_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (current_account_id) REFERENCES accounts(id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(research_status);
CREATE INDEX IF NOT EXISTS idx_accounts_job_id ON accounts(job_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company_name ON accounts(company_name);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);
