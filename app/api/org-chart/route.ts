import { NextResponse } from 'next/server';
import { getAllOrgCharts } from '@/lib/org-chart-db';

export async function GET() {
  const charts = getAllOrgCharts();
  return NextResponse.json({ charts });
}
