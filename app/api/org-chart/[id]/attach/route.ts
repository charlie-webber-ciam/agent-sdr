import { NextResponse } from 'next/server';
import { attachOrgChartToAccount, detachOrgChart, getOrgChart } from '@/lib/org-chart-db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chartId = parseInt(id, 10);
  if (isNaN(chartId)) {
    return NextResponse.json({ error: 'Invalid chart ID' }, { status: 400 });
  }

  const body = await request.json();
  const { accountId } = body;

  if (!accountId || typeof accountId !== 'number') {
    return NextResponse.json({ error: 'accountId is required and must be a number' }, { status: 400 });
  }

  const attached = attachOrgChartToAccount(chartId, accountId);
  if (!attached) {
    return NextResponse.json({ error: 'Org chart not found' }, { status: 404 });
  }

  const chart = getOrgChart(chartId);
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

  const detached = detachOrgChart(chartId);
  if (!detached) {
    return NextResponse.json({ error: 'Org chart not found' }, { status: 404 });
  }

  const chart = getOrgChart(chartId);
  return NextResponse.json(chart);
}
