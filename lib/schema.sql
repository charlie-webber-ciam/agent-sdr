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

-- Prospects table - stores contacts/prospects linked to accounts
CREATE TABLE IF NOT EXISTS prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  linkedin_url TEXT,
  department TEXT,
  notes TEXT,
  role_type TEXT CHECK(role_type IN ('decision_maker','champion','influencer','blocker','end_user','unknown')),
  relationship_status TEXT CHECK(relationship_status IN ('new','engaged','warm','cold')) DEFAULT 'new',
  source TEXT CHECK(source IN ('manual','salesforce_import','ai_research')) DEFAULT 'manual',
  mailing_address TEXT,
  lead_source TEXT,
  last_activity_date TEXT,
  do_not_call INTEGER DEFAULT 0,
  description TEXT,
  parent_prospect_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);

-- Prospect import jobs table - tracks Salesforce CSV import jobs
CREATE TABLE IF NOT EXISTS prospect_import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  unmatched_count INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
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

-- Opportunity import jobs table - tracks Salesforce opportunity CSV import jobs
CREATE TABLE IF NOT EXISTS opportunity_import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  unique_opportunities INTEGER NOT NULL DEFAULT 0,
  unique_contacts INTEGER NOT NULL DEFAULT 0,
  matched_accounts INTEGER NOT NULL DEFAULT 0,
  unmatched_accounts INTEGER NOT NULL DEFAULT 0,
  prospects_created INTEGER NOT NULL DEFAULT 0,
  opportunities_created INTEGER NOT NULL DEFAULT 0,
  champions_tagged INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Salesforce opportunities table - stores imported opportunity data
CREATE TABLE IF NOT EXISTS salesforce_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  import_job_id INTEGER NOT NULL,
  opportunity_name TEXT NOT NULL,
  stage TEXT,
  last_stage_change_date TEXT,
  -- Discovery / Qualification Notes
  business_use_case TEXT,
  win_loss_description TEXT,
  why_do_anything TEXT,
  why_do_it_now TEXT,
  why_solve_problem TEXT,
  why_okta TEXT,
  steps_to_close TEXT,
  -- MEDDPICC Fields
  economic_buyer TEXT,
  metrics TEXT,
  decision_process TEXT,
  paper_process TEXT,
  identify_pain TEXT,
  decision_criteria TEXT,
  champions TEXT,
  champion_title TEXT,
  compelling_event TEXT,
  competition TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (import_job_id) REFERENCES opportunity_import_jobs(id) ON DELETE CASCADE
);

-- Join table linking opportunities to prospects
CREATE TABLE IF NOT EXISTS opportunity_prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL,
  prospect_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (opportunity_id) REFERENCES salesforce_opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  UNIQUE(opportunity_id, prospect_id)
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
CREATE INDEX IF NOT EXISTS idx_prospects_account_id ON prospects(account_id);
CREATE INDEX IF NOT EXISTS idx_prospects_parent_id ON prospects(parent_prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_role_type ON prospects(role_type);
CREATE INDEX IF NOT EXISTS idx_prospects_source ON prospects(source);
CREATE INDEX IF NOT EXISTS idx_sf_opportunities_account_id ON salesforce_opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_sf_opportunities_import_job ON salesforce_opportunities(import_job_id);
CREATE INDEX IF NOT EXISTS idx_sf_opportunities_stage ON salesforce_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opp_prospects_opp_id ON opportunity_prospects(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_prospects_prospect_id ON opportunity_prospects(prospect_id);
CREATE INDEX IF NOT EXISTS idx_opp_import_jobs_status ON opportunity_import_jobs(status);

-- Account relationships table - tracks duplicate, parent/subsidiary, and other relationships
CREATE TABLE IF NOT EXISTS account_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id_1 INTEGER NOT NULL,
  account_id_2 INTEGER NOT NULL,
  relationship_type TEXT NOT NULL CHECK(relationship_type IN ('duplicate', 'parent', 'subsidiary', 'formerly_known_as', 'not_duplicate')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (account_id_1) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id_2) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id_1, account_id_2)
);
CREATE INDEX IF NOT EXISTS idx_account_relationships_a1 ON account_relationships(account_id_1);
CREATE INDEX IF NOT EXISTS idx_account_relationships_a2 ON account_relationships(account_id_2);

-- Job events table - stores granular processing events for SSE streaming
CREATE TABLE IF NOT EXISTS job_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id       INTEGER NOT NULL,
  job_type     TEXT NOT NULL DEFAULT 'processing', -- 'processing' | 'preprocessing'
  event_type   TEXT NOT NULL,  -- 'account_start' | 'research_step' | 'categorizing' | 'account_complete' | 'account_failed' | 'job_complete'
  account_id   INTEGER,
  company_name TEXT,
  message      TEXT NOT NULL,
  step_index   INTEGER,   -- 1-based index of current sub-step
  total_steps  INTEGER,   -- total sub-steps for this phase
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_events_lookup ON job_events(job_id, job_type, id);
