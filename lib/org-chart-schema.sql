-- Org charts table - stores chart metadata and optional account link
CREATE TABLE IF NOT EXISTS org_charts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  account_id INTEGER,
  total_people INTEGER NOT NULL DEFAULT 0,
  validation_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Org chart people - individual records with hierarchical relationships
CREATE TABLE IF NOT EXISTS org_chart_people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chart_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  email TEXT,
  linkedin_url TEXT,
  manager_id INTEGER,
  level INTEGER NOT NULL DEFAULT 0,
  original_reports_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chart_id) REFERENCES org_charts(id) ON DELETE CASCADE,
  FOREIGN KEY (manager_id) REFERENCES org_chart_people(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_org_chart_people_chart ON org_chart_people(chart_id);
CREATE INDEX IF NOT EXISTS idx_org_chart_people_manager ON org_chart_people(manager_id);
CREATE INDEX IF NOT EXISTS idx_org_charts_account ON org_charts(account_id);
