-- Employee count enrichment jobs table
CREATE TABLE IF NOT EXISTS employee_count_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  total_accounts INTEGER NOT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  current_company TEXT,
  output_filename TEXT, -- Generated CSV filename
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Employee count results table
CREATE TABLE IF NOT EXISTS employee_count_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  account_name TEXT NOT NULL,
  linkedin_employee_count TEXT,
  dnb_employee_count TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES employee_count_jobs(id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employee_count_jobs_status ON employee_count_jobs(status);
CREATE INDEX IF NOT EXISTS idx_employee_count_results_job_id ON employee_count_results(job_id);
