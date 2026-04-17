/**
 * Generate Account Overviews (Best-Effort)
 *
 * Called automatically after an account completes research and categorization.
 * Generates both Auth0 and Okta overview drafts and POVs, saving results to DB.
 * All errors are caught and logged — overview generation never blocks account processing.
 */

import {
  getAccount,
  getAccountNotes,
  getProspectsByAccount,
  upsertAccountOverview,
  upsertAccountOktaOverview,
} from './db';
import { generateAccountOverviewDraft, generateAccountOverviewPov } from './account-overview-agent';
import { generateOktaAccountOverviewDraft, generateOktaAccountOverviewPov } from './okta-overview-agent';
import { logWorkerError } from './worker-error-utils';

export async function generateOverviewsBestEffort(accountId: number): Promise<void> {
  const account = getAccount(accountId);
  if (!account) return;

  const notes = getAccountNotes(accountId);
  const keyPeople = getProspectsByAccount(accountId);

  // ── Auth0 overview ──────────────────────────────────────────────────────────
  const hasAuth0Research = !!(account.research_summary || account.command_of_message);
  if (hasAuth0Research) {
    try {
      const draft = await generateAccountOverviewDraft({ account, notes, keyPeople });
      const now = new Date().toISOString();

      upsertAccountOverview(accountId, {
        priorities_json: JSON.stringify(draft.priorities),
        value_drivers_json: JSON.stringify(draft.valueDrivers),
        triggers_json: JSON.stringify(draft.triggers),
        business_model_markdown: draft.businessModelMarkdown,
        business_structure_json: JSON.stringify(draft.businessStructure),
        tech_stack_json: JSON.stringify(draft.techStack),
        generated_at: now,
      });

      console.log(`[Overview] ✓ Auth0 overview draft saved for account ${accountId}`);

      try {
        const pov = await generateAccountOverviewPov({ account, notes, keyPeople, overview: draft });
        upsertAccountOverview(accountId, {
          pov_markdown: pov,
          pov_generated_at: new Date().toISOString(),
        });
        console.log(`[Overview] ✓ Auth0 POV saved for account ${accountId}`);
      } catch (povError) {
        logWorkerError(`[Overview] Auth0 POV generation failed for account ${accountId} (${account.company_name})`, povError);
      }
    } catch (error) {
      logWorkerError(`[Overview] Auth0 overview generation failed for account ${accountId} (${account.company_name})`, error);
    }
  }

  // ── Okta overview ───────────────────────────────────────────────────────────
  const hasOktaResearch = !!(account.okta_research_summary || account.okta_current_iam_solution);
  if (hasOktaResearch) {
    try {
      const draft = await generateOktaAccountOverviewDraft({ account, notes, keyPeople });
      const now = new Date().toISOString();

      upsertAccountOktaOverview(accountId, {
        priorities_json: JSON.stringify(draft.priorities),
        value_drivers_json: JSON.stringify(draft.valueDrivers),
        triggers_json: JSON.stringify(draft.triggers),
        business_model_markdown: draft.businessModelMarkdown,
        business_structure_json: JSON.stringify(draft.businessStructure),
        tech_stack_json: JSON.stringify(draft.techStack),
        generated_at: now,
      });

      console.log(`[Overview] ✓ Okta WIC overview draft saved for account ${accountId}`);

      try {
        const pov = await generateOktaAccountOverviewPov({ account, notes, keyPeople, overview: draft });
        upsertAccountOktaOverview(accountId, {
          pov_markdown: pov,
          pov_generated_at: new Date().toISOString(),
        });
        console.log(`[Overview] ✓ Okta WIC POV saved for account ${accountId}`);
      } catch (povError) {
        logWorkerError(`[Overview] Okta WIC POV generation failed for account ${accountId} (${account.company_name})`, povError);
      }
    } catch (error) {
      logWorkerError(`[Overview] Okta WIC overview generation failed for account ${accountId} (${account.company_name})`, error);
    }
  }
}
