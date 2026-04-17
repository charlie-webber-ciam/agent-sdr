import { NextResponse } from 'next/server';

import {
  deleteAccountDocument,
  getAccount,
  getAccountDocumentByAccount,
} from '@/lib/db';
import {
  deleteRemoteAccountDocument,
  removeStoredAccountDocument,
} from '@/lib/account-documents';

export async function DELETE(
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

    await removeStoredAccountDocument(document.storage_path);
    await deleteRemoteAccountDocument(document.openai_file_id);
    deleteAccountDocument(document.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account document:', error);
    return NextResponse.json({ error: 'Failed to delete account document' }, { status: 500 });
  }
}
