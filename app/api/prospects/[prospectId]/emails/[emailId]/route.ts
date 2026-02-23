import { NextResponse } from 'next/server';
import { updateProspectEmailStatus } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ prospectId: string; emailId: string }> }
) {
  try {
    const { emailId: emailIdStr } = await params;
    const emailId = parseInt(emailIdStr);

    if (isNaN(emailId)) {
      return NextResponse.json({ error: 'Invalid email ID' }, { status: 400 });
    }

    const body = await request.json();
    const { status, sent_at } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const validStatuses = ['draft', 'sent', 'archived'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    updateProspectEmailStatus(
      emailId,
      status,
      status === 'sent' ? (sent_at || new Date().toISOString()) : undefined
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update prospect email:', error);
    return NextResponse.json(
      { error: 'Failed to update email' },
      { status: 500 }
    );
  }
}
