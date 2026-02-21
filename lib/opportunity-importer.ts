import { parse } from 'csv-parse/sync';
import {
  Account,
  findAccountFuzzy,
  createOpportunityImportJob,
  getOpportunityImportJob,
  updateOpportunityImportJob,
  createSalesforceOpportunity,
  findExistingOpportunity,
  createProspect,
  linkOpportunityProspect,
  getProspectsByAccount,
  getDb,
} from './db';

// Column header alias map — maps CSV headers to internal field names
const HEADER_ALIASES: Record<string, string> = {
  'first name': 'first_name',
  'last name': 'last_name',
  'title': 'title',
  'phone': 'phone',
  'email': 'email',
  'mobile': 'mobile',
  'mobile phone': 'mobile',
  'mailing state/province': 'mailing_state',
  'account name': 'account_name',
  'opportunity name': 'opportunity_name',
  'stage': 'stage',
  'last stage change date': 'last_stage_change_date',
  'what is the business use case or pain?': 'business_use_case',
  'win/loss/qo description': 'win_loss_description',
  'why do anything?': 'why_do_anything',
  'why do it now?': 'why_do_it_now',
  'why do they need to solve this problem?': 'why_solve_problem',
  'why okta?': 'why_okta',
  'steps to close': 'steps_to_close',
  '[e] economic buyer': 'economic_buyer',
  '6. metrics': 'metrics',
  'metrics': 'metrics',
  '[d] decision process': 'decision_process',
  '[p] paper process': 'paper_process',
  'identify pain|before/neg consequences': 'identify_pain',
  'identify pain': 'identify_pain',
  'decision crit|req\'d capabilities/metrics': 'decision_criteria',
  'decision criteria': 'decision_criteria',
  '[c] champions': 'champions',
  '[c] champion title': 'champion_title',
  '[c] compelling event': 'compelling_event',
  '[c] competition': 'competition',
};

interface NormalizedRow {
  first_name: string;
  last_name: string;
  title: string;
  phone: string;
  mobile: string;
  email: string;
  mailing_state: string;
  account_name: string;
  opportunity_name: string;
  stage: string;
  last_stage_change_date: string;
  business_use_case: string;
  win_loss_description: string;
  why_do_anything: string;
  why_do_it_now: string;
  why_solve_problem: string;
  why_okta: string;
  steps_to_close: string;
  economic_buyer: string;
  metrics: string;
  decision_process: string;
  paper_process: string;
  identify_pain: string;
  decision_criteria: string;
  champions: string;
  champion_title: string;
  compelling_event: string;
  competition: string;
}

interface GroupedOpportunity {
  accountName: string;
  opportunityName: string;
  // Opportunity-level fields (taken from first row)
  stage: string;
  lastStageChangeDate: string;
  businessUseCase: string;
  winLossDescription: string;
  whyDoAnything: string;
  whyDoItNow: string;
  whySolveProblem: string;
  whyOkta: string;
  stepsToClose: string;
  economicBuyer: string;
  metrics: string;
  decisionProcess: string;
  paperProcess: string;
  identifyPain: string;
  decisionCriteria: string;
  champions: string;
  championTitle: string;
  compellingEvent: string;
  competition: string;
  // All contacts for this opportunity
  contacts: Array<{
    firstName: string;
    lastName: string;
    title: string;
    phone: string;
    mobile: string;
    email: string;
    mailingState: string;
  }>;
}

export interface AccountMatchResult {
  accountName: string;
  status: 'exact' | 'fuzzy_single' | 'ambiguous' | 'unmatched';
  matchedAccount?: Account;
  candidates?: Account[];
}

export interface ImportResult {
  jobId: number;
  totalRows: number;
  uniqueOpportunities: number;
  uniqueContacts: number;
  matchedAccounts: AccountMatchResult[];
  unmatchedAccounts: AccountMatchResult[];
  ambiguousAccounts: AccountMatchResult[];
  prospectsCreated: number;
  opportunitiesCreated: number;
  championsTagged: number;
}

function normalizeHeaders(row: Record<string, string>): NormalizedRow {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const key = HEADER_ALIASES[header.toLowerCase().trim()];
    if (key) {
      normalized[key] = (value || '').trim();
    }
  }
  return normalized as unknown as NormalizedRow;
}

function groupByOpportunity(rows: NormalizedRow[]): Map<string, GroupedOpportunity> {
  const grouped = new Map<string, GroupedOpportunity>();

  for (const row of rows) {
    const key = `${row.account_name}|||${row.opportunity_name}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        accountName: row.account_name,
        opportunityName: row.opportunity_name,
        stage: row.stage,
        lastStageChangeDate: row.last_stage_change_date,
        businessUseCase: row.business_use_case,
        winLossDescription: row.win_loss_description,
        whyDoAnything: row.why_do_anything,
        whyDoItNow: row.why_do_it_now,
        whySolveProblem: row.why_solve_problem,
        whyOkta: row.why_okta,
        stepsToClose: row.steps_to_close,
        economicBuyer: row.economic_buyer,
        metrics: row.metrics,
        decisionProcess: row.decision_process,
        paperProcess: row.paper_process,
        identifyPain: row.identify_pain,
        decisionCriteria: row.decision_criteria,
        champions: row.champions,
        championTitle: row.champion_title,
        compellingEvent: row.compelling_event,
        competition: row.competition,
        contacts: [],
      });
    }

    const opp = grouped.get(key)!;

    // Add contact if name exists
    if (row.first_name || row.last_name) {
      opp.contacts.push({
        firstName: row.first_name,
        lastName: row.last_name,
        title: row.title,
        phone: row.phone,
        mobile: row.mobile,
        email: row.email,
        mailingState: row.mailing_state,
      });
    }
  }

  return grouped;
}

function determineRoleType(
  contact: { firstName: string; lastName: string; title: string },
  opp: GroupedOpportunity
): 'champion' | 'decision_maker' | null {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim().toLowerCase();

  // Check if contact is named as champion
  if (opp.champions && fullName) {
    const championsLower = opp.champions.toLowerCase();
    if (championsLower.includes(fullName)) {
      return 'champion';
    }
  }

  // Check if contact's title matches champion title
  if (opp.championTitle && contact.title) {
    const championTitleLower = opp.championTitle.toLowerCase();
    const contactTitleLower = contact.title.toLowerCase();
    if (championTitleLower.includes(contactTitleLower) || contactTitleLower.includes(championTitleLower)) {
      return 'champion';
    }
  }

  // Check if contact is named as economic buyer
  if (opp.economicBuyer && fullName) {
    const ebLower = opp.economicBuyer.toLowerCase();
    if (ebLower.includes(fullName)) {
      return 'decision_maker';
    }
  }

  return null;
}

export async function importOpportunityCSV(csvContent: string, filename: string): Promise<ImportResult> {
  // Step 1: Parse CSV
  const rawRows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows = rawRows.map(normalizeHeaders);

  // Step 2: Group by opportunity (deduplicate)
  const opportunities = groupByOpportunity(rows);

  // Collect unique account names
  const uniqueAccountNames = new Set<string>();
  for (const opp of opportunities.values()) {
    if (opp.accountName) {
      uniqueAccountNames.add(opp.accountName);
    }
  }

  // Collect unique contacts
  const uniqueContactKeys = new Set<string>();
  for (const opp of opportunities.values()) {
    for (const c of opp.contacts) {
      uniqueContactKeys.add(`${c.email || ''}|||${c.firstName}|||${c.lastName}`);
    }
  }

  // Create import job
  const jobId = createOpportunityImportJob(filename);
  updateOpportunityImportJob(jobId, {
    total_rows: rows.length,
    unique_opportunities: opportunities.size,
    unique_contacts: uniqueContactKeys.size,
    status: 'processing',
  });

  // Step 3: Match accounts
  const accountMatches = new Map<string, AccountMatchResult>();
  for (const accountName of uniqueAccountNames) {
    const result = findAccountFuzzy(accountName);

    if (result.exact) {
      accountMatches.set(accountName, {
        accountName,
        status: 'exact',
        matchedAccount: result.exact,
      });
    } else if (result.fuzzy.length === 1) {
      accountMatches.set(accountName, {
        accountName,
        status: 'fuzzy_single',
        matchedAccount: result.fuzzy[0],
      });
    } else if (result.fuzzy.length > 1) {
      accountMatches.set(accountName, {
        accountName,
        status: 'ambiguous',
        candidates: result.fuzzy,
      });
    } else {
      accountMatches.set(accountName, {
        accountName,
        status: 'unmatched',
      });
    }
  }

  // Step 4: Import matched opportunities and contacts
  let prospectsCreated = 0;
  let opportunitiesCreated = 0;
  let championsTagged = 0;

  const matchedResults: AccountMatchResult[] = [];
  const unmatchedResults: AccountMatchResult[] = [];
  const ambiguousResults: AccountMatchResult[] = [];

  for (const match of accountMatches.values()) {
    if (match.status === 'ambiguous') {
      ambiguousResults.push(match);
      continue;
    }
    if (match.status === 'unmatched') {
      unmatchedResults.push(match);
      continue;
    }

    matchedResults.push(match);
    const account = match.matchedAccount!;

    // Get existing prospects for deduplication
    const existingProspects = getProspectsByAccount(account.id);

    // Process each opportunity for this account
    for (const [, opp] of opportunities) {
      if (opp.accountName !== match.accountName) continue;

      // Skip if opportunity already exists
      if (findExistingOpportunity(account.id, opp.opportunityName)) {
        continue;
      }

      // Create opportunity
      const oppId = createSalesforceOpportunity({
        account_id: account.id,
        import_job_id: jobId,
        opportunity_name: opp.opportunityName,
        stage: opp.stage,
        last_stage_change_date: opp.lastStageChangeDate,
        business_use_case: opp.businessUseCase,
        win_loss_description: opp.winLossDescription,
        why_do_anything: opp.whyDoAnything,
        why_do_it_now: opp.whyDoItNow,
        why_solve_problem: opp.whySolveProblem,
        why_okta: opp.whyOkta,
        steps_to_close: opp.stepsToClose,
        economic_buyer: opp.economicBuyer,
        metrics: opp.metrics,
        decision_process: opp.decisionProcess,
        paper_process: opp.paperProcess,
        identify_pain: opp.identifyPain,
        decision_criteria: opp.decisionCriteria,
        champions: opp.champions,
        champion_title: opp.championTitle,
        compelling_event: opp.compellingEvent,
        competition: opp.competition,
      });
      opportunitiesCreated++;

      // Import contacts as prospects
      for (const contact of opp.contacts) {
        if (!contact.firstName && !contact.lastName) continue;

        // Deduplicate: check by email first, then by name
        let existingProspect = existingProspects.find(p => {
          if (contact.email && p.email) {
            return p.email.toLowerCase() === contact.email.toLowerCase();
          }
          return (
            p.first_name.toLowerCase() === contact.firstName.toLowerCase() &&
            p.last_name.toLowerCase() === contact.lastName.toLowerCase()
          );
        });

        const roleType = determineRoleType(contact, opp);

        if (!existingProspect) {
          // Create new prospect
          const newProspect = createProspect({
            account_id: account.id,
            first_name: contact.firstName,
            last_name: contact.lastName,
            title: contact.title || undefined,
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            mobile: contact.mobile || undefined,
            mailing_address: contact.mailingState || undefined,
            source: 'salesforce_import',
            role_type: roleType || undefined,
          });

          existingProspect = newProspect;
          existingProspects.push(existingProspect);
          prospectsCreated++;

          if (roleType === 'champion') {
            championsTagged++;
          }
        }

        // Link prospect to opportunity
        linkOpportunityProspect(oppId, existingProspect.id);
      }
    }
  }

  // Update job with final counts
  const matchedCount = matchedResults.length;
  const unmatchedCount = unmatchedResults.length + ambiguousResults.length;

  updateOpportunityImportJob(jobId, {
    matched_accounts: matchedCount,
    unmatched_accounts: unmatchedCount,
    prospects_created: prospectsCreated,
    opportunities_created: opportunitiesCreated,
    champions_tagged: championsTagged,
    status: ambiguousResults.length > 0 ? 'pending_resolution' : 'completed',
    completed_at: ambiguousResults.length > 0 ? undefined : new Date().toISOString(),
  });

  return {
    jobId,
    totalRows: rows.length,
    uniqueOpportunities: opportunities.size,
    uniqueContacts: uniqueContactKeys.size,
    matchedAccounts: matchedResults,
    unmatchedAccounts: unmatchedResults,
    ambiguousAccounts: ambiguousResults,
    prospectsCreated,
    opportunitiesCreated,
    championsTagged,
  };
}

/**
 * Resolve ambiguous account matches and import their opportunities/contacts
 */
export function resolveAmbiguousMatches(
  jobId: number,
  resolutions: Array<{ accountName: string; selectedAccountId: number }>,
  csvContent: string
): { prospectsCreated: number; opportunitiesCreated: number; championsTagged: number } {
  // Re-parse the CSV to get opportunity data
  const rawRows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows = rawRows.map(normalizeHeaders);
  const opportunities = groupByOpportunity(rows);

  let prospectsCreated = 0;
  let opportunitiesCreated = 0;
  let championsTagged = 0;

  for (const resolution of resolutions) {
    const accountId = resolution.selectedAccountId;
    const existingProspects = getProspectsByAccount(accountId);

    for (const [, opp] of opportunities) {
      if (opp.accountName !== resolution.accountName) continue;

      if (findExistingOpportunity(accountId, opp.opportunityName)) {
        continue;
      }

      const oppId = createSalesforceOpportunity({
        account_id: accountId,
        import_job_id: jobId,
        opportunity_name: opp.opportunityName,
        stage: opp.stage,
        last_stage_change_date: opp.lastStageChangeDate,
        business_use_case: opp.businessUseCase,
        win_loss_description: opp.winLossDescription,
        why_do_anything: opp.whyDoAnything,
        why_do_it_now: opp.whyDoItNow,
        why_solve_problem: opp.whySolveProblem,
        why_okta: opp.whyOkta,
        steps_to_close: opp.stepsToClose,
        economic_buyer: opp.economicBuyer,
        metrics: opp.metrics,
        decision_process: opp.decisionProcess,
        paper_process: opp.paperProcess,
        identify_pain: opp.identifyPain,
        decision_criteria: opp.decisionCriteria,
        champions: opp.champions,
        champion_title: opp.championTitle,
        compelling_event: opp.compellingEvent,
        competition: opp.competition,
      });
      opportunitiesCreated++;

      for (const contact of opp.contacts) {
        if (!contact.firstName && !contact.lastName) continue;

        let existingProspect = existingProspects.find(p => {
          if (contact.email && p.email) {
            return p.email.toLowerCase() === contact.email.toLowerCase();
          }
          return (
            p.first_name.toLowerCase() === contact.firstName.toLowerCase() &&
            p.last_name.toLowerCase() === contact.lastName.toLowerCase()
          );
        });

        const roleType = determineRoleType(contact, opp);

        if (!existingProspect) {
          const newProspect = createProspect({
            account_id: accountId,
            first_name: contact.firstName,
            last_name: contact.lastName,
            title: contact.title || undefined,
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            mobile: contact.mobile || undefined,
            mailing_address: contact.mailingState || undefined,
            source: 'salesforce_import',
            role_type: roleType || undefined,
          });

          existingProspect = newProspect;
          existingProspects.push(existingProspect);
          prospectsCreated++;

          if (roleType === 'champion') {
            championsTagged++;
          }
        }

        linkOpportunityProspect(oppId, existingProspect.id);
      }
    }
  }

  // Update job
  const job = getOpportunityImportJob(jobId);
  if (job) {
    updateOpportunityImportJob(jobId, {
      matched_accounts: (job.matched_accounts || 0) + resolutions.length,
      unmatched_accounts: Math.max(0, (job.unmatched_accounts || 0) - resolutions.length),
      prospects_created: (job.prospects_created || 0) + prospectsCreated,
      opportunities_created: (job.opportunities_created || 0) + opportunitiesCreated,
      champions_tagged: (job.champions_tagged || 0) + championsTagged,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  }

  return { prospectsCreated, opportunitiesCreated, championsTagged };
}

// ─── Feature 3: Create accounts for unmatched opportunity import rows ────────

export interface CreateAccountsResult {
  accountsCreated: number;
  prospectsCreated: number;
  opportunitiesCreated: number;
  championsTagged: number;
  createdAccounts: Array<{ id: number; company_name: string }>;
}

/**
 * Create minimal account records for unmatched CSV account names,
 * then import their opportunities and contacts.
 */
export function createAccountsFromUnmatched(
  jobId: number,
  accountNames: string[],
  csvContent: string
): CreateAccountsResult {
  const db = getDb();

  // Re-parse the CSV to get opportunity data
  const rawRows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows = rawRows.map(normalizeHeaders);
  const opportunities = groupByOpportunity(rows);

  let prospectsCreated = 0;
  let opportunitiesCreated = 0;
  let championsTagged = 0;
  const createdAccounts: Array<{ id: number; company_name: string }> = [];

  const now = Date.now();

  for (let i = 0; i < accountNames.length; i++) {
    const name = accountNames[i];
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const domain = `no-domain-${sanitized}-${now}-${i}.placeholder`;

    // Create minimal account with NULL job_id
    const insertResult = db.prepare(`
      INSERT INTO accounts (company_name, domain, industry, job_id)
      VALUES (?, ?, 'Unknown', NULL)
    `).run(name, domain);
    const accountId = insertResult.lastInsertRowid as number;
    createdAccounts.push({ id: accountId, company_name: name });

    const existingProspects: any[] = [];

    // Import opportunities and contacts for this account
    for (const [, opp] of opportunities) {
      if (opp.accountName !== name) continue;

      if (findExistingOpportunity(accountId, opp.opportunityName)) continue;

      const oppId = createSalesforceOpportunity({
        account_id: accountId,
        import_job_id: jobId,
        opportunity_name: opp.opportunityName,
        stage: opp.stage,
        last_stage_change_date: opp.lastStageChangeDate,
        business_use_case: opp.businessUseCase,
        win_loss_description: opp.winLossDescription,
        why_do_anything: opp.whyDoAnything,
        why_do_it_now: opp.whyDoItNow,
        why_solve_problem: opp.whySolveProblem,
        why_okta: opp.whyOkta,
        steps_to_close: opp.stepsToClose,
        economic_buyer: opp.economicBuyer,
        metrics: opp.metrics,
        decision_process: opp.decisionProcess,
        paper_process: opp.paperProcess,
        identify_pain: opp.identifyPain,
        decision_criteria: opp.decisionCriteria,
        champions: opp.champions,
        champion_title: opp.championTitle,
        compelling_event: opp.compellingEvent,
        competition: opp.competition,
      });
      opportunitiesCreated++;

      for (const contact of opp.contacts) {
        if (!contact.firstName && !contact.lastName) continue;

        let existingProspect = existingProspects.find((p: any) => {
          if (contact.email && p.email) {
            return p.email.toLowerCase() === contact.email.toLowerCase();
          }
          return (
            p.first_name.toLowerCase() === contact.firstName.toLowerCase() &&
            p.last_name.toLowerCase() === contact.lastName.toLowerCase()
          );
        });

        const roleType = determineRoleType(contact, opp);

        if (!existingProspect) {
          const newProspect = createProspect({
            account_id: accountId,
            first_name: contact.firstName,
            last_name: contact.lastName,
            title: contact.title || undefined,
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            mobile: contact.mobile || undefined,
            mailing_address: contact.mailingState || undefined,
            source: 'salesforce_import',
            role_type: roleType || undefined,
          });
          existingProspect = newProspect;
          existingProspects.push(existingProspect);
          prospectsCreated++;
          if (roleType === 'champion') championsTagged++;
        }

        linkOpportunityProspect(oppId, existingProspect.id);
      }
    }
  }

  // Update job stats
  const job = getOpportunityImportJob(jobId);
  if (job) {
    updateOpportunityImportJob(jobId, {
      matched_accounts: (job.matched_accounts || 0) + accountNames.length,
      unmatched_accounts: Math.max(0, (job.unmatched_accounts || 0) - accountNames.length),
      prospects_created: (job.prospects_created || 0) + prospectsCreated,
      opportunities_created: (job.opportunities_created || 0) + opportunitiesCreated,
      champions_tagged: (job.champions_tagged || 0) + championsTagged,
    });
  }

  return { accountsCreated: accountNames.length, prospectsCreated, opportunitiesCreated, championsTagged, createdAccounts };
}

// Re-export for convenience
export { getOpportunityImportJob };
