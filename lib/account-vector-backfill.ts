import {
  countVectorEligibleAccounts,
  createVectorIndexJob,
  getVectorEligibleAccounts,
  getVectorIndexJob,
  updateVectorIndexJob,
} from './db';
import { indexAccountResearchVectors } from './account-vectors';

const activeJobs = new Set<number>();

export function isVectorIndexJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

export function createAndStartVectorBackfillJob(accountIds?: number[]): { jobId: number; totalAccounts: number } {
  const totalAccounts = countVectorEligibleAccounts(accountIds);
  const jobId = createVectorIndexJob(totalAccounts);

  processVectorBackfillJob(jobId, accountIds).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Vector Backfill] Job ${jobId} failed:`, error);
    updateVectorIndexJob(jobId, {
      status: 'failed',
      current_account_id: null,
      current_account_name: null,
      error_message: message,
      completed_at: new Date().toISOString(),
    });
  });

  return { jobId, totalAccounts };
}

export async function processVectorBackfillJob(jobId: number, accountIds?: number[]): Promise<void> {
  if (activeJobs.has(jobId)) {
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getVectorIndexJob(jobId);
    if (!job) {
      throw new Error(`Vector index job ${jobId} not found.`);
    }

    if (job.status !== 'pending' && job.status !== 'processing') {
      return;
    }

    updateVectorIndexJob(jobId, {
      status: 'processing',
      error_message: null,
      completed_at: null,
    });

    const accounts = getVectorEligibleAccounts({ accountIds });
    let processedCount = 0;
    let failedCount = 0;

    for (const account of accounts) {
      updateVectorIndexJob(jobId, {
        current_account_id: account.id,
        current_account_name: account.company_name,
      });

      try {
        const result = await indexAccountResearchVectors(account);
        if (result.failed.length > 0) {
          failedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        console.error(`[Vector Backfill] Account ${account.id} failed:`, error);
      }

      processedCount += 1;
      updateVectorIndexJob(jobId, {
        processed_count: processedCount,
        failed_count: failedCount,
      });
    }

    updateVectorIndexJob(jobId, {
      status: 'completed',
      current_account_id: null,
      current_account_name: null,
      error_message: failedCount > 0 ? `${failedCount} account(s) failed to index.` : null,
      completed_at: new Date().toISOString(),
    });
  } finally {
    activeJobs.delete(jobId);
  }
}
