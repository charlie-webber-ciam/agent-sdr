import { NextRequest, NextResponse } from 'next/server';
import { getAccountsByIds, getAccountsWithFilters } from '@/lib/db';
import { generateCSV, generateJSON, generateJavaScript, getExportFilename } from '@/lib/export-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountIds, filters, format } = body;

    // Validate format
    if (!format || !['csv', 'json', 'js'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be csv, json, or js' },
        { status: 400 }
      );
    }

    // Fetch accounts based on selection method
    let accounts;
    if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
      // Export selected accounts
      accounts = getAccountsByIds(accountIds);
    } else if (filters) {
      // Export filtered accounts (remove limit/offset for full export)
      const exportFilters = { ...filters };
      delete exportFilters.limit;
      delete exportFilters.offset;
      const result = getAccountsWithFilters(exportFilters);
      accounts = result.accounts;
    } else {
      return NextResponse.json(
        { error: 'Either accountIds or filters must be provided' },
        { status: 400 }
      );
    }

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found to export' },
        { status: 404 }
      );
    }

    // Generate export content based on format
    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        content = generateCSV(accounts);
        contentType = 'text/csv';
        filename = getExportFilename('csv');
        break;

      case 'json':
        content = generateJSON(accounts, filters);
        contentType = 'application/json';
        filename = getExportFilename('json');
        break;

      case 'js':
        content = generateJavaScript(accounts, filters);
        contentType = 'application/javascript';
        filename = getExportFilename('js', 'data');
        break;

      default:
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        );
    }

    // Return file download response
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export accounts' },
      { status: 500 }
    );
  }
}
