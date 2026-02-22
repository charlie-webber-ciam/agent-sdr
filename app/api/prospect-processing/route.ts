import { NextResponse } from 'next/server';
import { getAllProspectProcessingJobs, createProspectProcessingJob, getProspectsForProcessing } from '@/lib/db';

export async function GET() {
  try {
    const jobs = getAllProspectProcessingJobs(20);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Error fetching prospect processing jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, job_subtype, filters } = body;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const prospects = getProspectsForProcessing(filters || {});
    if (prospects.length === 0) {
      return NextResponse.json({ error: 'No prospects match the specified filters' }, { status: 400 });
    }

    const jobId = createProspectProcessingJob({
      name,
      total_prospects: prospects.length,
      filters: filters ? JSON.stringify(filters) : undefined,
      job_subtype: job_subtype || 'classify',
    });

    return NextResponse.json({ jobId, totalProspects: prospects.length }, { status: 201 });
  } catch (error) {
    console.error('Error creating prospect processing job:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
