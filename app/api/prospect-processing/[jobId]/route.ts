import { NextResponse } from 'next/server';
import { getProspectProcessingJob, getProspect } from '@/lib/db';
import { isProspectJobActive } from '@/lib/prospect-processor';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const id = parseInt(jobId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const job = getProspectProcessingJob(id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    let currentProspect = null;
    if (job.current_prospect_id) {
      currentProspect = getProspect(job.current_prospect_id);
    }

    const active = isProspectJobActive(id);

    let errors: string[] = [];
    if (job.error_log) {
      try { errors = JSON.parse(job.error_log); } catch { errors = []; }
    }

    return NextResponse.json({ job, currentProspect, active, errors });
  } catch (error) {
    console.error('Error fetching prospect processing job:', error);
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}
