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
  auth0_account_owner TEXT,
  okta_account_owner TEXT,
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

-- Categorization jobs table - tracks bulk categorization status
CREATE TABLE IF NOT EXISTS categorization_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_accounts INTEGER NOT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  current_account_id INTEGER,
  filters TEXT, -- JSON: stores filters used for this job
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (current_account_id) REFERENCES accounts(id)
);

-- Preprocessing jobs table - tracks bulk validation/cleaning jobs
CREATE TABLE IF NOT EXISTS preprocessing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  total_accounts INTEGER NOT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  removed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  current_company TEXT,
  output_filename TEXT, -- Generated CSV filename
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Preprocessing results table - stores validation results for each company
CREATE TABLE IF NOT EXISTS preprocessing_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  original_company_name TEXT NOT NULL,
  original_domain TEXT,
  original_industry TEXT,
  validated_company_name TEXT,
  validated_domain TEXT,
  is_duplicate BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1, -- Still in business
  should_include BOOLEAN DEFAULT 1,
  validation_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES preprocessing_jobs(id)
);

-- Account tags (many-to-many)
CREATE TABLE IF NOT EXISTS account_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  tag_type TEXT NOT NULL DEFAULT 'custom',  -- 'preset' or 'custom'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, tag)
);

-- Per-section user comments
CREATE TABLE IF NOT EXISTS section_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  perspective TEXT NOT NULL,        -- 'auth0' or 'okta'
  section_key TEXT NOT NULL,        -- e.g. 'current_auth_solution', 'news_and_funding'
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, perspective, section_key)
);

-- Account notes (engagement journal)
CREATE TABLE IF NOT EXISTS account_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(research_status);
CREATE INDEX IF NOT EXISTS idx_accounts_job_id ON accounts(job_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company_name ON accounts(company_name);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_categorization_jobs_status ON categorization_jobs(status);
CREATE INDEX IF NOT EXISTS idx_preprocessing_jobs_status ON preprocessing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_preprocessing_results_job_id ON preprocessing_results(job_id);
CREATE INDEX IF NOT EXISTS idx_preprocessing_results_domain ON preprocessing_results(validated_domain);
CREATE INDEX IF NOT EXISTS idx_account_tags_account_id ON account_tags(account_id);
CREATE INDEX IF NOT EXISTS idx_section_comments_account_id ON section_comments(account_id);
CREATE INDEX IF NOT EXISTS idx_account_notes_account_id ON account_notes(account_id);
