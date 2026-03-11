/**
 * Triage Processor
 *
 * Processes accounts for quick triage categorization in parallel.
 * Follows the same pattern as preprocess-processor.ts.
 */

import pLimit from 'p-limit';
import {
  getTriageJob,
  getAccountsByJob,
  updateTriageJobStatus,
  updateTriageJobProgress,
  updateAccountTriage,
} from './db';
import { triageCompany } from './triage-agent';
import { PROCESSING_CONFIG } from './config';
import type { OktaPatch } from './okta-categorizer';
import { logWorkerError, sleep } from './worker-error-utils';

const activeJobs = new Set<number>();

/**
 * Check if a triage job currently has an active processing loop.
 */
export function isTriageJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

/**
 * Process triage job with parallel processing
 */
export async function processTriageJob(
  jobId: number,
  processingJobId: number,
  concurrency: number = Math.min(PROCESSING_CONFIG.concurrency, 10),
  model?: string,
  oktaPatch?: OktaPatch
): Promise<void> {
  if (activeJobs.has(jobId)) {
    console.log(`Triage job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getTriageJob(jobId);
    if (!job) {
      throw new Error(`Triage job ${jobId} not found`);
    }
    if (job.status !== 'pending') {
      console.log(`Triage job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting TRIAGE for job ${jobId}`);
    console.log(`   Total accounts: ${job.total_accounts}`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log(`   Model: ${model || 'default'}`);
    console.log(`${'='.repeat(60)}\n`);

    updateTriageJobStatus(jobId, 'processing');

    // Get accounts for this processing job
    const accounts = getAccountsByJob(processingJobId);

    if (accounts.length === 0) {
      console.log(`No accounts found for triage job ${jobId}`);
      updateTriageJobStatus(jobId, 'completed');
      return;
    }

    let processedCount = 0;
    let failedCount = 0;
    let wasCancelled = false;

    // Create concurrency limiter
    const limit = pLimit(concurrency);

    // Process in batches
    const batchSize = concurrency * 2;
    for (let i = 0; i < accounts.length; i += batchSize) {
      // Check if job is paused
      const currentJob = getTriageJob(jobId);
      if (currentJob?.paused === 1) {
        console.log(`\n  Job ${jobId} is paused. Waiting...`);
        await sleep(3000);
        i -= batchSize; // Stay at same batch
        continue;
      }

      // Check if job was cancelled
      if (currentJob?.status === 'failed') {
        console.log(`\n  Job ${jobId} was cancelled`);
        wasCancelled = true;
        break;
      }

      const batch = accounts.slice(i, i + batchSize);

      console.log(`\n  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(accounts.length / batchSize)} (${batch.length} accounts)...`);

      // Update current account
      if (batch.length > 0) {
        updateTriageJobStatus(jobId, 'processing', batch[0].company_name);
      }

      // Create triage promises
      const promises = batch.map((account, batchIndex) =>
        limit(async () => {
          const accountIndex = i + batchIndex;
          console.log(`[${accountIndex + 1}/${accounts.length}] Triaging: ${account.company_name}`);

          try {
            const triageResult = await triageCompany(
              {
                company_name: account.company_name,
                domain: account.domain,
                industry: account.industry,
                oktaPatch,
              },
              model
            );

            // Save triage results to account
            updateAccountTriage(account.id, {
              triage_auth0_tier: triageResult.auth0_tier,
              triage_okta_tier: triageResult.okta_tier,
              triage_summary: triageResult.summary,
              triage_data: JSON.stringify(triageResult),
            });

            processedCount++;
            console.log(
              `[${accountIndex + 1}/${accounts.length}] Done: ${account.company_name} — Auth0: ${triageResult.auth0_tier}, Okta: ${triageResult.okta_tier}`
            );
            return { success: true };
          } catch (error) {
            logWorkerError(
              `[${accountIndex + 1}/${accounts.length}] Failed to triage ${account.company_name}`,
              error
            );
            failedCount++;
            processedCount++;
            return { success: false };
          }
        })
      );

      // Wait for batch to complete
      await Promise.allSettled(promises);

      // Update progress
      updateTriageJobProgress(jobId, processedCount, failedCount);

      console.log(
        `  Progress: ${processedCount}/${accounts.length} processed, ${failedCount} failed`
      );

      // Small delay between batches
      if (i + batchSize < accounts.length) {
        await sleep(500);
      }
    }

    if (wasCancelled) {
      console.log(`Triage job ${jobId} cancelled. Processed: ${processedCount}, Failed: ${failedCount}`);
      return;
    }

    // Mark job as completed
    updateTriageJobStatus(jobId, 'completed');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Triage job ${jobId} completed`);
    console.log(`   Total processed: ${processedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    logWorkerError(`Triage job ${jobId} failed`, error);
    updateTriageJobStatus(jobId, 'failed');
    throw error;
  } finally {
    activeJobs.delete(jobId);
  }
}
