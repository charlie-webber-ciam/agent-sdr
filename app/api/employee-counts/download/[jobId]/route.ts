import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeCountJob, getEmployeeCountResults } from '@/lib/db';
import { stringify } from 'csv-stringify/sync';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = getEmployeeCountJob(parseInt(jobId));

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: 'Job is not completed yet' },
        { status: 400 }
      );
    }

    // Get all results
    const results = getEmployeeCountResults(parseInt(jobId));

    // Convert to CSV format
    const csvData = results.map(result => ({
      'Account Name': result.account_name,
      'LinkedIn Employee Count': result.linkedin_employee_count || 'Not found',
      'D&B Employee Count': result.dnb_employee_count || 'Not found',
    }));

    const csv = stringify(csvData, {
      header: true,
      columns: ['Account Name', 'LinkedIn Employee Count', 'D&B Employee Count'],
    });

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="employee-counts-job-${jobId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate CSV' },
      { status: 500 }
    );
  }
}
