import { NextResponse } from 'next/server';

import {
  createAccountDocument,
  getAccount,
  getAccountDocuments,
  updateAccountDocument,
} from '@/lib/db';
import {
  ingestAccountPdfDocument,
  serializeAccountDocument,
  storeAccountDocumentFile,
} from '@/lib/account-documents';

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function getUploadFiles(formData: FormData): File[] {
  const values = formData.getAll('files');
  const files = values.filter((value): value is File => value instanceof File);

  if (files.length > 0) return files;

  const single = formData.get('file');
  return single instanceof File ? [single] : [];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (Number.isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const documents = getAccountDocuments(accountId).map((document) => serializeAccountDocument(document, accountId));
    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching account documents:', error);
    return NextResponse.json({ error: 'Failed to fetch account documents' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (Number.isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const files = getUploadFiles(formData);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No PDF files uploaded' }, { status: 400 });
    }

    for (const file of files) {
      if (!isPdfFile(file)) {
        return NextResponse.json({ error: `Only PDF files are supported. Invalid file: ${file.name}` }, { status: 400 });
      }
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: `${file.name} is too large. Maximum size is 20 MB.` }, { status: 400 });
      }
    }

    const uploadedDocuments = [];
    const errors: string[] = [];

    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const storagePath = await storeAccountDocumentFile(accountId, file.name, fileBuffer);

      const created = createAccountDocument({
        account_id: accountId,
        filename: file.name,
        storage_path: storagePath,
        mime_type: file.type || 'application/pdf',
        file_size_bytes: file.size,
        processing_status: 'processing',
      });

      try {
        const ingested = await ingestAccountPdfDocument(account.company_name, file.name, fileBuffer);
        const updated = updateAccountDocument(created.id, {
          openai_file_id: ingested.openaiFileId,
          context_markdown: ingested.contextMarkdown,
          processing_status: 'ready',
          extraction_error: null,
        });

        if (updated) {
          uploadedDocuments.push(serializeAccountDocument(updated, accountId));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to extract document context';
        const updated = updateAccountDocument(created.id, {
          processing_status: 'failed',
          extraction_error: message,
        });

        errors.push(`${file.name}: ${message}`);
        if (updated) {
          uploadedDocuments.push(serializeAccountDocument(updated, accountId));
        }
      }
    }

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments,
      errors,
    });
  } catch (error) {
    console.error('Error uploading account documents:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to upload PDFs' }, { status: 500 });
  }
}
