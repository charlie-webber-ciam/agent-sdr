import { NextResponse } from 'next/server';
import { getBulkEmailJob, getBulkEmailJobEmails } from '@/lib/db';

/**
 * GET /api/bulk-email/jobs/[jobId]
 *
 * Get status and progress for a bulk email job.
 * Optionally include generated emails with ?emails=true.
 */
export async function GET(
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

    const { searchParams } = new URL(request.url);
    const includeEmails = searchParams.get('emails') === 'true';

    const response: any = { success: true, job };

    if (includeEmails && (job.status === 'completed' || job.emails_generated > 0)) {
      response.emails = getBulkEmailJobEmails(id);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get bulk email job:', error);
    return NextResponse.json({ error: 'Failed to get job details' }, { status: 500 });
  }
}
