import { NextResponse } from 'next/server';
import { getBulkEmailJob, getBulkEmailJobEmails, updateProspectEmailExportStatus } from '@/lib/db';

/**
 * POST /api/bulk-email/jobs/[jobId]/export
 *
 * Export generated emails as CSV for Salesloft/Outreach import.
 *
 * Body (optional):
 * - emailIds: number[] - specific email IDs to export (defaults to all)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const id = parseInt(jobId, 10);

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = getBulkEmailJob(id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let emails = getBulkEmailJobEmails(id);

    const body = await request.json().catch(() => ({}));
    if (body.emailIds && Array.isArray(body.emailIds)) {
      const idSet = new Set(body.emailIds);
      emails = emails.filter((e) => idSet.has(e.id));
    }

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No emails to export' }, { status: 400 });
    }

    // Build CSV
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Title',
      'Company',
      'Domain',
      'Subject',
      'Body',
      'Email Type',
      'Research Context',
    ];

    const escapeCSV = (val: string | null | undefined): string => {
      if (!val) return '';
      const s = val.replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const rows = emails.map((e) => [
      escapeCSV(e.first_name),
      escapeCSV(e.last_name),
      escapeCSV(e.prospect_email),
      escapeCSV(e.title),
      escapeCSV(e.company_name),
      escapeCSV(e.domain),
      escapeCSV(e.subject),
      escapeCSV(e.body),
      escapeCSV(e.email_type),
      escapeCSV(e.research_context),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    // Mark exported
    const exportedIds = emails.map((e) => e.id);
    updateProspectEmailExportStatus(exportedIds, 'exported');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bulk-emails-job-${id}.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export bulk emails:', error);
    return NextResponse.json({ error: 'Failed to export emails' }, { status: 500 });
  }
}
