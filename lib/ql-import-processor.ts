import {
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
import { generateEmail } from './email-writer-agent';
import type { ParsedLead } from './ql-parser';

const activeJobs = new Set<number>();

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

export async function processQlImportJob(jobId: number, leads: ParsedLead[]): Promise<void> {
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
    let emailsHeldCustomer = 0;
    let emailsHeldOpp = 0;
    let processedCount = 0;
    const errorMessages: string[] = [];
    const touchedProspectIds: Array<{ id: number; status: string }> = [];

    for (const lead of leads) {
      const leadLabel = `${lead.firstName} ${lead.lastName} (${lead.company})`;

      try {
        // ── Phase 1: Account match/create ──
        updateQlImportJob(jobId, {
          current_step: `Matching account for ${lead.company}...`,
          processed_count: processedCount,
        });

        let account = findAccountByDomainOrName(null, lead.company);
        if (account) {
          accountsMatched++;
        } else {
          const accountId = createAccount(lead.company, null, 'Unknown', null, lead.auth0Owner);
          account = getAccount(accountId);
          if (!account) throw new Error(`Failed to create account for ${lead.company}`);
          accountsCreated++;
        }

        // ── Phase 2: Prospect create/dedup ──
        updateQlImportJob(jobId, {
          current_step: `Creating prospect ${leadLabel}...`,
          accounts_matched: accountsMatched,
          accounts_created: accountsCreated,
        });

        // Check SFDC ID dedup first
        if (lead.sfdcContactId) {
          const existingBySfdc = findProspectBySfdcId(lead.sfdcContactId);
          if (existingBySfdc) {
            touchedProspectIds.push({ id: existingBySfdc.id, status: 'skipped_dedup' });
            prospectsSkipped++;
            updateQlImportJob(jobId, { prospects_skipped: prospectsSkipped });
            processedCount++;
            updateQlImportJob(jobId, { processed_count: processedCount });
            continue;
          }
        }

        // Check email/name dedup
        const existing = findExistingProspectByEmailOrName(
          account.id,
          lead.email || undefined,
          lead.firstName,
          lead.lastName
        );

        let prospectId: number;
        if (existing) {
          // If duplicate exists but has no sfdc_id, update it
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

        // ── Phase 3: Classify & conditionally generate email ──
        if (account.research_status !== 'completed') {
          // No research data — hold email
          touchedProspectIds.push({ id: prospectId, status: 'no_research' });
          emailsSkipped++;
          updateQlImportJob(jobId, { emails_skipped: emailsSkipped });
        } else if (isCustomer(lead.accountStatus)) {
          // Existing customer — hold for manual decision
          touchedProspectIds.push({ id: prospectId, status: 'customer' });
          emailsHeldCustomer++;
          updateQlImportJob(jobId, { emails_held_customer: emailsHeldCustomer });
        } else if (hasActiveOpportunity(account.id)) {
          // Active opportunity — hold for manual decision
          touchedProspectIds.push({ id: prospectId, status: 'active_opp' });
          emailsHeldOpp++;
          updateQlImportJob(jobId, { emails_held_opp: emailsHeldOpp });
        } else {
          // Net-new/cold prospect — auto-generate email
          updateQlImportJob(jobId, {
            current_step: `Generating email for ${leadLabel}...`,
          });

          try {
            const contextParts: string[] = [];
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
            const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
            errorMessages.push(`[${leadLabel}] Email failed: ${errMsg}`);
            touchedProspectIds.push({ id: prospectId, status: 'no_research' });
          }

          // Small delay between email generations
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (leadErr) {
        const errMsg = leadErr instanceof Error ? leadErr.message : String(leadErr);
        errorMessages.push(`[${leadLabel}] ${errMsg}`);
      }

      processedCount++;
      updateQlImportJob(jobId, { processed_count: processedCount });
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
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`QL import job ${jobId} failed:`, errMsg);
    try {
      updateQlImportJob(jobId, {
        status: 'failed',
        error_log: `[FATAL] ${errMsg}`,
        completed_at: new Date().toISOString(),
      });
    } catch {
      // ignore db errors during error handling
    }
  } finally {
    activeJobs.delete(jobId);
  }
}
