/**
 * Employee Count Processor
 *
 * Processes accounts in batches of 50 concurrently to enrich with employee counts
 * from LinkedIn and Dun & Bradstreet using gpt-5-nano.
 */

import pLimit from 'p-limit';
import { getEmployeeCounts, EmployeeCountInput } from './employee-count-agent';
import {
  getEmployeeCountJob,
  updateEmployeeCountJobStatus,
  updateEmployeeCountJobProgress,
  createEmployeeCountResult,
} from './db';

// Track active processors to prevent concurrent runs
const activeProcessors = new Set<number>();

// Process 50 accounts concurrently
const CONCURRENCY = 50;
const BATCH_DELAY_MS = 1000; // 1 second delay between batches

export interface EmployeeCountBatchInput {
  accounts: Array<{ account_name: string }>;
}

/**
 * Process a batch of accounts to get employee counts
 */
export async function processEmployeeCountBatch(
  jobId: number,
  accounts: EmployeeCountInput[]
): Promise<void> {
  // Prevent concurrent processing of same job
  if (activeProcessors.has(jobId)) {
    console.log(`Job ${jobId} is already being processed`);
    return;
  }

  activeProcessors.add(jobId);

  try {
    const job = getEmployeeCountJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      console.log(`Job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    // Mark job as processing
    updateEmployeeCountJobStatus(jobId, 'processing');

    let processedCount = 0;
    let failedCount = 0;

    // Process accounts in batches of CONCURRENCY
    for (let i = 0; i < accounts.length; i += CONCURRENCY) {
      const batch = accounts.slice(i, i + CONCURRENCY);
      console.log(`\nProcessing batch ${Math.floor(i / CONCURRENCY) + 1}: accounts ${i + 1}-${Math.min(i + CONCURRENCY, accounts.length)} of ${accounts.length}`);

      // Create a rate limiter for this batch
      const limit = pLimit(CONCURRENCY);

      // Process all accounts in this batch concurrently
      const batchPromises = batch.map((account) =>
        limit(async () => {
          try {
            console.log(`  Researching: ${account.account_name}`);
            updateEmployeeCountJobStatus(jobId, 'processing', account.account_name);

            // Get employee counts from agent
            const result = await getEmployeeCounts(account);

            // Save result to database
            createEmployeeCountResult({
              job_id: jobId,
              account_name: result.account_name,
              linkedin_employee_count: result.linkedin_employee_count,
              dnb_employee_count: result.dnb_employee_count,
              error_message: result.error_message || null,
            });

            if (result.error_message) {
              failedCount++;
              console.log(`  ✗ Failed: ${account.account_name} - ${result.error_message}`);
            } else {
              processedCount++;
              console.log(`  ✓ Completed: ${account.account_name} - LinkedIn: ${result.linkedin_employee_count || 'N/A'}, D&B: ${result.dnb_employee_count || 'N/A'}`);
            }

            // Update job progress
            updateEmployeeCountJobProgress(jobId, processedCount, failedCount);
          } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  ✗ Error processing ${account.account_name}:`, error);

            // Save error result
            createEmployeeCountResult({
              job_id: jobId,
              account_name: account.account_name,
              linkedin_employee_count: null,
              dnb_employee_count: null,
              error_message: errorMessage,
            });

            // Update job progress
            updateEmployeeCountJobProgress(jobId, processedCount, failedCount);
          }
        })
      );

      // Wait for all accounts in this batch to complete
      await Promise.all(batchPromises);

      // Add delay between batches to respect rate limits
      if (i + CONCURRENCY < accounts.length) {
        console.log(`Waiting ${BATCH_DELAY_MS}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Mark job as completed
    updateEmployeeCountJobStatus(jobId, 'completed', null, `employee-counts-${jobId}.csv`);
    console.log(`\n✓ Job ${jobId} completed: ${processedCount} successful, ${failedCount} failed`);
  } catch (error) {
    console.error(`Fatal error processing job ${jobId}:`, error);
    updateEmployeeCountJobStatus(jobId, 'failed');
  } finally {
    activeProcessors.delete(jobId);
  }
}

/**
 * Start processing a job in the background
 */
export function startEmployeeCountJob(jobId: number, accounts: EmployeeCountInput[]): void {
  // Run in background without blocking
  processEmployeeCountBatch(jobId, accounts).catch(error => {
    console.error(`Background processing error for job ${jobId}:`, error);
  });
}
