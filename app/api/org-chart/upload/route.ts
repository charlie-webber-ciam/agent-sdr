import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { validateAndBuildOrgChart } from '@/lib/org-chart-agent';
import { createOrgChart } from '@/lib/org-chart-db';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });
    }

    const csvText = await file.text();

    // Quick sanity check: parse to ensure it's valid CSV
    try {
      const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
      if (records.length === 0) {
        return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
      }
      if (records.length > 500) {
        return NextResponse.json({ error: 'CSV exceeds 500 row limit' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid CSV format' }, { status: 400 });
    }

    // Send to agent for validation and hierarchy building
    const agentResult = await validateAndBuildOrgChart(csvText);

    if (agentResult.people.length === 0) {
      return NextResponse.json(
        { error: 'Agent could not extract any people from the CSV', warnings: agentResult.warnings },
        { status: 400 }
      );
    }

    // Save to database
    const { chartId, totalPeople } = createOrgChart(
      agentResult.chartName,
      agentResult.people,
      agentResult.warnings.length > 0 ? agentResult.warnings : undefined
    );

    return NextResponse.json({
      chartId,
      chartName: agentResult.chartName,
      totalPeople,
      warnings: agentResult.warnings,
    });
  } catch (error) {
    console.error('[org-chart/upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process org chart CSV' },
      { status: 500 }
    );
  }
}
