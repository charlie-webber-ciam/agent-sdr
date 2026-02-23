import { NextResponse } from 'next/server';
import { getQlImportJob, getProspectsByIds, getProspectEmails } from '@/lib/db';
import type { ProspectEmail } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId: jobIdStr } = await params;
    const jobId = parseInt(jobIdStr, 10);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = getQlImportJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!job.prospect_ids) {
      return NextResponse.json({ prospects: [], emails: {} });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(job.prospect_ids);
    } catch {
      return NextResponse.json({ prospects: [], emails: {} });
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json({ prospects: [], emails: {} });
    }

    // Handle both legacy number[] and new {id, status}[] formats
    const statusMap = new Map<number, string>();
    const ids: number[] = [];

    for (const entry of parsed) {
      if (typeof entry === 'number') {
        // Legacy format
        ids.push(entry);
        statusMap.set(entry, 'unknown');
      } else if (entry && typeof entry === 'object' && 'id' in entry) {
        const obj = entry as { id: number; status: string };
        ids.push(obj.id);
        statusMap.set(obj.id, obj.status);
      }
    }

    // Deduplicate ids while preserving first occurrence's status
    const uniqueIds = [...new Set(ids)];
    const prospects = getProspectsByIds(uniqueIds);

    // Attach email_gen_status to each prospect
    const prospectsWithStatus = prospects.map(p => ({
      ...p,
      email_gen_status: statusMap.get(p.id) || 'unknown',
    }));

    const emails: Record<number, ProspectEmail[]> = {};
    for (const p of prospects) {
      const prospectEmails = getProspectEmails(p.id);
      if (prospectEmails.length > 0) {
        emails[p.id] = prospectEmails;
      }
    }

    return NextResponse.json({ prospects: prospectsWithStatus, emails });
  } catch (error) {
    console.error('QL import prospects GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
