import { NextResponse } from 'next/server';
import { getAccount, getProspectsByAccount, createProspect, findExistingProspectByEmailOrName } from '@/lib/db';

function buildTree(prospects: any[]) {
  const map = new Map<number, any>();
  const roots: any[] = [];

  for (const p of prospects) {
    map.set(p.id, { ...p, children: [] });
  }

  for (const p of prospects) {
    const node = map.get(p.id)!;
    if (p.parent_prospect_id && map.has(p.parent_prospect_id)) {
      map.get(p.parent_prospect_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
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

    const url = new URL(request.url);
    const tree = url.searchParams.get('tree') === 'true';

    if (tree) {
      return NextResponse.json({ prospects: buildTree(prospects) });
    }

    return NextResponse.json({ prospects });
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
  }
}

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

    if (!body.first_name || !body.last_name) {
      return NextResponse.json({ error: 'first_name and last_name are required' }, { status: 400 });
    }

    const duplicate = findExistingProspectByEmailOrName(accountId, body.email, body.first_name, body.last_name);
    if (duplicate) {
      return NextResponse.json(
        { error: 'A prospect with this email or name already exists for this account', existingProspect: duplicate },
        { status: 409 }
      );
    }

    const prospect = createProspect({
      account_id: accountId,
      first_name: body.first_name,
      last_name: body.last_name,
      title: body.title,
      email: body.email,
      phone: body.phone,
      linkedin_url: body.linkedin_url,
      department: body.department,
      notes: body.notes,
      role_type: body.role_type,
      relationship_status: body.relationship_status,
      source: body.source,
      mailing_address: body.mailing_address,
      lead_source: body.lead_source,
      last_activity_date: body.last_activity_date,
      do_not_call: body.do_not_call,
      description: body.description,
      parent_prospect_id: body.parent_prospect_id,
      sort_order: body.sort_order,
    });

    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    console.error('Error creating prospect:', error);
    return NextResponse.json({ error: 'Failed to create prospect' }, { status: 500 });
  }
}
