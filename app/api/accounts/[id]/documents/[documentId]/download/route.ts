import { readFile } from 'fs/promises';

import { NextResponse } from 'next/server';

import { getAccount, getAccountDocumentByAccount } from '@/lib/db';
import { getAccountDocumentAbsolutePath } from '@/lib/account-documents';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { id, documentId } = await params;
    const accountId = parseInt(id, 10);
    const parsedDocumentId = parseInt(documentId, 10);

    if (Number.isNaN(accountId) || Number.isNaN(parsedDocumentId)) {
      return NextResponse.json({ error: 'Invalid account or document ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const document = getAccountDocumentByAccount(accountId, parsedDocumentId);
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const fileBuffer = await readFile(getAccountDocumentAbsolutePath(document.storage_path));

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': document.mime_type || 'application/pdf',
        'Content-Disposition': `inline; filename="${document.filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error downloading account document:', error);
    return NextResponse.json({ error: 'Failed to download account document' }, { status: 500 });
  }
}
