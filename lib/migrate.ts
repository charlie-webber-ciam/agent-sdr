import Database from 'better-sqlite3';

/**
 * Migration helper to add new columns to existing database
 * This runs automatically on app startup to handle existing databases
 */
export function migrateDatabase(db: Database.Database) {
  // Check if new columns exist and add them if missing
  const columns = [
    { name: 'tier', type: 'TEXT', constraint: "CHECK(tier IN ('A', 'B', 'C', NULL))" },
    { name: 'estimated_annual_revenue', type: 'TEXT' },
    { name: 'estimated_user_volume', type: 'TEXT' },
    { name: 'use_cases', type: 'TEXT' },
    { name: 'auth0_skus', type: 'TEXT' },
    { name: 'sdr_notes', type: 'TEXT' },
    { name: 'priority_score', type: 'INTEGER', default: '5', constraint: 'CHECK(priority_score BETWEEN 1 AND 10)' },
    { name: 'last_edited_at', type: 'TEXT' },
    { name: 'ai_suggestions', type: 'TEXT' },
    { name: 'auth0_account_owner', type: 'TEXT' },
    // Okta Workforce Identity Research Fields
    { name: 'okta_current_iam_solution', type: 'TEXT' },
    { name: 'okta_workforce_info', type: 'TEXT' },
    { name: 'okta_security_incidents', type: 'TEXT' },
    { name: 'okta_news_and_funding', type: 'TEXT' },
    { name: 'okta_tech_transformation', type: 'TEXT' },
    { name: 'okta_ecosystem', type: 'TEXT' },
    { name: 'okta_prospects', type: 'TEXT' },
    { name: 'okta_research_summary', type: 'TEXT' },
    { name: 'okta_opportunity_type', type: 'TEXT', constraint: "CHECK(okta_opportunity_type IN ('net_new', 'competitive_displacement', 'expansion', 'unknown', NULL))" },
    { name: 'okta_priority_score', type: 'INTEGER', constraint: 'CHECK(okta_priority_score BETWEEN 1 AND 10)' },
    { name: 'okta_processed_at', type: 'TEXT' },
    // Okta Categorization Fields
    { name: 'okta_tier', type: 'TEXT', constraint: "CHECK(okta_tier IN ('A', 'B', 'C', NULL))" },
    { name: 'okta_estimated_annual_revenue', type: 'TEXT' },
    { name: 'okta_estimated_user_volume', type: 'TEXT' },
    { name: 'okta_use_cases', type: 'TEXT' }, // JSON array
    { name: 'okta_skus', type: 'TEXT' }, // JSON array: Okta products
    { name: 'okta_sdr_notes', type: 'TEXT' },
    { name: 'okta_last_edited_at', type: 'TEXT' },
    { name: 'okta_ai_suggestions', type: 'TEXT' }, // JSON: stores AI-generated suggestions for Okta
    { name: 'okta_account_owner', type: 'TEXT' },
    // Research model tracking
    { name: 'research_model', type: 'TEXT' },
    // Triage fields
    { name: 'triage_auth0_tier', type: 'TEXT', constraint: "CHECK(triage_auth0_tier IN ('A', 'B', 'C', NULL))" },
    { name: 'triage_okta_tier', type: 'TEXT', constraint: "CHECK(triage_okta_tier IN ('A', 'B', 'C', NULL))" },
    { name: 'triage_summary', type: 'TEXT' },
    { name: 'triage_data', type: 'TEXT' },
    { name: 'triaged_at', type: 'TEXT' },
  ];

  // Get existing columns
  const existingColumns = db.prepare('PRAGMA table_info(accounts)').all() as any[];
  const existingColumnNames = new Set(existingColumns.map((col: any) => col.name));

  // Add missing columns
  for (const column of columns) {
    if (!existingColumnNames.has(column.name)) {
      let sql = `ALTER TABLE accounts ADD COLUMN ${column.name} ${column.type}`;
      if (column.default) {
        sql += ` DEFAULT ${column.default}`;
      }
      if (column.constraint) {
        sql += ` ${column.constraint}`;
      }

      try {
        db.exec(sql);
        console.log(`✓ Added column: ${column.name}`);
      } catch (error) {
        console.error(`Failed to add column ${column.name}:`, error);
      }
    }
  }

  // Add indexes for new fields
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_tier ON accounts(tier)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_priority ON accounts(priority_score)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_okta_processed ON accounts(okta_processed_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_okta_tier ON accounts(okta_tier)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_triage_auth0_tier ON accounts(triage_auth0_tier)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_triage_okta_tier ON accounts(triage_okta_tier)');
    console.log('✓ Added indexes for tier, priority_score, okta_processed_at, okta_tier, and triage tiers');
  } catch (error) {
    console.error('Failed to add indexes:', error);
  }

  // Add unique constraint on domain
  try {
    // Check if unique constraint exists
    const indexes = db.prepare('PRAGMA index_list(accounts)').all() as any[];
    const hasUniqueIndex = indexes.some((idx: any) => idx.name === 'idx_accounts_domain_unique');

    if (!hasUniqueIndex) {
      // Create unique index on domain
      db.exec('CREATE UNIQUE INDEX idx_accounts_domain_unique ON accounts(domain)');
      console.log('✓ Added unique constraint on domain');
    }
  } catch (error) {
    // Handle case where duplicates already exist
    console.error('Could not add unique constraint - duplicates may exist:', error);
    console.log('ℹ️  Run duplicate cleanup first if needed');
  }

  console.log('ℹ️  Domain field uses NOT NULL constraint with dummy values for accounts without domains');

  // Add categorization_jobs table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS categorization_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_accounts INTEGER NOT NULL,
        processed_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        current_account_id INTEGER,
        filters TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (current_account_id) REFERENCES accounts(id)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_categorization_jobs_status ON categorization_jobs(status)');
    console.log('✓ Ensured categorization_jobs table exists');
  } catch (error) {
    console.error('Failed to create categorization_jobs table:', error);
  }

  // Add triage_jobs table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS triage_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        total_accounts INTEGER NOT NULL,
        processed_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        current_account TEXT,
        paused INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_triage_jobs_status ON triage_jobs(status)');
    console.log('✓ Ensured triage_jobs table exists');
  } catch (error) {
    console.error('Failed to create triage_jobs table:', error);
  }

  // Add paused column to processing_jobs
  try {
    const processingJobsCols = db.prepare('PRAGMA table_info(processing_jobs)').all() as any[];
    const hasProcessingPaused = processingJobsCols.some((col: any) => col.name === 'paused');

    if (!hasProcessingPaused) {
      db.exec('ALTER TABLE processing_jobs ADD COLUMN paused INTEGER DEFAULT 0');
      console.log('✓ Added paused column to processing_jobs');
    }
  } catch (error) {
    console.error('Failed to add paused column to processing_jobs:', error);
  }

  // Add account_tags table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        tag_type TEXT NOT NULL DEFAULT 'custom',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, tag)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_account_tags_account_id ON account_tags(account_id)');
    console.log('✓ Ensured account_tags table exists');
  } catch (error) {
    console.error('Failed to create account_tags table:', error);
  }

  // Add section_comments table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS section_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        perspective TEXT NOT NULL,
        section_key TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, perspective, section_key)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_section_comments_account_id ON section_comments(account_id)');
    console.log('✓ Ensured section_comments table exists');
  } catch (error) {
    console.error('Failed to create section_comments table:', error);
  }

  // Add account_notes table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_account_notes_account_id ON account_notes(account_id)');
    console.log('✓ Ensured account_notes table exists');
  } catch (error) {
    console.error('Failed to create account_notes table:', error);
  }

  // Add prospects table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prospects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        title TEXT,
        email TEXT,
        phone TEXT,
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
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospects_account_id ON prospects(account_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospects_parent_id ON prospects(parent_prospect_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospects_role_type ON prospects(role_type)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospects_source ON prospects(source)');
    console.log('✓ Ensured prospects table exists');
  } catch (error) {
    console.error('Failed to create prospects table:', error);
  }

  // Add mobile column to prospects table if missing
  try {
    const prospectCols = db.prepare('PRAGMA table_info(prospects)').all() as any[];
    const hasMobile = prospectCols.some((col: any) => col.name === 'mobile');
    if (!hasMobile) {
      db.exec('ALTER TABLE prospects ADD COLUMN mobile TEXT');
      console.log('✓ Added mobile column to prospects');
    }
  } catch (error) {
    console.error('Failed to add mobile column to prospects:', error);
  }

  // Add prospect_import_jobs table if it doesn't exist
  try {
    db.exec(`
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
      )
    `);
    console.log('✓ Ensured prospect_import_jobs table exists');
  } catch (error) {
    console.error('Failed to create prospect_import_jobs table:', error);
  }

  // Add opportunity_import_jobs table if it doesn't exist
  try {
    db.exec(`
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
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_opp_import_jobs_status ON opportunity_import_jobs(status)');
    console.log('✓ Ensured opportunity_import_jobs table exists');
  } catch (error) {
    console.error('Failed to create opportunity_import_jobs table:', error);
  }

  // Add salesforce_opportunities table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS salesforce_opportunities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        import_job_id INTEGER NOT NULL,
        opportunity_name TEXT NOT NULL,
        stage TEXT,
        last_stage_change_date TEXT,
        business_use_case TEXT,
        win_loss_description TEXT,
        why_do_anything TEXT,
        why_do_it_now TEXT,
        why_solve_problem TEXT,
        why_okta TEXT,
        steps_to_close TEXT,
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
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_sf_opportunities_account_id ON salesforce_opportunities(account_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sf_opportunities_import_job ON salesforce_opportunities(import_job_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sf_opportunities_stage ON salesforce_opportunities(stage)');
    console.log('✓ Ensured salesforce_opportunities table exists');
  } catch (error) {
    console.error('Failed to create salesforce_opportunities table:', error);
  }

  // Add opportunity_prospects join table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS opportunity_prospects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opportunity_id INTEGER NOT NULL,
        prospect_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (opportunity_id) REFERENCES salesforce_opportunities(id) ON DELETE CASCADE,
        FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
        UNIQUE(opportunity_id, prospect_id)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_opp_prospects_opp_id ON opportunity_prospects(opportunity_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_opp_prospects_prospect_id ON opportunity_prospects(prospect_id)');
    console.log('✓ Ensured opportunity_prospects table exists');
  } catch (error) {
    console.error('Failed to create opportunity_prospects table:', error);
  }

  // Add prospect_processing_jobs table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prospect_processing_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_prospects INTEGER NOT NULL DEFAULT 0,
        processed_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        current_prospect_id INTEGER,
        filters TEXT,
        job_subtype TEXT NOT NULL DEFAULT 'classify' CHECK(job_subtype IN ('classify', 'enrich_hvt', 'enrich_mvt', 'enrich_lvt', 'contact_readiness')),
        error_log TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (current_prospect_id) REFERENCES prospects(id)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospect_processing_jobs_status ON prospect_processing_jobs(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospect_processing_jobs_created ON prospect_processing_jobs(created_at)');
    console.log('✓ Ensured prospect_processing_jobs table exists');
  } catch (error) {
    console.error('Failed to create prospect_processing_jobs table:', error);
  }

  // Add paused column to preprocessing_jobs if table exists
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='preprocessing_jobs'").all() as any[];
    if (tables.length > 0) {
      const preprocessingJobsCols = db.prepare('PRAGMA table_info(preprocessing_jobs)').all() as any[];
      const hasPreprocessingPaused = preprocessingJobsCols.some((col: any) => col.name === 'paused');

      if (!hasPreprocessingPaused) {
        db.exec('ALTER TABLE preprocessing_jobs ADD COLUMN paused INTEGER DEFAULT 0');
        console.log('✓ Added paused column to preprocessing_jobs');
      }
    }
  } catch (error) {
    console.error('Failed to add paused column to preprocessing_jobs:', error);
  }

  // Add current_step column to processing_jobs if missing
  try {
    const processingJobsCols2 = db.prepare('PRAGMA table_info(processing_jobs)').all() as any[];
    const hasCurrentStep = processingJobsCols2.some((col: any) => col.name === 'current_step');
    if (!hasCurrentStep) {
      db.exec('ALTER TABLE processing_jobs ADD COLUMN current_step TEXT');
      console.log('✓ Added current_step column to processing_jobs');
    }
  } catch (error) {
    console.error('Failed to add current_step column to processing_jobs:', error);
  }

  // Add current_step column to preprocessing_jobs if it exists and is missing the column
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='preprocessing_jobs'").all() as any[];
    if (tables.length > 0) {
      const preprocessingJobsCols2 = db.prepare('PRAGMA table_info(preprocessing_jobs)').all() as any[];
      const hasPreprocessingCurrentStep = preprocessingJobsCols2.some((col: any) => col.name === 'current_step');
      if (!hasPreprocessingCurrentStep) {
        db.exec('ALTER TABLE preprocessing_jobs ADD COLUMN current_step TEXT');
        console.log('✓ Added current_step column to preprocessing_jobs');
      }
    }
  } catch (error) {
    console.error('Failed to add current_step column to preprocessing_jobs:', error);
  }

  // Create job_events table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id       INTEGER NOT NULL,
        job_type     TEXT NOT NULL DEFAULT 'processing',
        event_type   TEXT NOT NULL,
        account_id   INTEGER,
        company_name TEXT,
        message      TEXT NOT NULL,
        step_index   INTEGER,
        total_steps  INTEGER,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_job_events_lookup ON job_events(job_id, job_type, id)');
    console.log('✓ Ensured job_events table exists');
  } catch (error) {
    console.error('Failed to create job_events table:', error);
  }

  // Add AI enrichment columns to prospects table if missing
  try {
    const prospectCols2 = db.prepare('PRAGMA table_info(prospects)').all() as any[];
    const prospectColNames = new Set(prospectCols2.map((col: any) => col.name));

    const prospectNewColumns = [
      { name: 'value_tier', type: 'TEXT' },
      { name: 'seniority_level', type: 'TEXT' },
      { name: 'ai_summary', type: 'TEXT' },
      { name: 'ai_processed_at', type: 'TEXT' },
      { name: 'department_tag', type: 'TEXT' },
      { name: 'call_count', type: 'INTEGER', default: '0' },
      { name: 'connect_count', type: 'INTEGER', default: '0' },
      { name: 'last_called_at', type: 'TEXT' },
      { name: 'prospect_tags', type: 'TEXT' },
      { name: 'contact_readiness', type: 'TEXT' },
    ];

    for (const col of prospectNewColumns) {
      if (!prospectColNames.has(col.name)) {
        let sql = `ALTER TABLE prospects ADD COLUMN ${col.name} ${col.type}`;
        if (col.default) sql += ` DEFAULT ${col.default}`;
        db.exec(sql);
        console.log(`✓ Added column to prospects: ${col.name}`);
      }
    }
  } catch (error) {
    console.error('Failed to add AI enrichment columns to prospects:', error);
  }

  // Add prospect_calls table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prospect_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prospect_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        outcome TEXT NOT NULL CHECK(outcome IN ('dialed','connected','voicemail','no_answer','busy')),
        notes TEXT,
        duration_sec INTEGER,
        called_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospect_calls_prospect_id ON prospect_calls(prospect_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospect_calls_account_id ON prospect_calls(account_id)');
    console.log('✓ Ensured prospect_calls table exists');
  } catch (error) {
    console.error('Failed to create prospect_calls table:', error);
  }

  // Add prospect_lists table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prospect_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        list_type TEXT NOT NULL DEFAULT 'call' CHECK(list_type IN ('call','email')),
        filters TEXT,
        account_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospect_lists_account_id ON prospect_lists(account_id)');
    console.log('✓ Ensured prospect_lists table exists');
  } catch (error) {
    console.error('Failed to create prospect_lists table:', error);
  }

  // Add prospect_list_items table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prospect_list_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL,
        prospect_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (list_id) REFERENCES prospect_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
        UNIQUE(list_id, prospect_id)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospect_list_items_list_id ON prospect_list_items(list_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prospect_list_items_prospect_id ON prospect_list_items(prospect_id)');
    console.log('✓ Ensured prospect_list_items table exists');
  } catch (error) {
    console.error('Failed to create prospect_list_items table:', error);
  }

  // Add account_relationships table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id_1 INTEGER NOT NULL,
        account_id_2 INTEGER NOT NULL,
        relationship_type TEXT NOT NULL CHECK(relationship_type IN ('duplicate', 'parent', 'subsidiary', 'formerly_known_as', 'not_duplicate')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (account_id_1) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id_2) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id_1, account_id_2)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_account_relationships_a1 ON account_relationships(account_id_1)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_account_relationships_a2 ON account_relationships(account_id_2)');
    console.log('✓ Ensured account_relationships table exists');
  } catch (error) {
    console.error('Failed to create account_relationships table:', error);
  }
}
