import { NextResponse } from 'next/server';
import { updateProspectEmailContent } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId: emailIdStr } = await params;
    const emailId = parseInt(emailIdStr);

    if (isNaN(emailId)) {
      return NextResponse.json({ error: 'Invalid email ID' }, { status: 400 });
    }

    const body = await request.json();
    const { subject, body: emailBody } = body;

    if (!subject || !emailBody) {
      return NextResponse.json(
        { error: 'Subject and body are required' },
        { status: 400 }
      );
    }

    updateProspectEmailContent(emailId, subject.trim(), emailBody.trim());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update email content:', error);
    return NextResponse.json(
      { error: 'Failed to update email' },
      { status: 500 }
    );
  }
}
