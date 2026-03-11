import {
  getAccount,
  getAccountWorkingJob,
  updateAccountWorkingJob,
  findExistingProspectByEmailOrName,
  createProspect,
  createProspectEmail,
  updateProspectAIData,
  getProspect,
} from './db';
import { mapAccountProspects } from './prospect-mapper-agent';
import { generateEmail } from './email-writer-agent';
import { assessContactReadiness } from './prospect-contact-readiness';
import { buildWeightedOpportunityContext } from './opportunity-context';
import { logWorkerError, safeErrorCleanup, sleep } from './worker-error-utils';

const activeJobs = new Set<number>();

export function isAccountWorkingJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

export async function processAccountWorkingJob(jobId: number): Promise<void> {
  if (activeJobs.has(jobId)) {
    console.log(`Account working job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getAccountWorkingJob(jobId);
    if (!job) throw new Error(`Account working job ${jobId} not found`);
    if (job.status !== 'pending') {
      console.log(`Account working job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    const account = getAccount(job.account_id);
    if (!account) throw new Error(`Account ${job.account_id} not found`);

    // ── Phase 1: Mapping ──
    updateAccountWorkingJob(jobId, {
      status: 'mapping',
      current_step: `Searching for prospects at ${account.company_name}...`,
    });

    const opportunityContext = buildWeightedOpportunityContext(account.id);

    const researchContext = job.research_context || 'auth0';
    const researchSummary = researchContext === 'okta'
      ? account.okta_research_summary
      : account.research_summary;

    let mapResult;
    try {
      mapResult = await mapAccountProspects(
        account.company_name,
        account.domain,
        account.industry,
        job.user_context,
        opportunityContext,
        researchSummary
      );
    } catch (error) {
      const errMsg = logWorkerError(`Account working job ${jobId} mapping failed`, error);
      updateAccountWorkingJob(jobId, {
        status: 'failed',
        error_log: `Mapping failed: ${errMsg}`,
        completed_at: new Date().toISOString(),
      });
      return;
    }

    console.log(`[WorkingJob ${jobId}] Prospect mapping returned ${mapResult.prospects.length} prospects. Notes: ${mapResult.search_notes}`);

    const prospectsFound = mapResult.prospects.length;
    let prospectsCreated = 0;
    let prospectsSkipped = 0;
    const createdProspectIds: number[] = [];

    if (prospectsFound === 0) {
      updateAccountWorkingJob(jobId, {
        prospects_found: 0,
        status: 'completed',
        current_step: null,
        error_log: `No prospects found. Agent notes: ${mapResult.search_notes}`,
        completed_at: new Date().toISOString(),
      });
      return;
    }

    updateAccountWorkingJob(jobId, {
      prospects_found: prospectsFound,
      current_step: `Found ${prospectsFound} prospects, deduplicating...`,
    });

    for (const mapped of mapResult.prospects) {
      const existing = findExistingProspectByEmailOrName(
        account.id,
        undefined,
        mapped.first_name,
        mapped.last_name
      );

      if (existing) {
        prospectsSkipped++;
        updateAccountWorkingJob(jobId, {
          prospects_skipped: prospectsSkipped,
          current_step: `Skipped ${mapped.first_name} ${mapped.last_name} (already exists)`,
        });
        continue;
      }

      const prospect = createProspect({
        account_id: account.id,
        first_name: mapped.first_name,
        last_name: mapped.last_name,
        title: mapped.title,
        department: mapped.department,
        linkedin_url: mapped.linkedin_url || undefined,
        role_type: mapped.role_type,
        relationship_status: 'new',
        source: 'ai_research',
        description: mapped.relevance_reason,
      });

      // Set seniority_level and contact readiness via AI data update
      try {
        const readiness = assessContactReadiness(prospect);
        updateProspectAIData(prospect.id, {
          seniority_level: mapped.seniority_level,
          contact_readiness: readiness,
        });
      } catch (error) {
        logWorkerError(
          `Account working job ${jobId} failed to score readiness for prospect ${mapped.first_name} ${mapped.last_name}`,
          error
        );
      }

      createdProspectIds.push(prospect.id);
      prospectsCreated++;

      updateAccountWorkingJob(jobId, {
        prospects_created: prospectsCreated,
        current_step: `Created prospect: ${mapped.first_name} ${mapped.last_name}`,
      });
    }

    // ── Phase 2: Email Generation ──
    updateAccountWorkingJob(jobId, {
      status: 'generating',
      current_step: `Generating emails for ${prospectsCreated} prospects...`,
    });

    let emailsGenerated = 0;
    let emailsFailed = 0;
    const errorMessages: string[] = [];

    for (const prospectId of createdProspectIds) {
      const prospect = getProspect(prospectId);
      if (!prospect) continue;

      const prospectName = `${prospect.first_name} ${prospect.last_name}`;

      updateAccountWorkingJob(jobId, {
        current_step: `Writing email for ${prospectName}...`,
      });

      try {
        const emailResult = await generateEmail({
          recipientName: prospectName,
          recipientPersona: prospect.title || 'Unknown',
          emailType: 'cold',
          researchContext: (researchContext === 'okta' ? 'okta' : 'auth0') as 'auth0' | 'okta',
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
          research_context: researchContext,
        });

        emailsGenerated++;
        updateAccountWorkingJob(jobId, {
          emails_generated: emailsGenerated,
          current_step: `Email generated for ${prospectName} (${emailsGenerated}/${createdProspectIds.length})`,
        });
      } catch (error) {
        const errMsg = logWorkerError(`Failed to generate email for ${prospectName}`, error);
        emailsFailed++;
        errorMessages.push(`[${prospectName}] ${errMsg}`);
        updateAccountWorkingJob(jobId, {
          emails_failed: emailsFailed,
          current_step: `Email failed for ${prospectName}, continuing...`,
        });
      }

      // Small delay between email generations to avoid rate limiting
      await sleep(500);
    }

    updateAccountWorkingJob(jobId, {
      status: 'completed',
      current_step: null,
      error_log: errorMessages.length > 0 ? errorMessages.join('\n') : null,
      completed_at: new Date().toISOString(),
    });

    console.log(`Account working job ${jobId} completed. Prospects: ${prospectsCreated} created, ${prospectsSkipped} skipped. Emails: ${emailsGenerated} generated, ${emailsFailed} failed.`);
  } catch (error) {
    const errMsg = logWorkerError(`Account working job ${jobId} failed`, error);
    safeErrorCleanup(`Account working job ${jobId}`, () => {
      updateAccountWorkingJob(jobId, {
        status: 'failed',
        error_log: `[FATAL] ${errMsg}`,
        completed_at: new Date().toISOString(),
      });
    });
  } finally {
    activeJobs.delete(jobId);
  }
}
