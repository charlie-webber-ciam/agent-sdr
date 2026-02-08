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
    console.log('✓ Added indexes for tier and priority_score');
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
}
