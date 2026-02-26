/**
 * Parse ZoomInfo search page copy-paste text into structured prospect data.
 *
 * Expected format (repeating blocks separated by blank lines):
 *   Full Name
 *   (blank lines from icons)
 *   Title
 *   (optional blank line)
 *   Company
 *   Industry, SubIndustry
 *   Rating (A+, A, B+, B, etc.)
 *   Last Touch (None, or date)
 */

export interface ParsedZoomInfoProspect {
  first_name: string;
  last_name: string;
  title: string;
  company: string;
  industry: string;
}

export function parseZoomInfoText(rawText: string): ParsedZoomInfoProspect[] {
  // Normalize line endings and trim
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Remove the header line if present
  const headerPattern = /^Contact\s+Info\s*\n.*?Primary\s+Industry\s*\n.*?Last\s+Touch\s*\n*/i;
  const cleaned = text.replace(headerPattern, '').trim();

  // Split into non-empty lines
  const lines = cleaned.split('\n').map(l => l.trim());

  const prospects: ParsedZoomInfoProspect[] = [];

  // Strategy: Walk through non-empty lines and detect prospect blocks.
  // A prospect block starts with a name (no common title keywords),
  // followed by a title, company, industry line, rating, and last touch.
  const nonEmpty = lines.filter(l => l.length > 0);

  // Heuristic patterns
  const ratingPattern = /^[A-D][+-]?$/;
  const lastTouchPattern = /^(None|none|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Z][a-z]+\s+\d{1,2},?\s*\d{2,4})$/;
  const titleKeywords = /\b(Chief|CEO|CTO|CFO|COO|CIO|CISO|CPO|CMO|VP|Vice President|SVP|EVP|Director|Head|Manager|Lead|Officer|President|Controller|Architect|Engineer|Analyst|Specialist)\b/i;

  let i = 0;
  while (i < nonEmpty.length) {
    const line = nonEmpty[i];

    // Skip lines that look like ratings or last touch values at top level
    if (ratingPattern.test(line) || lastTouchPattern.test(line)) {
      i++;
      continue;
    }

    // Try to parse a prospect block starting at this position.
    // Pattern: Name, Title, Company, Industry, Rating, LastTouch
    // The name is a line that doesn't match common title keywords as the first word
    // and doesn't match a rating.

    // Check if this could be a name (2+ words, not a title-looking thing by itself)
    const words = line.split(/\s+/);
    const couldBeName = words.length >= 2 && !ratingPattern.test(line);

    if (!couldBeName) {
      i++;
      continue;
    }

    // Look ahead for title, company, industry, rating, lastTouch
    // Title: usually contains a title keyword
    // Company: a shorter line, proper noun
    // Industry: contains comma typically
    // Rating: A+, A, B, etc.
    // Last Touch: None or date

    let title: string | null = null;
    let company: string | null = null;
    let industry: string | null = null;
    let j = i + 1;

    // Find the title (next line with a title keyword)
    while (j < nonEmpty.length && j <= i + 5) {
      if (titleKeywords.test(nonEmpty[j]) && !ratingPattern.test(nonEmpty[j])) {
        title = nonEmpty[j];
        j++;
        break;
      }
      j++;
    }

    if (!title) {
      // If no title keyword found in next 5 lines, this isn't a valid block
      i++;
      continue;
    }

    // Next should be company name
    if (j < nonEmpty.length && !ratingPattern.test(nonEmpty[j]) && !lastTouchPattern.test(nonEmpty[j])) {
      company = nonEmpty[j];
      j++;
    }

    // Next should be industry (often contains comma)
    if (j < nonEmpty.length && !ratingPattern.test(nonEmpty[j]) && !lastTouchPattern.test(nonEmpty[j])) {
      industry = nonEmpty[j];
      j++;
    }

    // Skip rating and last touch
    if (j < nonEmpty.length && ratingPattern.test(nonEmpty[j])) j++;
    if (j < nonEmpty.length && lastTouchPattern.test(nonEmpty[j])) j++;

    if (company) {
      // Parse name
      const nameParts = line.split(/\s+/);
      // Handle middle initials like "James M. Edmonds"
      let firstName: string;
      let lastName: string;

      if (nameParts.length === 2) {
        firstName = nameParts[0];
        lastName = nameParts[1];
      } else if (nameParts.length >= 3) {
        firstName = nameParts[0];
        // Check if middle part is an initial (single letter or letter with period)
        const middle = nameParts[1];
        if (middle.length <= 2 || (middle.length === 2 && middle.endsWith('.'))) {
          // Middle initial — last name is everything after
          lastName = nameParts.slice(2).join(' ');
        } else {
          // No middle initial — last name is last part
          lastName = nameParts[nameParts.length - 1];
        }
      } else {
        firstName = nameParts[0];
        lastName = '';
      }

      prospects.push({
        first_name: firstName,
        last_name: lastName,
        title: title,
        company: company,
        industry: industry || '',
      });
    }

    i = j;
  }

  return prospects;
}
