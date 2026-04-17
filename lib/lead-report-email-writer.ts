import {
  createProspect,
  createProspectEmail,
  findAccountByDomainOrName,
  findAccountFuzzy,
  findExistingProspectByEmailOrName,
  getAccount,
  getProspect,
  updateProspect,
  type Account,
  type Prospect,
} from './db';
import { generateEmail } from './email-writer-agent';
import { parseQlText, type ParsedLead } from './ql-parser';
import { parseQlTextWithLlm } from './ql-llm-parser';
import {
  generateStandaloneSingleEmail,
  researchCompanyBrief,
} from './standalone-email-writer';
import {
  leadReportGenerateResponseSchema,
  type LeadReportGenerateResponse,
  type LeadReportLead,
} from './lead-report-email-writer-schema';

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.com.au',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'protonmail.com',
]);

function countEmailLikeEntries(rawText: string): number {
  const matches = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return matches?.length || 0;
}

function shouldUseLlmParserForLeadReport(rawText: string, deterministicLeads: ParsedLead[]): boolean {
  if (deterministicLeads.length === 0) return true;

  const emailLikeCount = countEmailLikeEntries(rawText);
  if (emailLikeCount >= 8 && deterministicLeads.length < Math.floor(emailLikeCount * 0.7)) {
    return true;
  }

  const weakTitles = deterministicLeads.filter((lead) => !lead.title || lead.title === '-' || lead.title === 'Unknown').length;
  const weakLastNames = deterministicLeads.filter((lead) => !lead.lastName || lead.lastName === '-' || /^unknown/i.test(lead.lastName)).length;

  return (
    deterministicLeads.length >= 5 &&
    weakTitles / deterministicLeads.length > 0.4 &&
    weakLastNames / deterministicLeads.length > 0.25
  );
}

function normalizeLeadNamePart(value: string | null | undefined, fallback = 'Unknown'): string {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === '-') return fallback;
  if (/^unknown/i.test(trimmed)) return fallback;
  return trimmed;
}

function normalizeLeadTitle(value: string | null | undefined): string {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === '-') return 'Unknown';
  return trimmed;
}

function buildFullName(firstName: string, lastName: string): string {
  const normalizedFirst = normalizeLeadNamePart(firstName, 'Unknown');
  const normalizedLast = normalizeLeadNamePart(lastName, '');
  return [normalizedFirst, normalizedLast].filter(Boolean).join(' ').trim();
}

function buildRecipientName(lead: LeadReportLead): string {
  const lastName = normalizeLeadNamePart(lead.lastName, '');
  return [normalizeLeadNamePart(lead.firstName), lastName].filter(Boolean).join(' ').trim();
}

function deriveAccountDomain(lead: ParsedLead): string | null {
  const email = lead.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1];
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

function buildMatch(account: Account | undefined, method: LeadReportLead['match']['method']): LeadReportLead['match'] {
  if (!account) {
    return {
      kind: 'unmatched',
      method: 'no_match',
      accountId: null,
      accountName: null,
      domain: null,
      industry: null,
      hasResearchContext: false,
    };
  }

  return {
    kind: 'matched',
    method,
    accountId: account.id,
    accountName: account.company_name,
    domain: account.domain,
    industry: account.industry,
    hasResearchContext: account.research_status === 'completed',
  };
}

function matchLeadToAccount(lead: ParsedLead): LeadReportLead['match'] {
  const emailDomain = deriveAccountDomain(lead);
  const domainMatch = emailDomain ? findAccountByDomainOrName(emailDomain, lead.company) : undefined;
  if (domainMatch) {
    return buildMatch(domainMatch, 'domain');
  }

  const exactMatch = findAccountByDomainOrName(null, lead.company);
  if (exactMatch) {
    return buildMatch(exactMatch, 'name_exact');
  }

  const fuzzy = findAccountFuzzy(lead.company);
  if (fuzzy.exact) {
    return buildMatch(fuzzy.exact, 'fuzzy_unique');
  }

  if (fuzzy.fuzzy.length === 1) {
    return buildMatch(fuzzy.fuzzy[0], 'fuzzy_unique');
  }

  return buildMatch(undefined, 'no_match');
}

function toLeadReportLead(lead: ParsedLead, parserSource: 'deterministic' | 'llm'): LeadReportLead {
  const firstName = normalizeLeadNamePart(lead.firstName);
  const lastName = normalizeLeadNamePart(lead.lastName, '');
  return {
    rowNumber: lead.rowNumber,
    firstName,
    lastName: lastName || 'Unknown',
    fullName: buildFullName(firstName, lastName),
    title: normalizeLeadTitle(lead.title),
    company: lead.company.trim(),
    email: lead.email || null,
    phone: lead.phone || null,
    campaignName: lead.campaignName?.trim() || null,
    memberStatus: lead.memberStatus?.trim() || null,
    accountStatus: lead.accountStatus?.trim() || null,
    auth0Owner: lead.auth0Owner?.trim() || null,
    parserSource,
    match: matchLeadToAccount(lead),
  };
}

function parseScore(leads: ParsedLead[]): number {
  const missingTitles = leads.filter((lead) => !lead.title || lead.title === '-' || lead.title === 'Unknown').length;
  const missingLastNames = leads.filter((lead) => !lead.lastName || lead.lastName === '-' || /^unknown/i.test(lead.lastName)).length;
  return leads.length * 100 - missingTitles * 10 - missingLastNames * 8;
}

export async function parseLeadReport(rawText: string): Promise<{
  parserMode: 'deterministic' | 'llm';
  parseErrors: string[];
  leads: LeadReportLead[];
}> {
  const deterministic = parseQlText(rawText);
  let leads = deterministic.leads;
  let parseErrors = [...deterministic.parseErrors];
  let parserMode: 'deterministic' | 'llm' = 'deterministic';

  if (shouldUseLlmParserForLeadReport(rawText, deterministic.leads)) {
    const llm = await parseQlTextWithLlm(rawText);
    if (llm.leads.length > 0 && parseScore(llm.leads) >= parseScore(deterministic.leads)) {
      leads = llm.leads;
      parseErrors = [...llm.parseErrors];
      parserMode = 'llm';
    } else if (llm.parseErrors.length > 0) {
      parseErrors.push(...llm.parseErrors);
    }
  }

  const normalized = leads
    .filter((lead) => lead.company?.trim() && (lead.firstName?.trim() || lead.lastName?.trim()))
    .map((lead, index) => toLeadReportLead({ ...lead, rowNumber: index + 1 }, parserMode));

  return {
    parserMode,
    parseErrors,
    leads: normalized,
  };
}

function buildLeadContext(lead: LeadReportLead): string | undefined {
  const parts: string[] = [];

  if (lead.campaignName) {
    parts.push(`This lead came from "${lead.campaignName}".`);
  }

  if (lead.memberStatus) {
    parts.push(`Lead/member status: ${lead.memberStatus}.`);
  }

  if (lead.accountStatus) {
    parts.push(`Salesforce/report context: ${lead.accountStatus}.`);
  }

  if (lead.auth0Owner) {
    parts.push(`Reported lead owner/account owner: ${lead.auth0Owner}.`);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

function getOrCreateProspectForMatchedAccount(accountId: number, lead: LeadReportLead): {
  prospect: Prospect;
  status: 'created' | 'existing';
} {
  const existing = findExistingProspectByEmailOrName(
    accountId,
    lead.email || undefined,
    normalizeLeadNamePart(lead.firstName),
    normalizeLeadNamePart(lead.lastName, 'Unknown')
  );

  if (existing) {
    updateProspect(existing.id, {
      title: existing.title || normalizeLeadTitle(lead.title),
      email: existing.email || lead.email || undefined,
      phone: existing.phone || lead.phone || undefined,
      campaign_name: existing.campaign_name || lead.campaignName || undefined,
      member_status: existing.member_status || lead.memberStatus || undefined,
      account_status_sfdc: existing.account_status_sfdc || lead.accountStatus || undefined,
    });
    return { prospect: getProspect(existing.id) || existing, status: 'existing' };
  }

  const prospect = createProspect({
    account_id: accountId,
    first_name: normalizeLeadNamePart(lead.firstName),
    last_name: normalizeLeadNamePart(lead.lastName, 'Unknown'),
    title: normalizeLeadTitle(lead.title),
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    source: 'salesforce_import',
    lead_source: lead.campaignName || undefined,
    campaign_name: lead.campaignName || undefined,
    member_status: lead.memberStatus || undefined,
    account_status_sfdc: lead.accountStatus || undefined,
  });

  return { prospect, status: 'created' };
}
export async function generateLeadReportEmail(
  lead: LeadReportLead,
  customInstructions?: string
): Promise<LeadReportGenerateResponse> {
  const customContext = buildLeadContext(lead);

  if (lead.match.kind === 'matched' && lead.match.accountId) {
    const account = getAccount(lead.match.accountId);
    if (!account) {
      throw new Error(`Matched account ${lead.match.accountId} not found`);
    }

    const { prospect, status } = getOrCreateProspectForMatchedAccount(account.id, lead);

    if (account.research_status === 'completed') {
      const emailResult = await generateEmail({
        recipientName: buildRecipientName(lead),
        recipientPersona: normalizeLeadTitle(lead.title),
        emailType: 'cold',
        researchContext: 'auth0',
        customInstructions,
        customContext,
        accountData: account,
      });

      createProspectEmail({
        prospect_id: prospect.id,
        account_id: account.id,
        subject: emailResult.subject,
        body: emailResult.body,
        reasoning: emailResult.reasoning,
        key_insights: JSON.stringify(emailResult.keyInsights),
        email_type: 'cold',
        research_context: 'auth0',
      });

      return leadReportGenerateResponseSchema.parse({
        rowNumber: lead.rowNumber,
        fullName: lead.fullName,
        company: lead.company,
        title: lead.title,
        email: lead.email,
        matchType: 'matched_account_context',
        accountId: account.id,
        accountName: account.company_name,
        prospectId: prospect.id,
        prospectStatus: status,
        generatedEmail: emailResult,
      });
    }

    const brief = await researchCompanyBrief({
      companyNameOrDomain: account.domain || account.company_name,
      prospectName: buildRecipientName(lead),
      prospectTitle: normalizeLeadTitle(lead.title),
      customContext,
      customInstructions,
    });

    const email = await generateStandaloneSingleEmail(brief, customInstructions);
    createProspectEmail({
      prospect_id: prospect.id,
      account_id: account.id,
      subject: email.subject,
      body: email.body,
      reasoning: email.reasoning,
      key_insights: JSON.stringify(email.keyInsights),
      email_type: 'cold',
      research_context: 'auth0',
    });

    return leadReportGenerateResponseSchema.parse({
      rowNumber: lead.rowNumber,
      fullName: lead.fullName,
      company: lead.company,
      title: lead.title,
      email: lead.email,
      matchType: 'matched_account_light_research',
      accountId: account.id,
      accountName: account.company_name,
      prospectId: prospect.id,
      prospectStatus: status,
      generatedEmail: email,
    });
  }

  const brief = await researchCompanyBrief({
    companyNameOrDomain: lead.company,
    prospectName: buildRecipientName(lead),
    prospectTitle: normalizeLeadTitle(lead.title),
    customContext,
    customInstructions,
  });

  const email = await generateStandaloneSingleEmail(brief, customInstructions);
  return leadReportGenerateResponseSchema.parse({
    rowNumber: lead.rowNumber,
    fullName: lead.fullName,
    company: lead.company,
    title: lead.title,
    email: lead.email,
    matchType: 'unmatched_light_research',
    accountId: null,
    accountName: null,
    prospectId: null,
    prospectStatus: 'unattached',
    generatedEmail: email,
  });
}
