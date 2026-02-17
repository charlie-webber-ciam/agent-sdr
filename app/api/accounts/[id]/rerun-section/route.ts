import { NextResponse } from 'next/server';
import { getAccount, updateAccountAuth0Research, updateAccountOktaResearch } from '@/lib/db';
import { researchSection as researchAuth0Section, AUTH0_RESEARCH_SECTIONS } from '@/lib/agent-researcher';
import { researchOktaSection, OKTA_RESEARCH_SECTIONS } from '@/lib/okta-agent-researcher';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);
    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await request.json();
    const { perspective, sections, additionalContext, model } = body;

    if (!perspective || (perspective !== 'auth0' && perspective !== 'okta')) {
      return NextResponse.json({ error: 'perspective must be "auth0" or "okta"' }, { status: 400 });
    }

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: 'sections must be a non-empty array of section keys' }, { status: 400 });
    }

    const company = {
      company_name: account.company_name,
      domain: account.domain,
      industry: account.industry,
    };

    const results: Record<string, string> = {};

    if (perspective === 'auth0') {
      // Validate section keys
      const validKeys = Object.keys(AUTH0_RESEARCH_SECTIONS);
      const invalidKeys = sections.filter((s: string) => !validKeys.includes(s));
      if (invalidKeys.length > 0) {
        return NextResponse.json(
          { error: `Invalid Auth0 section keys: ${invalidKeys.join(', ')}. Valid keys: ${validKeys.join(', ')}` },
          { status: 400 }
        );
      }

      // Run sections sequentially to avoid rate limits
      for (const sectionKey of sections) {
        const content = await researchAuth0Section(company, sectionKey, additionalContext || undefined, model);
        results[sectionKey] = content;

        // Update DB column for this section
        const dbColumn = AUTH0_RESEARCH_SECTIONS[sectionKey].dbColumn;
        const update: Record<string, string> = {};
        update[dbColumn] = content;
        updateAccountAuth0Research(accountId, update);
      }
    } else {
      // Okta perspective
      const validKeys = Object.keys(OKTA_RESEARCH_SECTIONS);
      const invalidKeys = sections.filter((s: string) => !validKeys.includes(s));
      if (invalidKeys.length > 0) {
        return NextResponse.json(
          { error: `Invalid Okta section keys: ${invalidKeys.join(', ')}. Valid keys: ${validKeys.join(', ')}` },
          { status: 400 }
        );
      }

      for (const sectionKey of sections) {
        const content = await researchOktaSection(company, sectionKey, additionalContext || undefined, model);
        results[sectionKey] = content;

        // Map Okta section keys to DB update format
        const dbColumn = OKTA_RESEARCH_SECTIONS[sectionKey].dbColumn;
        // The okta DB update function expects keys without the okta_ prefix for some fields
        const fieldMapping: Record<string, string> = {
          okta_current_iam_solution: 'current_iam_solution',
          okta_workforce_info: 'workforce_info',
          okta_security_incidents: 'security_incidents',
          okta_news_and_funding: 'news_and_funding',
          okta_tech_transformation: 'tech_transformation',
          okta_ecosystem: 'okta_ecosystem',
          okta_prospects: 'prospects',
        };
        const updateKey = fieldMapping[dbColumn] || dbColumn;
        const update: Record<string, string> = {};
        update[updateKey] = content;
        updateAccountOktaResearch(accountId, update);
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error re-running section:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to re-run section' },
      { status: 500 }
    );
  }
}
