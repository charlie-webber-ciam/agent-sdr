/**
 * Bulk Email Processor
 *
 * Two-stage pipeline for generating prospect emails at scale:
 *   Stage 1: Generate missing account overviews (slower, p-limit 5)
 *   Stage 2: Generate emails for each prospect (faster, p-limit 10)
 *
 * Follows the enrichment-processor.ts pattern for concurrency and progress tracking.
 */

import pLimit from 'p-limit';
import {
  getBulkEmailJob,
  updateBulkEmailJobStatus,
  updateBulkEmailJobProgress,
  createProspectEmailWithJob,
  getAccount,
  getAccountOverview,
  getAccountNotes,
  getProspectsByAccount,
  getProspect,
  upsertAccountOverview,
  getProspectIdsWithExistingEmails,
} from './db';
import type { Prospect } from './db';
import { generateEmail } from './email-writer-agent';
import { generateAccountOverviewDraft } from './account-overview-agent';
import { buildOverviewRecordFromStorage, hasMeaningfulOverviewContent } from './account-overview';
import { logWorkerError, sleep } from './worker-error-utils';

const OVERVIEW_CONCURRENCY = 5;
const EMAIL_CONCURRENCY = 10;
const BATCH_DELAY_MS = 300;
const STALE_JOB_THRESHOLD_MS = 6 * 60 * 60 * 1000;

const KEY_PERSON_ROLES = new Set(['decision_maker', 'champion', 'influencer', 'blocker']);
const SENIOR_TITLE_PATTERN = /\b(chief|ceo|cfo|cmo|ciso|cto|cio|coo|founder|president|managing director|general manager|vp|vice president|head|director)\b/i;

const activeJobs = new Map<number, number>();

export function isBulkEmailJobActive(jobId: number): boolean {
  const startTime = activeJobs.get(jobId);
  if (startTime === undefined) return false;
  if (Date.now() - startTime > STALE_JOB_THRESHOLD_MS) {
    console.warn(`Clearing stale bulk email activeJobs entry for job ${jobId}`);
    activeJobs.delete(jobId);
    return false;
  }
  return true;
}

export async function processBulkEmailJob(jobId: number): Promise<void> {
  if (isBulkEmailJobActive(jobId)) {
    console.log(`Bulk email job ${jobId} is already being processed`);
    return;
  }

  activeJobs.set(jobId, Date.now());

  try {
    const job = getBulkEmailJob(jobId);
    if (!job) throw new Error(`Bulk email job ${jobId} not found`);
    if (job.status !== 'pending') {
      console.log(`Bulk email job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    const prospectIds: number[] = JSON.parse(job.prospect_ids_json);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting BULK EMAIL generation (Job ${jobId})`);
    console.log(`  Total prospects: ${prospectIds.length}`);
    console.log(`  Email type: ${job.email_type}`);
    console.log(`  Research context: ${job.research_context}`);
    console.log(`${'='.repeat(60)}\n`);

    // ── Build prospect-to-account mapping ──
    const prospectMap = new Map<number, { prospect: Prospect; accountId: number }>();
    const accountIds = new Set<number>();

    for (const pid of prospectIds) {
      const prospect = getProspect(pid);
      if (!prospect) {
        console.warn(`  Prospect ${pid} not found, skipping`);
        continue;
      }
      prospectMap.set(pid, { prospect, accountId: prospect.account_id });
      accountIds.add(prospect.account_id);
    }

    // ── Stage 1: Generate missing overviews ──
    updateBulkEmailJobStatus(jobId, 'generating_overviews', 'overviews');

    const accountsNeedingOverview: number[] = [];
    for (const accountId of accountIds) {
      const account = getAccount(accountId);
      if (!account || account.research_status !== 'completed') continue;
      const existing = buildOverviewRecordFromStorage(getAccountOverview(accountId));
      if (!hasMeaningfulOverviewContent(existing)) {
        accountsNeedingOverview.push(accountId);
      }
    }

    console.log(`\nStage 1: ${accountsNeedingOverview.length} accounts need overview generation`);
    let overviewsGenerated = 0;
    let overviewsFailed = 0;

    if (accountsNeedingOverview.length > 0) {
      const overviewLimit = pLimit(OVERVIEW_CONCURRENCY);
      const chunkSize = OVERVIEW_CONCURRENCY * 2;

      for (let i = 0; i < accountsNeedingOverview.length; i += chunkSize) {
        // Check cancellation
        const currentJob = getBulkEmailJob(jobId);
        if (currentJob?.status === 'failed') {
          console.log(`\nBulk email job ${jobId} was cancelled`);
          return;
        }

        const chunk = accountsNeedingOverview.slice(i, i + chunkSize);
        const promises = chunk.map((accountId) =>
          overviewLimit(async () => {
            try {
              const account = getAccount(accountId);
              if (!account) throw new Error('Account not found');

              const notes = getAccountNotes(accountId);
              const keyPeople = getProspectsByAccount(accountId).filter((p) =>
                KEY_PERSON_ROLES.has(p.role_type || '') || SENIOR_TITLE_PATTERN.test(p.title || '')
              );

              const overview = await generateAccountOverviewDraft({ account, notes, keyPeople });
              const generatedAt = new Date().toISOString();
              upsertAccountOverview(accountId, {
                priorities_json: JSON.stringify(overview.priorities),
                value_drivers_json: JSON.stringify(overview.valueDrivers),
                triggers_json: JSON.stringify(overview.triggers),
                business_model_markdown: overview.businessModelMarkdown,
                business_structure_json: JSON.stringify(overview.businessStructure),
                tech_stack_json: JSON.stringify(overview.techStack),
                generated_at: generatedAt,
                last_edited_at: generatedAt,
              });

              overviewsGenerated++;
              console.log(`  [Overview] ${account.company_name} - generated`);
            } catch (error) {
              overviewsFailed++;
              logWorkerError(`[Overview] Account ${accountId}`, error);
            }
          })
        );

        await Promise.allSettled(promises);
        updateBulkEmailJobProgress(jobId, {
          overviews_generated: overviewsGenerated,
          overviews_failed: overviewsFailed,
        });

        if (i + chunkSize < accountsNeedingOverview.length) {
          await sleep(BATCH_DELAY_MS);
        }
      }
    }

    console.log(`\nStage 1 complete: ${overviewsGenerated} generated, ${overviewsFailed} failed`);

    // ── Stage 2: Generate emails ──
    updateBulkEmailJobStatus(jobId, 'generating_emails', 'emails');

    // Deduplicate: skip prospects that already have an email for this research context
    const allProspectIds = Array.from(prospectMap.keys());
    const existingEmailIds = getProspectIdsWithExistingEmails(allProspectIds, job.research_context);
    let emailsSkipped = 0;

    if (existingEmailIds.size > 0) {
      console.log(`  Skipping ${existingEmailIds.size} prospects with existing ${job.research_context} emails`);
      emailsSkipped = existingEmailIds.size;
    }

    let emailsGenerated = 0;
    let emailsFailed = 0;
    const emailLimit = pLimit(EMAIL_CONCURRENCY);
    const emailChunkSize = EMAIL_CONCURRENCY * 2;

    const prospectEntries = Array.from(prospectMap.entries()).filter(
      ([pid]) => !existingEmailIds.has(pid)
    );

    for (let i = 0; i < prospectEntries.length; i += emailChunkSize) {
      // Check cancellation
      const currentJob = getBulkEmailJob(jobId);
      if (currentJob?.status === 'failed') {
        console.log(`\nBulk email job ${jobId} was cancelled`);
        return;
      }

      const chunk = prospectEntries.slice(i, i + emailChunkSize);
      const promises = chunk.map(([prospectId, { prospect, accountId }]) =>
        emailLimit(async () => {
          try {
            updateBulkEmailJobStatus(jobId, 'generating_emails', 'emails', prospectId);

            const account = getAccount(accountId);
            if (!account) throw new Error('Account not found');
            if (account.research_status !== 'completed') {
              console.log(`  [Email] Skipping ${prospect.first_name} ${prospect.last_name} - research not completed`);
              emailsFailed++;
              return;
            }

            const overview = buildOverviewRecordFromStorage(getAccountOverview(accountId));
            const notes = getAccountNotes(accountId);

            const recipientName = `${prospect.first_name} ${prospect.last_name}`;
            const recipientPersona = prospect.title || (prospect.role_type ? prospect.role_type.replace(/_/g, ' ') : 'Contact');

            const emailResult = await generateEmail({
              recipientName,
              recipientPersona,
              emailType: job.email_type as 'cold' | 'warm',
              researchContext: job.research_context as 'auth0' | 'okta',
              customInstructions: job.custom_instructions || undefined,
              accountData: account,
              overview: hasMeaningfulOverviewContent(overview) ? overview : null,
              notes: notes.map((n) => ({ content: n.content, createdAt: n.created_at })),
            });

            createProspectEmailWithJob({
              prospect_id: prospectId,
              account_id: accountId,
              subject: emailResult.subject,
              body: emailResult.body,
              reasoning: emailResult.reasoning,
              key_insights: JSON.stringify(emailResult.keyInsights),
              email_type: job.email_type,
              research_context: job.research_context,
              bulk_job_id: jobId,
            });

            emailsGenerated++;
            console.log(`  [Email] ${recipientName} @ ${account.company_name} - generated`);
          } catch (error) {
            emailsFailed++;
            logWorkerError(`[Email] Prospect ${prospectId}`, error);
          }
        })
      );

      await Promise.allSettled(promises);
      updateBulkEmailJobProgress(jobId, {
        emails_generated: emailsGenerated,
        emails_failed: emailsFailed,
      });

      if (i + emailChunkSize < prospectEntries.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    updateBulkEmailJobStatus(jobId, 'completed');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Bulk email job ${jobId} completed`);
    console.log(`  Overviews: ${overviewsGenerated} generated, ${overviewsFailed} failed`);
    console.log(`  Emails: ${emailsGenerated} generated, ${emailsFailed} failed, ${emailsSkipped} skipped (already had email)`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    logWorkerError(`Bulk email job ${jobId} failed`, error);
    try {
      updateBulkEmailJobStatus(jobId, 'failed');
    } catch {
      // ignore
    }
  } finally {
    activeJobs.delete(jobId);
  }
}
