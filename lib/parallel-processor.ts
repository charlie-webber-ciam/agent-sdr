/**
 * Parallel Processor
 *
 * Processes multiple accounts concurrently using controlled parallelism.
 * Features:
 * - Configurable concurrency limit (default: 5)
 * - Progress tracking and job updates
 * - Graceful error handling (continues on individual failures)
 * - Rate limit awareness with exponential backoff
 */

import pLimit from 'p-limit';
import {
  getJob,
  getMultiplePendingAccounts,
  updateJobStatus,
  updateJobProgress,
} from './db';
import { processAccountWithRetry, AccountProcessingResult } from './account-worker';
import { ResearchMode } from './dual-researcher';
import { PROCESSING_CONFIG } from './config';

export async function processJobParallel(
  jobId: number,
  concurrency: number = PROCESSING_CONFIG.concurrency,
  researchType: ResearchMode = 'both',
  model?: string
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Starting PARALLEL processing for job ${jobId}`);
  console.log(`   Concurrency: ${concurrency} accounts at a time`);
  console.log(`${'='.repeat(60)}\n`);

  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (job.status !== 'pending' && job.status !== 'processing') {
    console.log(`Job ${jobId} is not pending or processing (status: ${job.status})`);
    return;
  }

  try {
    if (job.status === 'pending') {
      updateJobStatus(jobId, 'processing');
    }

    let processedCount = 0;
    let failedCount = 0;

    // Create concurrency limiter
    const limit = pLimit(concurrency);

    // Process accounts in batches
    while (true) {
      // Check if job is paused
      const currentJob = getJob(jobId);
      if (currentJob?.paused === 1) {
        console.log(`\n⏸️  Job ${jobId} is paused. Waiting...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Check every 3 seconds
        continue;
      }

      // Check if job was cancelled
      if (currentJob?.status === 'failed') {
        console.log(`\n❌ Job ${jobId} was cancelled`);
        break;
      }

      // Get next batch of pending accounts
      const accounts = getMultiplePendingAccounts(jobId, concurrency * 2);

      if (accounts.length === 0) {
        console.log(`\n✓ No more pending accounts for job ${jobId}`);
        break;
      }

      console.log(`\n📦 Processing batch of ${accounts.length} accounts...`);

      // Create array of promises with concurrency limit
      const promises = accounts.map(account =>
        limit(() => processAccountWithRetry(account, jobId, researchType, model))
      );

      // Wait for all accounts in batch to complete
      const results = await Promise.allSettled(promises);

      // Process results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const accountResult: AccountProcessingResult = result.value;
          if (accountResult.success) {
            processedCount++;
          } else {
            failedCount++;
          }
        } else {
          // Promise was rejected (shouldn't happen with our error handling, but just in case)
          console.error(`Unexpected error processing account:`, result.reason);
          failedCount++;
        }
      });

      // Update job progress
      updateJobProgress(jobId, processedCount, failedCount);

      console.log(
        `\n📊 Progress: ${processedCount} completed, ${failedCount} failed, ${
          job.total_accounts - processedCount - failedCount
        } remaining`
      );

      // Small delay between batches to avoid overwhelming the API
      if (accounts.length >= concurrency) {
        await new Promise(resolve => setTimeout(resolve, PROCESSING_CONFIG.accountDelay));
      }
    }

    // Mark job as completed
    updateJobStatus(jobId, 'completed');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Job ${jobId} completed`);
    console.log(`   Total: ${job.total_accounts} accounts`);
    console.log(`   ✓ Processed: ${processedCount}`);
    console.log(`   ✗ Failed: ${failedCount}`);
    console.log(`   Success Rate: ${((processedCount / job.total_accounts) * 100).toFixed(1)}%`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error(`\n❌ Job ${jobId} failed:`, error);
    updateJobStatus(jobId, 'failed');
    throw error;
  }
}
