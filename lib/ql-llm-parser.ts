import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import type { ParseResult, ParsedLead } from './ql-parser';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

const NORMALIZER_MODEL = process.env.QL_IMPORT_NORMALIZER_MODEL || 'gpt-5.2';

const NORMALIZER_INSTRUCTIONS = `You normalize messy bulk SDR prospect text into structured JSON.

Rules:
1. Extract one lead object per person/prospect record.
2. Keep original ordering where possible.
3. Do not hallucinate. If a field is unknown, set it to null or empty string.
4. Use plain JSON only. No markdown fences.
5. Minimum required fields per lead: firstName, title, and company.
   - If firstName is missing but email exists, infer firstName from the email local-part.
   - If title is missing, use "Unknown".
6. Prefer these fields when present:
   - rowNumber
   - sfdcAccountId (15-char SFDC ID)
   - sfdcContactId (18-char SFDC ID)
   - firstName
   - lastName
   - fullName
   - company
   - title
   - email
   - phone
   - campaignName
   - campaignCode
   - memberStatus
   - accountStatus
   - auth0Owner
   - notes

Return this exact shape:
{
  "leads": [
    {
      "rowNumber": 1,
      "sfdcAccountId": null,
      "sfdcContactId": null,
      "firstName": null,
      "lastName": null,
      "fullName": null,
      "company": null,
      "title": null,
      "email": null,
      "phone": null,
      "campaignName": null,
      "campaignCode": null,
      "memberStatus": null,
      "accountStatus": null,
      "auth0Owner": null,
      "notes": null
    }
  ],
  "warnings": []
}`;

interface LlmLead {
  rowNumber?: number | string | null;
  sfdcAccountId?: string | null;
  sfdcContactId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  campaignName?: string | null;
  campaignCode?: string | null;
  memberStatus?: string | null;
  accountStatus?: string | null;
  auth0Owner?: string | null;
  notes?: string | null;
}

interface LlmParseResponse {
  leads?: LlmLead[];
  warnings?: string[];
}

const ID_15 = /^[a-zA-Z0-9]{15}$/;
const ID_18 = /^[a-zA-Z0-9]{18}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function parseQlTextWithLlm(rawText: string): Promise<ParseResult> {
  const leads: ParsedLead[] = [];
  const parseErrors: string[] = [];

  if (!process.env.OPENAI_API_KEY) {
    return {
      leads: [],
      parseErrors: ['LLM normalizer unavailable: OPENAI_API_KEY is not set'],
    };
  }

  try {
    const agent = new Agent({
      name: 'QL Unstructured Normalizer',
      model: NORMALIZER_MODEL,
      instructions: NORMALIZER_INSTRUCTIONS,
      tools: [],
    });

    const prompt = [
      'Normalize the following unstructured prospect text into the required JSON format.',
      'Keep as much real source detail as possible.',
      '',
      'RAW INPUT:',
      rawText,
    ].join('\n');

    const response = await run(agent, prompt);
    const parsed = parseAgentJson(response.finalOutput || '');

    if (Array.isArray(parsed.warnings)) {
      for (const warning of parsed.warnings) {
        const value = toCleanString(warning);
        if (value) parseErrors.push(`LLM warning: ${value}`);
      }
    }

    const rawLeads = Array.isArray(parsed.leads) ? parsed.leads : [];
    for (let i = 0; i < rawLeads.length; i++) {
      const normalized = normalizeLead(rawLeads[i], i + 1, parseErrors);
      if (normalized) leads.push(normalized);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    parseErrors.push(`LLM normalization failed: ${message}`);
  }

  return { leads, parseErrors };
}

function parseAgentJson(response: string): LlmParseResponse {
  let clean = response.trim();
  clean = clean.replace(/```json\s*/gi, '');
  clean = clean.replace(/```\s*/g, '');

  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in normalizer response');
  }

  return JSON.parse(jsonMatch[0]) as LlmParseResponse;
}

function normalizeLead(
  lead: LlmLead,
  fallbackRowNumber: number,
  parseErrors: string[]
): ParsedLead | null {
  const company = toCleanString(lead.company);

  const firstNameRaw = toCleanString(lead.firstName);
  const lastNameRaw = toCleanString(lead.lastName);
  const fullNameRaw = toCleanString(lead.fullName);

  const fromFullName = splitName(fullNameRaw);
  let firstName = firstNameRaw || fromFullName.firstName;
  let lastName = lastNameRaw || fromFullName.lastName;

  const email = sanitizeEmail(lead.email);
  if (!firstName && !lastName && email) {
    const emailName = splitNameFromEmail(email);
    firstName = emailName.firstName;
    lastName = emailName.lastName;
  }

  if (!firstName && !lastName) {
    parseErrors.push(`Lead ${fallbackRowNumber}: missing prospect name, skipped`);
    return null;
  }

  if (!company) {
    parseErrors.push(`Lead ${fallbackRowNumber}: missing company, skipped`);
    return null;
  }

  const rowNumber = normalizeRowNumber(lead.rowNumber, fallbackRowNumber);
  const phone = toCleanString(lead.phone) || null;

  const campaignName =
    toCleanString(lead.campaignName) ||
    toCleanString(lead.campaignCode) ||
    '';

  const notes = toCleanString(lead.notes);
  const accountStatusBase = toCleanString(lead.accountStatus) || '';
  const accountStatus = notes
    ? [accountStatusBase, notes].filter(Boolean).join(' | ')
    : accountStatusBase || null;

  return {
    rowNumber,
    sfdcAccountId: normalizeSfdcId(lead.sfdcAccountId, ID_15),
    sfdcContactId: normalizeSfdcId(lead.sfdcContactId, ID_18) || '',
    firstName: firstName || 'Unknown',
    lastName: lastName || 'Unknown',
    campaignName,
    memberStatus: toCleanString(lead.memberStatus) || '',
    auth0Owner: toCleanString(lead.auth0Owner) || '',
    company,
    title: toCleanString(lead.title) || 'Unknown',
    phone,
    email,
    accountStatus,
  };
}

function normalizeRowNumber(value: number | string | null | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return fallback;
}

function normalizeSfdcId(value: string | null | undefined, pattern: RegExp): string | null {
  const cleaned = toCleanString(value);
  if (!cleaned) return null;
  return pattern.test(cleaned) ? cleaned : null;
}

function sanitizeEmail(value: string | null | undefined): string | null {
  const cleaned = toCleanString(value);
  if (!cleaned) return null;
  return EMAIL_RE.test(cleaned) ? cleaned : null;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function splitNameFromEmail(email: string): { firstName: string; lastName: string } {
  const localPart = email.split('@')[0];
  const normalized = localPart.replace(/[._-]+/g, ' ').trim();
  return splitName(normalized);
}

function toCleanString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}
