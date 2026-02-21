import { NextResponse } from 'next/server';
import { importOpportunityCSV } from '@/lib/opportunity-importer';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });
    }

    const csvContent = await file.text();

    if (!csvContent.trim()) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }

    const result = await importOpportunityCSV(csvContent, file.name);

    return NextResponse.json({
      jobId: result.jobId,
      totalRows: result.totalRows,
      uniqueOpportunities: result.uniqueOpportunities,
      uniqueContacts: result.uniqueContacts,
      matched: result.matchedAccounts.map(m => ({
        accountName: m.accountName,
        status: m.status,
        matchedAccountId: m.matchedAccount?.id,
        matchedAccountName: m.matchedAccount?.company_name,
      })),
      unmatched: result.unmatchedAccounts.map(m => ({
        accountName: m.accountName,
      })),
      ambiguous: result.ambiguousAccounts.map(m => ({
        accountName: m.accountName,
        candidates: m.candidates?.map(c => ({
          id: c.id,
          companyName: c.company_name,
          domain: c.domain,
          industry: c.industry,
        })),
      })),
      prospectsCreated: result.prospectsCreated,
      opportunitiesCreated: result.opportunitiesCreated,
      championsTagged: result.championsTagged,
    });
  } catch (error) {
    console.error('Opportunity import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
