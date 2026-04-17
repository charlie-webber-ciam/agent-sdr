import { NextResponse } from 'next/server';
import { getOrgChart, deleteOrgChart } from '@/lib/org-chart-db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chartId = parseInt(id, 10);
  if (isNaN(chartId)) {
    return NextResponse.json({ error: 'Invalid chart ID' }, { status: 400 });
  }

  const chart = getOrgChart(chartId);
  if (!chart) {
    return NextResponse.json({ error: 'Org chart not found' }, { status: 404 });
  }

  return NextResponse.json(chart);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chartId = parseInt(id, 10);
  if (isNaN(chartId)) {
    return NextResponse.json({ error: 'Invalid chart ID' }, { status: 400 });
  }

  const deleted = deleteOrgChart(chartId);
  if (!deleted) {
    return NextResponse.json({ error: 'Org chart not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
