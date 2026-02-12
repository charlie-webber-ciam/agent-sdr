import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getPreprocessingJob } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const jobIdNum = parseInt(jobId, 10);

    if (isNaN(jobIdNum)) {
      return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
    }

    const job = getPreprocessingJob(jobIdNum);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: 'Job not completed yet' },
        { status: 400 }
      );
    }

    if (!job.output_filename) {
      return NextResponse.json(
        { error: 'Output file not found' },
        { status: 404 }
      );
    }

    // Read CSV file
    const filepath = join(process.cwd(), 'data', 'preprocessed', job.output_filename);
    const csvContent = readFileSync(filepath, 'utf-8');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${job.output_filename}"`,
      },
    });
  } catch (error) {
    console.error('Failed to download CSV:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
