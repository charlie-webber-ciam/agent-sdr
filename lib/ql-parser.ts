/**
 * Deterministic parser for QL (Queue List) spreadsheet text.
 *
 * Field order per lead block:
 *   1. Row number (integer-only line that starts a new block)
 *   2. Optional 15-digit SFDC Account ID
 *   3. 18-digit Contact/Lead ID
 *   4. First Name
 *   5. Last Name
 *   6. Campaign Name
 *   7. Member Status
 *   8. Auth0 Owner
 *   9. Company
 *  10. Title
 *  11. Phone  (may have a preceding blank line)
 *  12. Email  (may have a preceding blank line)
 *  13. Account Status
 */

import { parse as parseCsv } from 'csv-parse/sync';

export interface ParsedLead {
  rowNumber: number;
  sfdcAccountId: string | null;  // 15-digit
  sfdcContactId: string;          // 18-digit
  firstName: string;
  lastName: string;
  campaignName: string;
  memberStatus: string;
  auth0Owner: string;
  company: string;
  title: string;
  phone: string | null;
  email: string | null;
  accountStatus: string | null;
}

export interface ParseResult {
  leads: ParsedLead[];
  parseErrors: string[];
}

const ID_15 = /^[a-zA-Z0-9]{15}$/;
const ID_18 = /^[a-zA-Z0-9]{18}$/;
const ROW_NUMBER = /^\d+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_IN_TEXT_RE = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
const DATE_TIME_RE = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/;
const OWNER_COUNT_RE = /^([A-Za-z][A-Za-z\s.'-]+)\((\d+)\)$/;
const PAREN_NUMBER_RE = /^\(\d+\)$/;
const HEADER_PATTERNS = [
  /^total records/i,
  /^lead owner\b/i,
  /^mapped sdr\b/i,
  /^sorted by\b/i,
  /^company \/ account$/i,
  /^email$/i,
  /^most recent routed date\/time$/i,
  /^most recent lead source detail$/i,
  /^lead source$/i,
  /^lead status$/i,
  /^subtotal\b/i,
  /^select row for drill down/i,
  /^select all rows for drill down/i,
];

export function parseQlText(rawText: string): ParseResult {
  if (looksLikeCsv(rawText)) {
    const csvFirst = parseCsvLeadReportText(rawText);
    if (csvFirst.leads.length > 0) {
      return csvFirst;
    }
  }

  const classic = parseClassicRowBlockText(rawText);
  const grouped = parseGroupedOwnerReportText(rawText);
  const csv = parseCsvLeadReportText(rawText);

  const candidates = [classic, grouped, csv];
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (candidate.leads.length > best.leads.length) {
      best = candidate;
    }
  }

  if (best.leads.length > 0) {
    return best;
  }

  return {
    leads: [],
    parseErrors: [...classic.parseErrors, ...grouped.parseErrors, ...csv.parseErrors],
  };
}

function parseClassicRowBlockText(rawText: string): ParseResult {
  const leads: ParsedLead[] = [];
  const parseErrors: string[] = [];

  // Normalise line endings and split
  const allLines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Find block start indices (lines that are just an integer)
  const blockStarts: number[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const trimmed = allLines[i].trim();
    if (ROW_NUMBER.test(trimmed)) {
      blockStarts.push(i);
    }
  }

  for (let b = 0; b < blockStarts.length; b++) {
    const startIdx = blockStarts[b];
    const endIdx = b + 1 < blockStarts.length ? blockStarts[b + 1] : allLines.length;

    // Collect non-empty lines in this block (excluding the row number line itself)
    const rowNumberStr = allLines[startIdx].trim();
    const rowNumber = parseInt(rowNumberStr, 10);

    // Gather all lines (including blanks) between this block start and next
    const blockLines = allLines.slice(startIdx + 1, endIdx);

    // Extract non-empty trimmed lines, but preserve blanks for phone/email detection
    const nonEmptyLines: string[] = [];
    for (const line of blockLines) {
      const t = line.trim();
      if (t !== '') {
        nonEmptyLines.push(t);
      }
    }

    if (nonEmptyLines.length < 5) {
      parseErrors.push(`Row ${rowNumber}: Too few fields (${nonEmptyLines.length} lines)`);
      continue;
    }

    try {
      const lead = parseBlock(rowNumber, nonEmptyLines);

      // Skip entries missing both contact ID and company
      if (!lead.sfdcContactId && !lead.company) {
        parseErrors.push(`Row ${rowNumber}: Missing both contact ID and company, skipping`);
        continue;
      }

      leads.push(lead);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parseErrors.push(`Row ${rowNumber}: ${msg}`);
    }
  }

  return { leads, parseErrors };
}

function parseGroupedOwnerReportText(rawText: string): ParseResult {
  const allLines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const leads: ParsedLead[] = [];
  const parseErrors: string[] = [];

  let currentOwner = '';
  let rowNumber = 1;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (!line) continue;

    const ownerMatch = line.match(OWNER_COUNT_RE);
    if (
      ownerMatch &&
      !line.toLowerCase().startsWith('subtotal') &&
      !isLikelyCompanyName(ownerMatch[1])
    ) {
      currentOwner = ownerMatch[1].trim();
      continue;
    }

    const email = extractEmailFromLine(line);
    if (!email) continue;

    const company = findPreviousCompanyLine(allLines, i);
    if (!company) {
      parseErrors.push(`Email ${email}: unable to determine company/account, skipped`);
      continue;
    }

    const metadata = collectNextMetadataLines(allLines, i + 1);
    const parsedName = splitNameFromEmail(email);
    const campaignName = metadata.campaignOrDetail || '';
    const leadSource = metadata.leadSource || '';
    const leadStatus = metadata.leadStatus || '';

    leads.push({
      rowNumber,
      sfdcAccountId: null,
      sfdcContactId: '',
      firstName: parsedName.firstName || 'Unknown',
      lastName: parsedName.lastName || 'Unknown',
      campaignName,
      memberStatus: leadStatus,
      auth0Owner: currentOwner,
      company,
      title: '',
      phone: null,
      email,
      accountStatus: leadSource || null,
    });

    rowNumber++;
  }

  if (leads.length === 0) {
    parseErrors.push('No leads detected in grouped owner report format');
  }

  return { leads, parseErrors };
}

function parseCsvLeadReportText(rawText: string): ParseResult {
  const leads: ParsedLead[] = [];
  const parseErrors: string[] = [];

  if (!looksLikeCsv(rawText)) {
    return { leads, parseErrors };
  }

  try {
    const rows = parseCsv(rawText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as Array<Record<string, string>>;

    let rowNumber = 1;
    for (const row of rows) {
      const firstNameRaw = getCsvField(row, ['first name']);
      const lastNameRaw = getCsvField(row, ['last name']);
      const titleRaw = getCsvField(row, ['title']);
      const companyRaw = getCsvField(row, ['company / account', 'company/account', 'company']);
      const emailRaw = getCsvField(row, ['email']);
      const campaignDetail = getCsvField(row, ['most recent lead source detail']);
      const leadSource = getCsvField(row, ['lead source']);
      const leadStatus = getCsvField(row, ['lead status']);
      const leadOwner = getCsvField(row, ['lead owner']);
      const mappedSdr = getCsvField(row, ['mapped sdr']);
      const routedDate = getCsvField(row, ['most recent routed date/time']);

      const email = extractEmailFromLine(emailRaw);
      if (!companyRaw && !email) continue;

      let firstName = firstNameRaw;
      let lastName = lastNameRaw;
      if (!firstName && !lastName && email) {
        const fromEmail = splitNameFromEmail(email);
        firstName = fromEmail.firstName;
        lastName = fromEmail.lastName;
      }

      if (!companyRaw) {
        parseErrors.push(`CSV row ${rowNumber}: missing Company / Account, skipped`);
        rowNumber++;
        continue;
      }

      if (!firstName) firstName = 'Unknown';
      if (!lastName) lastName = 'Unknown';

      const accountStatusParts: string[] = [];
      if (leadSource) accountStatusParts.push(`Lead Source: ${leadSource}`);
      if (routedDate) accountStatusParts.push(`Routed: ${routedDate}`);
      if (mappedSdr) accountStatusParts.push(`Mapped SDR: ${mappedSdr}`);

      leads.push({
        rowNumber,
        sfdcAccountId: null,
        sfdcContactId: '',
        firstName,
        lastName,
        campaignName: campaignDetail || '',
        memberStatus: leadStatus || '',
        auth0Owner: leadOwner || '',
        company: companyRaw,
        title: titleRaw || '',
        phone: null,
        email,
        accountStatus: accountStatusParts.length > 0 ? accountStatusParts.join(' | ') : null,
      });

      rowNumber++;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    parseErrors.push(`CSV parse failed: ${message}`);
  }

  return { leads, parseErrors };
}

function parseBlock(rowNumber: number, lines: string[]): ParsedLead {
  let cursor = 0;

  // Field 1: Optional 15-digit SFDC Account ID
  let sfdcAccountId: string | null = null;
  if (cursor < lines.length && ID_15.test(lines[cursor])) {
    sfdcAccountId = lines[cursor];
    cursor++;
  }

  // Field 2: 18-digit Contact/Lead ID
  let sfdcContactId = '';
  if (cursor < lines.length && ID_18.test(lines[cursor])) {
    sfdcContactId = lines[cursor];
    cursor++;
  }

  // Field 3: First Name
  const firstName = cursor < lines.length ? lines[cursor++] : '';

  // Field 4: Last Name
  const lastName = cursor < lines.length ? lines[cursor++] : '';

  // Field 5: Campaign Name
  const campaignName = cursor < lines.length ? lines[cursor++] : '';

  // Field 6: Member Status
  const memberStatus = cursor < lines.length ? lines[cursor++] : '';

  // Field 7: Auth0 Owner
  const auth0Owner = cursor < lines.length ? lines[cursor++] : '';

  // Field 8: Company
  const company = cursor < lines.length ? lines[cursor++] : '';

  // Field 9: Title
  const title = cursor < lines.length ? lines[cursor++] : '';

  // Remaining fields: phone, email, account status
  // These may appear in any order at the end, with phone/email often having blanks before them
  const remaining = lines.slice(cursor);

  let phone: string | null = null;
  let email: string | null = null;
  let accountStatus: string | null = null;

  // Classify remaining lines
  const unclassified: string[] = [];
  for (const line of remaining) {
    const extractedEmail = extractEmailFromLine(line);
    if (extractedEmail) {
      email = extractedEmail;
    } else if (isPhoneLike(line)) {
      phone = line;
    } else {
      unclassified.push(line);
    }
  }

  // The last unclassified line is likely the account status
  if (unclassified.length > 0) {
    accountStatus = unclassified[unclassified.length - 1];
  }

  return {
    rowNumber,
    sfdcAccountId,
    sfdcContactId,
    firstName,
    lastName,
    campaignName,
    memberStatus,
    auth0Owner,
    company,
    title,
    phone,
    email,
    accountStatus,
  };
}

function findPreviousCompanyLine(allLines: string[], emailIndex: number): string | null {
  const start = Math.max(0, emailIndex - 14);
  for (let i = emailIndex - 1; i >= start; i--) {
    const line = allLines[i].trim();
    if (!line) continue;
    if (extractEmailFromLine(line)) continue;
    if (DATE_TIME_RE.test(line)) continue;
    if (PAREN_NUMBER_RE.test(line)) continue;
    if (isReportHeaderOrNoise(line)) continue;
    return line;
  }
  return null;
}

function collectNextMetadataLines(allLines: string[], startIndex: number): {
  campaignOrDetail: string | null;
  leadSource: string | null;
  leadStatus: string | null;
} {
  const values: string[] = [];

  for (let i = startIndex; i < allLines.length && values.length < 5; i++) {
    const line = allLines[i].trim();
    if (!line) continue;
    if (extractEmailFromLine(line)) break;
    if (line.match(OWNER_COUNT_RE) && !line.toLowerCase().startsWith('subtotal')) break;
    if (line.toLowerCase().startsWith('subtotal')) break;
    if (isReportHeaderOrNoise(line)) continue;
    values.push(line);
  }

  let dateIndex = values.findIndex(v => DATE_TIME_RE.test(v));
  if (dateIndex < 0) dateIndex = -1;

  const campaignOrDetail =
    dateIndex >= 0 ? values[dateIndex + 1] || null : values[0] || null;
  const leadSource =
    dateIndex >= 0 ? values[dateIndex + 2] || null : values[1] || null;
  const leadStatus =
    dateIndex >= 0 ? values[dateIndex + 3] || null : values[2] || null;

  return { campaignOrDetail, leadSource, leadStatus };
}

function splitNameFromEmail(email: string): { firstName: string; lastName: string } {
  const localPart = email.split('@')[0];
  const normalized = localPart.replace(/[._-]+/g, ' ').trim();
  const parts = normalized.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) {
    return {
      firstName: toTitleCase(parts[0]),
      lastName: '',
    };
  }
  return {
    firstName: toTitleCase(parts[0]),
    lastName: toTitleCase(parts[parts.length - 1]),
  };
}

function toTitleCase(value: string): string {
  if (!value) return '';
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function isReportHeaderOrNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return HEADER_PATTERNS.some(pattern => pattern.test(trimmed));
}

function isLikelyCompanyName(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (!lower) return false;
  return (
    lower.includes('inc') ||
    lower.includes('ltd') ||
    lower.includes('pty') ||
    lower.includes('corp') ||
    lower.includes('limited') ||
    lower.includes('group')
  );
}

function isPhoneLike(s: string): boolean {
  // Strip common phone chars and check if mostly digits
  const digits = s.replace(/[\s\-\(\)\+\.]/g, '');
  return digits.length >= 7 && /^\d+$/.test(digits);
}

function extractEmailFromLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (EMAIL_RE.test(trimmed)) return trimmed.toLowerCase();
  const match = trimmed.match(EMAIL_IN_TEXT_RE);
  return match ? match[1].toLowerCase() : null;
}

function looksLikeCsv(rawText: string): boolean {
  const firstLine = rawText.split(/\r?\n/, 1)[0]?.toLowerCase() || '';
  if (!firstLine.includes(',')) return false;
  return (
    firstLine.includes('company / account') ||
    (firstLine.includes('first name') && firstLine.includes('email'))
  );
}

function normalizeHeaderKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCsvField(row: Record<string, string>, aliases: string[]): string {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    normalized.set(normalizeHeaderKey(key), (value || '').trim());
  }
  for (const alias of aliases) {
    const value = normalized.get(normalizeHeaderKey(alias));
    if (value !== undefined) return value.trim();
  }
  return '';
}
