#!/usr/bin/env tsx

/**
 * Utility script to reprocess pending accounts
 * Usage:
 *   npm run reprocess-pending              # Reprocess all pending accounts
 *   npm run reprocess-pending --job 123    # Reprocess pending accounts from job 123
 */

import {
  getPendingAccounts,
  createJob,
  updateAccountJobId,
  getAccountStats,
} from '../lib/db';
import { processJob } from '../lib/processor';

async function main() {
  const args = process.argv.slice(2);
  let jobId: number | undefined;

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--job' && i + 1 < args.length) {
      jobId = parseInt(args[i + 1], 10);
      if (isNaN(jobId)) {
        console.error('Error: --job must be followed by a valid job ID number');
        process.exit(1);
      }
    }
  }

  console.log('\n🔍 Checking for pending accounts...\n');

  // Get pending accounts
  const pendingAccounts = getPendingAccounts(jobId);

  if (pendingAccounts.length === 0) {
    console.log('✅ No pending accounts found.');
    if (jobId) {
      console.log(`   (checked job ${jobId})`);
    }
    console.log('\nAccount statistics:');
    const stats = getAccountStats();
    console.log(`   Total: ${stats.total}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Processing: ${stats.processing}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Failed: ${stats.failed}\n`);
    return;
  }

  console.log(`Found ${pendingAccounts.length} pending account(s):`);
  pendingAccounts.slice(0, 10).forEach((account, idx) => {
    console.log(`   ${idx + 1}. ${account.company_name} (ID: ${account.id})`);
  });

  if (pendingAccounts.length > 10) {
    console.log(`   ... and ${pendingAccounts.length - 10} more`);
  }

  console.log('\n📝 Creating new processing job...');

  // Create a new job for reprocessing
  const timestamp = new Date().toLocaleString();
  const jobFilename = jobId
    ? `Reprocess job ${jobId} - ${pendingAccounts.length} accounts - ${timestamp}`
    : `Reprocess pending - ${pendingAccounts.length} accounts - ${timestamp}`;

  const newJobId = createJob(jobFilename, pendingAccounts.length);
  console.log(`   Created job ${newJobId}: "${jobFilename}"`);

  // Update all accounts to belong to the new job
  console.log('\n🔄 Updating account assignments...');
  for (const account of pendingAccounts) {
    updateAccountJobId(account.id, newJobId);
  }
  console.log(`   ✓ Assigned ${pendingAccounts.length} accounts to job ${newJobId}`);

  // Start processing
  console.log('\n🚀 Starting background processing...');
  console.log('   This may take 30-60 seconds per account.\n');

  // Start processing (wait for completion)
  try {
    await processJob(newJobId);
    console.log('\n✅ Processing completed!\n');
  } catch (error) {
    console.error('\n❌ Processing failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
