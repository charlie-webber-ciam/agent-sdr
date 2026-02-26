import { NextResponse } from 'next/server';
import { getAccount, createProspect, migrateGhostToProspect } from '@/lib/db';

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
    const { ghostKey, ghostData } = body;

    if (!ghostKey || !ghostData?.name) {
      return NextResponse.json({ error: 'ghostKey and ghostData.name are required' }, { status: 400 });
    }

    // Split name into first/last
    const nameParts = ghostData.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const prospect = createProspect({
      account_id: accountId,
      first_name: firstName,
      last_name: lastName,
      title: ghostData.title || null,
      linkedin_url: ghostData.linkedin_url || null,
      source: 'ai_research',
      description: ghostData.background || null,
    });

    // Migrate positions and edges from ghost to new prospect
    migrateGhostToProspect(accountId, ghostKey, prospect.id);

    return NextResponse.json(prospect);
  } catch (error) {
    console.error('Error promoting ghost prospect:', error);
    return NextResponse.json({ error: 'Failed to promote ghost prospect' }, { status: 500 });
  }
}
