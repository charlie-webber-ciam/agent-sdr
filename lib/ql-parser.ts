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

export function parseQlText(rawText: string): ParseResult {
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
    if (EMAIL_RE.test(line)) {
      email = line;
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

function isPhoneLike(s: string): boolean {
  // Strip common phone chars and check if mostly digits
  const digits = s.replace(/[\s\-\(\)\+\.]/g, '');
  return digits.length >= 7 && /^\d+$/.test(digits);
}
