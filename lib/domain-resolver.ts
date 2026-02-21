/**
 * Domain Resolver
 *
 * Fixes two classes of bad domains before categorization:
 *  1. Placeholder domains (no-domain-*.placeholder) — infers the real domain via LLM
 *  2. Subdomains / deep paths (app.company.com) — strips to the base domain programmatically
 *
 * Writes the corrected domain back to the DB so the fix persists.
 */

import OpenAI from 'openai';
import { getDb } from './db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Two-part TLDs that must be kept together as the effective TLD
// e.g. "company.co.uk" has 3 parts but only one registrable label
const TWO_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'me.uk', 'net.uk', 'ltd.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz',
  'co.in', 'net.in', 'org.in',
  'co.za', 'net.za', 'org.za',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.mx', 'net.mx', 'org.mx',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.sg', 'net.sg', 'org.sg',
  'com.hk', 'net.hk', 'org.hk',
  'co.id', 'net.id', 'or.id',
  'com.ar', 'net.ar', 'org.ar',
  'com.cn', 'net.cn', 'org.cn',
  'co.kr', 'ne.kr', 'or.kr',
  'com.tw', 'net.tw', 'org.tw',
]);

export function isPlaceholderDomain(domain: string): boolean {
  return domain.includes('.placeholder');
}

/**
 * Given any domain string, return its registrable base domain.
 * Strips subdomains, protocols, trailing slashes, and paths.
 *
 * Examples:
 *   app.stripe.com          → stripe.com
 *   portal.auth.company.com → company.com
 *   blog.company.co.uk      → company.co.uk
 *   stripe.com              → stripe.com  (unchanged)
 *   company.co.uk           → company.co.uk  (unchanged)
 */
export function extractBaseDomain(domain: string): string {
  // Strip protocol, path, query string
  let d = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .trim();

  const parts = d.split('.');
  if (parts.length <= 1) return d; // Degenerate input, leave as-is

  // Check for a known two-part TLD at the end
  if (parts.length >= 2) {
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (TWO_PART_TLDS.has(lastTwo)) {
      // Registrable domain = one label before the two-part TLD
      // e.g. [blog, company, co, uk] → company.co.uk (last 3)
      return parts.slice(-3).join('.');
    }
  }

  // Standard single-part TLD: keep last 2 parts
  return parts.slice(-2).join('.');
}

/**
 * Call the LLM to infer the most likely primary domain for a company.
 * Returns null if the LLM is uncertain or returns something that
 * doesn't look like a valid domain.
 */
async function inferDomainFromLlm(companyName: string, industry: string): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content:
            'You are a company data researcher. When asked for a company\'s website domain, return only the bare domain string (e.g. "stripe.com", "acme.co.uk"). No explanation, no URL scheme, no trailing slash. If you are not confident, return the single word: null',
        },
        {
          role: 'user',
          content: `What is the primary website domain for this company?\n\nCompany: ${companyName}\nIndustry: ${industry || 'Unknown'}\n\nReturn the domain only, e.g. "stripe.com". If unsure, return null.`,
        },
      ],
      temperature: 0,
      max_tokens: 30,
    });

    const raw = response.choices[0].message.content?.trim().toLowerCase() ?? '';

    // Reject explicit uncertainty signals
    if (!raw || raw === 'null' || raw === 'unknown' || raw.length < 4) return null;

    // Strip any accidental protocol or www prefix the model adds
    const cleaned = raw
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim();

    // Basic sanity check: must look like a domain
    if (/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(cleaned) && cleaned.includes('.')) {
      return cleaned;
    }

    return null;
  } catch {
    return null;
  }
}

function persistDomain(accountId: number, newDomain: string): void {
  const db = getDb();
  db.prepare('UPDATE accounts SET domain = ? WHERE id = ?').run(newDomain, accountId);
}

/**
 * Main entry point — called by both categorizers before building their prompts.
 *
 * Returns the best available domain string and updates the DB if it changed.
 * Never throws; falls back to the original domain on any error.
 */
export async function resolveAndUpdateDomain(account: {
  id: number;
  domain: string;
  company_name: string;
  industry: string;
}): Promise<string> {
  const original = account.domain;

  try {
    // ── Case 1: placeholder domain ──────────────────────────────────────────
    if (isPlaceholderDomain(original)) {
      const inferred = await inferDomainFromLlm(account.company_name, account.industry);
      if (inferred) {
        // Also strip any subdomain the LLM returns
        const base = extractBaseDomain(inferred);
        persistDomain(account.id, base);
        console.log(`[DomainResolver] ${account.company_name}: placeholder → ${base}`);
        return base;
      }
      // LLM couldn't determine it — leave as-is
      console.log(`[DomainResolver] ${account.company_name}: could not infer domain, keeping placeholder`);
      return original;
    }

    // ── Case 2: subdomain or deep path ──────────────────────────────────────
    const base = extractBaseDomain(original);
    if (base !== original) {
      persistDomain(account.id, base);
      console.log(`[DomainResolver] ${account.company_name}: ${original} → ${base}`);
      return base;
    }

    // Domain is already clean
    return original;
  } catch (err) {
    console.error(`[DomainResolver] Error resolving domain for ${account.company_name}:`, err);
    return original;
  }
}
