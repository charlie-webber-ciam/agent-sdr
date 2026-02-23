import { NextResponse } from 'next/server';
import { getProspectEmails, getProspect, createProspectEmail } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  try {
    const { prospectId: prospectIdStr } = await params;
    const prospectId = parseInt(prospectIdStr);

    if (isNaN(prospectId)) {
      return NextResponse.json({ error: 'Invalid prospect ID' }, { status: 400 });
    }

    const emails = getProspectEmails(prospectId);
    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Failed to get prospect emails:', error);
    return NextResponse.json(
      { error: 'Failed to get emails' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ prospectId: string }> }
) {
  try {
    const { prospectId: prospectIdStr } = await params;
    const prospectId = parseInt(prospectIdStr);

    if (isNaN(prospectId)) {
      return NextResponse.json({ error: 'Invalid prospect ID' }, { status: 400 });
    }

    const prospect = getProspect(prospectId);
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    const body = await request.json();
    const { subject, body: emailBody, reasoning, key_insights, email_type, research_context } = body;

    if (!subject || !emailBody) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }

    const email = createProspectEmail({
      prospect_id: prospectId,
      account_id: prospect.account_id,
      subject,
      body: emailBody,
      reasoning: reasoning || undefined,
      key_insights: key_insights || undefined,
      email_type: email_type || 'cold',
      research_context: research_context || 'auth0',
    });

    return NextResponse.json({ email });
  } catch (error) {
    console.error('Failed to create prospect email:', error);
    return NextResponse.json(
      { error: 'Failed to create email' },
      { status: 500 }
    );
  }
}
