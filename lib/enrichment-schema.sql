-- Enrichment jobs table - tracks bulk field-enrichment agent jobs
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                    -- 'domain', 'standardize_industry', etc.
  name TEXT NOT NULL,
  total_accounts INTEGER NOT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  current_account_id INTEGER,
  filters TEXT,                          -- JSON: stores filters used for this job
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (current_account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_type_status
  ON enrichment_jobs(type, status);
