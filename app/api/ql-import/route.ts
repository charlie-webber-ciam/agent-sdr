import { NextResponse } from 'next/server';
import { parseQlText, type ParsedLead } from '@/lib/ql-parser';
import { parseQlTextWithLlm } from '@/lib/ql-llm-parser';
import {
  createAccount,
  createQlImportJob,
  findAccountByDomainOrName,
  findAccountFuzzy,
  getAccount,
  listQlImportJobs,
} from '@/lib/db';
import { processQlImportJob, type QlImportAccountResolution } from '@/lib/ql-import-processor';
import {
  assertProcessAction,
  parseJsonBody,
  processActionErrorResponse,
  runInBackground,
} from '@/lib/process-action-utils';

interface ResolutionInput {
  companyKey: string;
  action: 'link' | 'create';
  accountId?: number;
  industry?: string;
}

interface ResolutionPromptItem {
  companyKey: string;
  companyName: string;
  leadCount: number;
  sampleProspects: string[];
  candidates: Array<{
    id: number;
    companyName: string;
    domain: string | null;
    industry: string;
  }>;
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ rawText?: unknown; resolutions?: unknown }>(request);
    const rawText = typeof body.rawText === 'string' ? body.rawText : '';
    assertProcessAction(rawText.trim().length > 0, 400, 'rawText is required');

    const deterministicParse = parseQlText(rawText);
    let leads = deterministicParse.leads;
    let parseErrors = [...deterministicParse.parseErrors];
    let parserMode: 'deterministic' | 'llm' = 'deterministic';

    if (shouldUseLlmParser(rawText, deterministicParse.leads.length)) {
      const llmParse = await parseQlTextWithLlm(rawText);

      if (llmParse.leads.length > 0) {
        leads = llmParse.leads;
        parserMode = 'llm';
        parseErrors = [...llmParse.parseErrors];
      } else {
        parseErrors.push(...llmParse.parseErrors);
      }
    }

    const normalizedLeads = leads.filter((lead, index) => {
      const hasName = !!(lead.firstName?.trim() || lead.lastName?.trim());
      const hasCompany = !!lead.company?.trim();
      if (!hasName || !hasCompany) {
        parseErrors.push(`Lead ${lead.rowNumber || index + 1}: missing name or company, skipped`);
        return false;
      }
      return true;
    });

    if (normalizedLeads.length === 0) {
      return NextResponse.json(
        { error: 'No valid leads found in the pasted text', parseErrors },
        { status: 400 }
      );
    }

    const resolutionInputs = parseResolutions(body.resolutions);
    const resolutionByKey = new Map<string, ResolutionInput>();
    for (const resolution of resolutionInputs) {
      resolutionByKey.set(resolution.companyKey, resolution);
    }

    const bucketsByCompany = bucketLeadsByCompany(normalizedLeads);
    const unresolvedAccounts: ResolutionPromptItem[] = [];
    const accountIdByCompanyKey: Record<string, number> = {};
    const createdAccountIds: number[] = [];

    for (const [companyKey, bucket] of bucketsByCompany) {
      const manualResolution = resolutionByKey.get(companyKey);
      if (manualResolution) {
        if (manualResolution.action === 'link') {
          assertProcessAction(
            Number.isInteger(manualResolution.accountId) && (manualResolution.accountId || 0) > 0,
            400,
            `Resolution for "${bucket.companyName}" requires accountId`
          );
          const account = getAccount(manualResolution.accountId as number);
          assertProcessAction(account, 400, `Linked account does not exist for "${bucket.companyName}"`);
          accountIdByCompanyKey[companyKey] = account.id;
          continue;
        }

        const owner = inferAccountOwner(bucket.leads);
        const accountId = createAccount(
          bucket.companyName,
          null,
          manualResolution.industry || 'Unknown',
          null,
          owner || undefined
        );
        accountIdByCompanyKey[companyKey] = accountId;
        createdAccountIds.push(accountId);
        continue;
      }

      const directMatch = findAccountByDomainOrName(null, bucket.companyName);
      if (directMatch) {
        accountIdByCompanyKey[companyKey] = directMatch.id;
        continue;
      }

      const fuzzy = findAccountFuzzy(bucket.companyName);
      if (fuzzy.exact) {
        accountIdByCompanyKey[companyKey] = fuzzy.exact.id;
        continue;
      }

      unresolvedAccounts.push({
        companyKey,
        companyName: bucket.companyName,
        leadCount: bucket.leads.length,
        sampleProspects: bucket.leads.slice(0, 3).map(formatProspectSample),
        candidates: fuzzy.fuzzy.slice(0, 8).map(candidate => ({
          id: candidate.id,
          companyName: candidate.company_name,
          domain: candidate.domain,
          industry: candidate.industry,
        })),
      });
    }

    if (unresolvedAccounts.length > 0) {
      return NextResponse.json(
        {
          error: 'Some companies need account linking before processing',
          needsResolution: true,
          parserMode,
          totalLeads: normalizedLeads.length,
          parseErrors,
          unresolvedAccounts,
        },
        { status: 409 }
      );
    }

    const jobId = createQlImportJob(normalizedLeads.length, rawText);
    const accountResolution: QlImportAccountResolution = {
      accountIdByCompanyKey,
      createdAccountIds,
    };

    runInBackground(`ql-import/start job ${jobId}`, () =>
      processQlImportJob(jobId, normalizedLeads, accountResolution)
    );

    return NextResponse.json({
      jobId,
      totalLeads: normalizedLeads.length,
      parseErrors,
      parserMode,
    });
  } catch (error) {
    return processActionErrorResponse('QL import POST error', error, 'Failed to start QL import');
  }
}

export async function GET() {
  try {
    const jobs = listQlImportJobs(20);
    return NextResponse.json({ jobs });
  } catch (error) {
    return processActionErrorResponse('QL import GET error', error, 'Failed to fetch QL import jobs');
  }
}

function shouldUseLlmParser(rawText: string, deterministicLeadCount: number): boolean {
  if (deterministicLeadCount === 0) return true;

  const emailLikeCount = countEmailLikeEntries(rawText);
  if (emailLikeCount >= 8 && deterministicLeadCount < Math.floor(emailLikeCount * 0.7)) {
    return true;
  }

  const expectedRecords = extractExpectedRecordCount(rawText);
  if (!expectedRecords) return false;
  return deterministicLeadCount < Math.floor(expectedRecords * 0.5);
}

function normalizeCompanyKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function bucketLeadsByCompany(leads: ParsedLead[]): Map<string, { companyName: string; leads: ParsedLead[] }> {
  const buckets = new Map<string, { companyName: string; leads: ParsedLead[] }>();

  for (const lead of leads) {
    const companyName = lead.company.trim();
    const key = normalizeCompanyKey(companyName);
    const existing = buckets.get(key);
    if (existing) {
      existing.leads.push(lead);
      continue;
    }
    buckets.set(key, { companyName, leads: [lead] });
  }

  return buckets;
}

function parseResolutions(input: unknown): ResolutionInput[] {
  if (!Array.isArray(input)) return [];
  const resolutions: ResolutionInput[] = [];

  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const data = row as Record<string, unknown>;
    const action = data.action;
    if (action !== 'link' && action !== 'create') continue;
    const companyKeyRaw = typeof data.companyKey === 'string' ? data.companyKey : '';
    const companyKey = normalizeCompanyKey(companyKeyRaw);
    if (!companyKey) continue;

    const parsed: ResolutionInput = { companyKey, action };
    if (typeof data.accountId === 'number' && Number.isInteger(data.accountId)) {
      parsed.accountId = data.accountId;
    } else if (typeof data.accountId === 'string') {
      const accountId = parseInt(data.accountId, 10);
      if (!isNaN(accountId)) parsed.accountId = accountId;
    }
    if (typeof data.industry === 'string' && data.industry.trim()) {
      parsed.industry = data.industry.trim();
    }
    resolutions.push(parsed);
  }

  return resolutions;
}

function formatProspectSample(lead: ParsedLead): string {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim();
  const title = lead.title ? ` (${lead.title})` : '';
  return `${fullName || 'Unknown'}${title}`;
}

function inferAccountOwner(leads: ParsedLead[]): string | null {
  for (const lead of leads) {
    const owner = lead.auth0Owner?.trim();
    if (owner) return owner;
  }
  return null;
}

function extractExpectedRecordCount(rawText: string): number | null {
  const match = rawText.match(/total records\s+(\d+)/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return isNaN(value) || value <= 0 ? null : value;
}

function countEmailLikeEntries(rawText: string): number {
  const matches = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (!matches) return 0;
  return matches.length;
}
