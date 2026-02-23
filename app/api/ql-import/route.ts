import { NextResponse } from 'next/server';
import { parseQlText } from '@/lib/ql-parser';
import { createQlImportJob, listQlImportJobs } from '@/lib/db';
import { processQlImportJob } from '@/lib/ql-import-processor';

export async function POST(request: Request) {
  try {
    const { rawText } = await request.json();

    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    const { leads, parseErrors } = parseQlText(rawText);

    if (leads.length === 0) {
      return NextResponse.json(
        { error: 'No valid leads found in the pasted text', parseErrors },
        { status: 400 }
      );
    }

    const jobId = createQlImportJob(leads.length, rawText);

    // Fire-and-forget
    processQlImportJob(jobId, leads).catch(err => {
      console.error(`QL import job ${jobId} background error:`, err);
    });

    return NextResponse.json({
      jobId,
      totalLeads: leads.length,
      parseErrors,
    });
  } catch (error) {
    console.error('QL import POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const jobs = listQlImportJobs(20);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('QL import GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
