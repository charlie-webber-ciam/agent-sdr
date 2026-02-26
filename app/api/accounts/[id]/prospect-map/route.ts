import { NextResponse } from 'next/server';
import {
  getAccount,
  getProspectsByAccount,
  getProspectPositions,
  getProspectEdges,
  getOpportunitiesWithProspects,
} from '@/lib/db';

interface GhostProspect {
  ghostKey: string;
  name: string;
  title: string | null;
  linkedin_url: string | null;
  source: 'auth0' | 'okta';
}

function slugify(name: string, source: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + source;
}

function parseGhostProspects(text: string | null, source: 'auth0' | 'okta'): GhostProspect[] {
  if (!text) return [];
  const ghosts: GhostProspect[] = [];

  // Split on numbered list patterns, bold name patterns, or ### headers
  const blocks = text.split(/(?=\d+\.\s+\*\*)|(?=###\s+)|(?=\n-\s+\*\*)/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Extract name from **Name** or ### Name patterns
    let name: string | null = null;
    let title: string | null = null;
    let linkedin: string | null = null;

    const boldMatch = trimmed.match(/\*\*([^*]+)\*\*/);
    const headerMatch = trimmed.match(/###\s+(.+)/);

    if (boldMatch) {
      name = boldMatch[1].trim();
    } else if (headerMatch) {
      name = headerMatch[1].trim();
    }

    if (!name) continue;

    // Remove any trailing role/title from name like "Name - Title" or "Name, Title"
    const nameParts = name.split(/\s*[-–—]\s*/);
    if (nameParts.length > 1) {
      name = nameParts[0].trim();
      title = nameParts.slice(1).join(' - ').trim();
    }

    // Look for title patterns in the block
    if (!title) {
      const titleMatch = trimmed.match(/(?:title|role|position)[:\s]+([^\n]+)/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    // Look for LinkedIn URL
    const linkedinMatch = trimmed.match(/(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)]+)/i);
    if (linkedinMatch) {
      linkedin = linkedinMatch[1];
    }

    // Skip entries that are clearly not names (too long, contain certain keywords)
    if (name.length > 60 || name.includes('http') || /^\d+$/.test(name)) continue;

    ghosts.push({
      ghostKey: slugify(name, source),
      name,
      title,
      linkedin_url: linkedin,
      source,
    });
  }

  return ghosts;
}

export async function GET(
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

    const prospects = getProspectsByAccount(accountId);
    const positions = getProspectPositions(accountId);
    const edges = getProspectEdges(accountId);
    const opportunitiesWithProspects = getOpportunitiesWithProspects(accountId);

    // Build opportunity data for the map
    const opportunities = opportunitiesWithProspects.map(opp => ({
      id: opp.id,
      name: opp.opportunity_name,
      stage: opp.stage,
      linkedProspectIds: opp.linkedProspects.map(p => p.id),
    }));

    // Parse ghost prospects from AI research text fields
    const auth0Ghosts = parseGhostProspects(account.prospects, 'auth0');
    const oktaGhosts = parseGhostProspects(account.okta_prospects, 'okta');
    const allGhosts = [...auth0Ghosts, ...oktaGhosts];

    // Deduplicate against existing structured prospects
    const existingNames = new Set(
      prospects.map(p => `${p.first_name} ${p.last_name}`.toLowerCase())
    );
    const ghostProspects = allGhosts.filter(
      g => !existingNames.has(g.name.toLowerCase())
    );

    return NextResponse.json({
      prospects,
      positions,
      edges,
      opportunities,
      ghostProspects,
    });
  } catch (error) {
    console.error('Error fetching prospect map data:', error);
    return NextResponse.json({ error: 'Failed to fetch map data' }, { status: 500 });
  }
}
