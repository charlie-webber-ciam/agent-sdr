import {
  type Account,
  getQlImportJob,
  updateQlImportJob,
  findAccountByDomainOrName,
  createAccount,
  findExistingProspectByEmailOrName,
  findProspectBySfdcId,
  createProspect,
  getAccount,
  createProspectEmail,
  updateProspect,
  getOpportunitiesByAccount,
} from './db';
import pLimit from 'p-limit';
import { processAccountWithRetry } from './account-worker';
import { generateEmail } from './email-writer-agent';
import type { ParsedLead } from './ql-parser';
import { logWorkerError, safeErrorCleanup, sleep } from './worker-error-utils';

const activeJobs = new Set<number>();

export interface QlImportAccountResolution {
  accountIdByCompanyKey: Record<string, number>;
  createdAccountIds?: number[];
}

export function isQlImportJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

// ── Classification helpers ──────────────────────────────────────────────────

function isCustomer(accountStatus: string | null | undefined): boolean {
  if (!accountStatus) return false;
  return accountStatus.toLowerCase().includes('customer');
}

function hasActiveOpportunity(accountId: number): boolean {
  const opps = getOpportunitiesByAccount(accountId);
  return opps.some(
    opp =>
      opp.stage !== null &&
      opp.stage !== 'Closed Won' &&
      opp.stage !== 'Closed Lost'
  );
}

interface LeadPlan {
  lead: ParsedLead;
  accountId: number;
}

export async function processQlImportJob(
  jobId: number,
  leads: ParsedLead[],
  accountResolution?: QlImportAccountResolution
): Promise<void> {
  if (activeJobs.has(jobId)) {
    console.log(`QL import job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getQlImportJob(jobId);
    if (!job) throw new Error(`QL import job ${jobId} not found`);
    if (job.status !== 'pending') {
      console.log(`QL import job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    updateQlImportJob(jobId, { status: 'processing', current_step: 'Starting...' });

    let accountsMatched = 0;
    let accountsCreated = 0;
    let prospectsCreated = 0;
    let prospectsSkipped = 0;
    let emailsGenerated = 0;
    let emailsSkipped = 0;
    const emailsHeldCustomer = 0;
    const emailsHeldOpp = 0;
    let processedCount = 0;
    const errorMessages: string[] = [];
    const touchedProspectIds: Array<{ id: number; status: string }> = [];
    const countedAccountIds = new Set<number>();
    const accountCache = new Map<number, Account>();
    const accountIdByCompanyKey = accountResolution?.accountIdByCompanyKey || {};
    const createdAccountIds = new Set<number>(accountResolution?.createdAccountIds || []);
    const leadPlans: LeadPlan[] = [];

    // ── Phase 1: Resolve accounts for all leads first ──
    for (const lead of leads) {
      const leadLabel = `${lead.firstName} ${lead.lastName} (${lead.company})`;
      try {
        updateQlImportJob(jobId, {
          current_step: `Matching account for ${lead.company}...`,
          processed_count: processedCount,
        });

        let account = resolveAccountForLead(lead, accountIdByCompanyKey);
        if (!account) {
          const accountId = createAccount(lead.company, null, 'Unknown', null, lead.auth0Owner);
          account = getAccount(accountId);
          if (!account) throw new Error(`Failed to create account for ${lead.company}`);
          createdAccountIds.add(account.id);
        }

        accountCache.set(account.id, account);
        leadPlans.push({ lead, accountId: account.id });

        if (!countedAccountIds.has(account.id)) {
          countedAccountIds.add(account.id);
          if (createdAccountIds.has(account.id)) {
            accountsCreated++;
          } else {
            accountsMatched++;
          }
        }
      } catch (leadErr) {
        const errMsg = logWorkerError(`QL import account match failed for ${leadLabel}`, leadErr);
        errorMessages.push(`[${leadLabel}] ${errMsg}`);
      }
    }

    updateQlImportJob(jobId, {
      accounts_matched: accountsMatched,
      accounts_created: accountsCreated,
    });

    const plansForResearchedAccounts: LeadPlan[] = [];
    const plansNeedingResearch: LeadPlan[] = [];

    for (const plan of leadPlans) {
      const account = accountCache.get(plan.accountId);
      if (account?.research_status === 'completed') {
        plansForResearchedAccounts.push(plan);
      } else {
        plansNeedingResearch.push(plan);
      }
    }

    const accountsQueuedForResearch = Array.from(countedAccountIds)
      .filter(accountId => createdAccountIds.has(accountId))
      .map(accountId => accountCache.get(accountId))
      .filter((account): account is Account => !!account && account.research_status !== 'completed');

    const researchQueuePromise =
      accountsQueuedForResearch.length > 0
        ? runBulkAccountResearch(
            jobId,
            accountsQueuedForResearch,
            accountCache,
            errorMessages
          )
        : Promise.resolve();

    // ── Phase 2: Process prospects on already researched accounts first ──
    for (const plan of plansForResearchedAccounts) {
      await processLeadPlan(plan);
    }

    // ── Phase 3: Wait for queue, then process remaining prospects ──
    if (plansNeedingResearch.length > 0) {
      updateQlImportJob(jobId, {
        current_step: `Waiting for account research queue (${accountsQueuedForResearch.length} account${accountsQueuedForResearch.length === 1 ? '' : 's'})...`,
      });
      await researchQueuePromise;
    }

    for (const plan of plansNeedingResearch) {
      await processLeadPlan(plan);
    }

    updateQlImportJob(jobId, {
      status: 'completed',
      current_step: null,
      error_log: errorMessages.length > 0 ? errorMessages.join('\n') : null,
      prospect_ids: JSON.stringify(touchedProspectIds),
      completed_at: new Date().toISOString(),
    });

    console.log(
      `QL import job ${jobId} completed. Accounts: ${accountsMatched} matched, ${accountsCreated} created. ` +
      `Prospects: ${prospectsCreated} created, ${prospectsSkipped} skipped. ` +
      `Emails: ${emailsGenerated} generated, ${emailsSkipped} skipped, ` +
      `${emailsHeldCustomer} held (customer), ${emailsHeldOpp} held (active opp).`
    );

    async function processLeadPlan(plan: LeadPlan): Promise<void> {
      const lead = plan.lead;
      const leadLabel = `${lead.firstName} ${lead.lastName} (${lead.company})`;

      try {
        let account = accountCache.get(plan.accountId) || getAccount(plan.accountId);
        if (!account) {
          throw new Error(`Account ${plan.accountId} not found while processing lead`);
        }
        accountCache.set(account.id, account);

        // ── Prospect create/dedup ──
        updateQlImportJob(jobId, {
          current_step: `Creating prospect ${leadLabel}...`,
          accounts_matched: accountsMatched,
          accounts_created: accountsCreated,
        });

        if (lead.sfdcContactId) {
          const existingBySfdc = findProspectBySfdcId(lead.sfdcContactId);
          if (existingBySfdc) {
            touchedProspectIds.push({ id: existingBySfdc.id, status: 'skipped_dedup' });
            prospectsSkipped++;
            updateQlImportJob(jobId, {
              prospects_skipped: prospectsSkipped,
            });
            return;
          }
        }

        const existing = findExistingProspectByEmailOrName(
          account.id,
          lead.email || undefined,
          lead.firstName,
          lead.lastName
        );

        let prospectId: number;
        if (existing) {
          if (!existing.sfdc_id && lead.sfdcContactId) {
            updateProspect(existing.id, {
              sfdc_id: lead.sfdcContactId,
              campaign_name: lead.campaignName || undefined,
              member_status: lead.memberStatus || undefined,
              account_status_sfdc: lead.accountStatus || undefined,
            });
          }
          prospectsSkipped++;
          prospectId = existing.id;
          touchedProspectIds.push({ id: prospectId, status: 'skipped_dedup' });
          updateQlImportJob(jobId, { prospects_skipped: prospectsSkipped });
        } else {
          const prospect = createProspect({
            account_id: account.id,
            first_name: lead.firstName,
            last_name: lead.lastName,
            title: lead.title || undefined,
            email: lead.email || undefined,
            phone: lead.phone || undefined,
            source: 'salesforce_import',
            lead_source: lead.campaignName || undefined,
            sfdc_id: lead.sfdcContactId || undefined,
            campaign_name: lead.campaignName || undefined,
            member_status: lead.memberStatus || undefined,
            account_status_sfdc: lead.accountStatus || undefined,
          });
          prospectsCreated++;
          prospectId = prospect.id;
          updateQlImportJob(jobId, { prospects_created: prospectsCreated });
        }

        // Refresh account after research queue completion if needed.
        const refreshedAccount = getAccount(account.id);
        if (refreshedAccount) {
          account = refreshedAccount;
          accountCache.set(account.id, account);
        }

        if (account.research_status !== 'completed') {
          touchedProspectIds.push({ id: prospectId, status: 'no_research' });
          emailsSkipped++;
          updateQlImportJob(jobId, { emails_skipped: emailsSkipped });
        } else {
          updateQlImportJob(jobId, {
            current_step: `Generating email for ${leadLabel}...`,
          });

          try {
            const contextParts: string[] = [];
            const customerAccount = isCustomer(lead.accountStatus);
            const activeOppAccount = hasActiveOpportunity(account.id);

            if (lead.campaignName) {
              contextParts.push(
                `This prospect was sourced from the "${lead.campaignName}" campaign (status: ${lead.memberStatus || 'unknown'}). Reference the campaign context in the email angle if relevant.`
              );
            }
            if (lead.accountStatus) {
              contextParts.push(
                `Account status in Salesforce: "${lead.accountStatus}".`
              );
            }
            if (customerAccount) {
              contextParts.push(
                'This is an existing customer account. Do not pitch as net-new. Write a concise cross-sell/expansion style outreach that acknowledges the existing relationship.'
              );
            }
            if (activeOppAccount) {
              contextParts.push(
                'There is an active open opportunity on this account. Keep outreach aligned and non-conflicting with an in-flight commercial process.'
              );
            }
            const customContext = contextParts.length > 0 ? contextParts.join(' ') : undefined;

            const emailResult = await generateEmail({
              recipientName: `${lead.firstName} ${lead.lastName}`,
              recipientPersona: lead.title || 'Unknown',
              emailType: 'cold',
              researchContext: 'auth0',
              customContext,
              accountData: account,
            });

            createProspectEmail({
              prospect_id: prospectId,
              account_id: account.id,
              subject: emailResult.subject,
              body: emailResult.body,
              reasoning: emailResult.reasoning,
              key_insights: JSON.stringify(emailResult.keyInsights),
              email_type: 'cold',
              research_context: 'auth0',
            });

            touchedProspectIds.push({ id: prospectId, status: 'emailed' });
            emailsGenerated++;
            updateQlImportJob(jobId, { emails_generated: emailsGenerated });
          } catch (emailErr) {
            const errMsg = logWorkerError(`QL import email generation failed for ${leadLabel}`, emailErr);
            errorMessages.push(`[${leadLabel}] Email failed: ${errMsg}`);
            touchedProspectIds.push({ id: prospectId, status: 'no_research' });
          }

          await sleep(500);
        }
      } catch (leadErr) {
        const errMsg = logWorkerError(`QL import failed for ${leadLabel}`, leadErr);
        errorMessages.push(`[${leadLabel}] ${errMsg}`);
      } finally {
        processedCount++;
        updateQlImportJob(jobId, { processed_count: processedCount });
      }
    }
  } catch (error) {
    const errMsg = logWorkerError(`QL import job ${jobId} failed`, error);
    safeErrorCleanup(`QL import job ${jobId}`, () => {
      updateQlImportJob(jobId, {
        status: 'failed',
        error_log: `[FATAL] ${errMsg}`,
        completed_at: new Date().toISOString(),
      });
    });
  } finally {
    activeJobs.delete(jobId);
  }
}

function resolveAccountForLead(
  lead: ParsedLead,
  accountIdByCompanyKey: Record<string, number>
): Account | undefined {
  const companyKey = normalizeCompanyKey(lead.company);
  const mappedId = accountIdByCompanyKey[companyKey];
  if (mappedId) {
    const mappedAccount = getAccount(mappedId);
    if (mappedAccount) return mappedAccount;
  }
  return findAccountByDomainOrName(null, lead.company);
}

function normalizeCompanyKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function runBulkAccountResearch(
  jobId: number,
  accounts: Account[],
  accountCache: Map<number, Account>,
  errorMessages: string[]
): Promise<void> {
  if (accounts.length === 0) return;

  const limit = pLimit(20);
  let completed = 0;

  await Promise.all(
    accounts.map(account =>
      limit(async () => {
        try {
          await processAccountWithRetry(account, 0, 'both');
        } catch (error) {
          const errMsg = logWorkerError(`QL import account research failed for ${account.company_name}`, error);
          errorMessages.push(`[${account.company_name}] Account research failed: ${errMsg}`);
        } finally {
          const refreshed = getAccount(account.id);
          if (refreshed) {
            accountCache.set(account.id, refreshed);
          }
          completed++;
          updateQlImportJob(jobId, {
            current_step: `Research queue: ${completed}/${accounts.length} account${accounts.length === 1 ? '' : 's'} complete...`,
          });
        }
      })
    )
  );
}
