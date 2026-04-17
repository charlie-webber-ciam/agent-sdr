import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { PDFParse } from 'pdf-parse';
import { z } from 'zod';

import { AccountDocumentRow, getAccountDocuments } from './db';

const accountDocumentClient = new OpenAI({
  apiKey: process.env.ACCOUNT_DOCUMENT_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.ACCOUNT_DOCUMENT_BASE_URL || process.env.OPENAI_BASE_URL,
});

const ACCOUNT_DOCUMENT_MODEL = process.env.ACCOUNT_DOCUMENT_MODEL || 'gpt-5.2';
const ACCOUNT_DOCUMENT_REMOTE_FILE_FALLBACK = process.env.ACCOUNT_DOCUMENT_REMOTE_FILE_FALLBACK === 'true';
const ACCOUNT_DOCUMENT_STORAGE_ROOT = join(process.cwd(), 'data', 'account-documents');
const MAX_ATTACHED_DOCUMENT_CONTEXT_CHARS = 12000;
const MAX_ACCOUNT_DOCUMENT_SOURCE_TEXT_CHARS = 60000;
const MIN_ACCOUNT_DOCUMENT_SOURCE_TEXT_CHARS = 200;

const accountDocumentExtractionSchema = z.object({
  summary: z.string(),
  keyFacts: z.array(z.string()).max(8),
  timeline: z.array(z.object({
    dateLabel: z.string(),
    event: z.string(),
  })).max(6),
  auth0Relevance: z.array(z.string()).max(4),
});

type AccountDocumentExtraction = z.infer<typeof accountDocumentExtractionSchema>;

export interface AccountDocumentClient {
  id: number;
  filename: string;
  mimeType: string | null;
  fileSizeBytes: number;
  processingStatus: 'processing' | 'ready' | 'failed';
  extractionError: string | null;
  contextMarkdown: string | null;
  uploadedAt: string;
  updatedAt: string;
  downloadUrl: string;
}

const DOCUMENT_EXTRACTION_INSTRUCTIONS = `You are extracting reusable account intelligence from an uploaded PDF for an Auth0 SDR workspace.

Your job is to turn the PDF into durable context that can improve future research, POVs, emails, and account planning.

Focus on:
- company objectives, operating priorities, and business model signals
- named products, apps, brands, entities, business units, or regions
- customer scale, metrics, launches, transformation programs, and timelines
- security, compliance, identity, login, platform, developer, or customer experience signals
- named executives, teams, or stakeholders when present

Rules:
- Use only the PDF. Never invent or interpolate missing facts.
- Keep the summary concise, factual, and seller-useful.
- Each key fact should be one sentence, specific, and reusable in a prompt.
- Timeline items should only include explicit or strongly indicated time markers from the PDF.
- Auth0 relevance items should follow this pattern: observed signal -> likely identity implication -> why it matters.
- Include page references in parentheses when the document makes them visible, for example (p. 14).
- If the PDF is not meaningfully about the target account, say so clearly in the summary and keep the rest sparse.

Return JSON only that matches the schema exactly.`;

function cleanJsonResponse(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function parseStructuredOutput<T>(raw: string, schema: z.ZodType<T>): T {
  const cleaned = cleanJsonResponse(raw);
  return schema.parse(JSON.parse(cleaned));
}

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim();
  const safe = trimmed
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!safe) return 'attachment.pdf';
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function normalizeExtractedPdfText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sampleDocumentText(text: string): string {
  if (text.length <= MAX_ACCOUNT_DOCUMENT_SOURCE_TEXT_CHARS) {
    return text;
  }

  const excerptCount = 4;
  const separator = '\n\n[...document truncated for length...]\n\n';
  const excerptBudget = Math.max(
    800,
    Math.floor((MAX_ACCOUNT_DOCUMENT_SOURCE_TEXT_CHARS - separator.length * (excerptCount - 1)) / excerptCount)
  );

  const excerpts: string[] = [];
  const maxStart = Math.max(0, text.length - excerptBudget);

  for (let index = 0; index < excerptCount; index += 1) {
    const start = Math.round((maxStart * index) / (excerptCount - 1));
    const excerpt = text.slice(start, start + excerptBudget).trim();
    if (excerpt) {
      excerpts.push(`[Excerpt ${index + 1}/${excerptCount}]\n${excerpt}`);
    }
  }

  return excerpts.join(separator);
}

async function extractPdfText(fileBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const result = await parser.getText();
    const normalized = normalizeExtractedPdfText(result.text || '');

    if (!normalized) {
      throw new Error('The PDF did not contain any extractable text');
    }

    return sampleDocumentText(normalized);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function summarizeAccountDocumentText(
  accountName: string,
  filename: string,
  extractedText: string
): Promise<string> {
  const response = await accountDocumentClient.responses.create({
    model: ACCOUNT_DOCUMENT_MODEL,
    instructions: DOCUMENT_EXTRACTION_INSTRUCTIONS,
    input: [
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              `Target account: ${accountName}`,
              `Document filename: ${filename}`,
              'Extract reusable seller-ready context from this PDF for future account generations.',
              'Use only the text below, which was extracted locally from the uploaded PDF.',
              '',
              'BEGIN EXTRACTED PDF TEXT',
              extractedText,
              'END EXTRACTED PDF TEXT',
            ].join('\n'),
          },
        ],
      },
    ],
    max_output_tokens: 1800,
    temperature: 0.2,
    text: {
      format: zodTextFormat(accountDocumentExtractionSchema, 'account_document_context'),
      verbosity: 'low',
    },
  });

  const raw = response.output_text?.trim();
  if (!raw) {
    throw new Error('Document ingestion returned no content');
  }

  const parsed = parseStructuredOutput(raw, accountDocumentExtractionSchema);
  return formatDocumentContextMarkdown(parsed);
}

async function ingestAccountPdfDocumentViaRemoteFile(
  accountName: string,
  filename: string,
  fileBuffer: Buffer
): Promise<{ openaiFileId: string; contextMarkdown: string }> {
  const uploadedFile = await accountDocumentClient.files.create({
    file: await OpenAI.toFile(fileBuffer, filename, { type: 'application/pdf' }),
    purpose: 'user_data',
  });

  await accountDocumentClient.files.waitForProcessing(uploadedFile.id, {
    pollInterval: 1000,
    maxWait: 5 * 60 * 1000,
  }).catch(() => uploadedFile);

  try {
    const response = await accountDocumentClient.responses.create({
      model: ACCOUNT_DOCUMENT_MODEL,
      instructions: DOCUMENT_EXTRACTION_INSTRUCTIONS,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Target account: ${accountName}`,
                `Document filename: ${filename}`,
                'Extract reusable seller-ready context from this PDF for future account generations.',
              ].join('\n'),
            },
            {
              type: 'input_file',
              file_id: uploadedFile.id,
              filename,
            },
          ],
        },
      ],
      max_output_tokens: 1800,
      temperature: 0.2,
      text: {
        format: zodTextFormat(accountDocumentExtractionSchema, 'account_document_context'),
        verbosity: 'low',
      },
    });

    const raw = response.output_text?.trim();
    if (!raw) {
      throw new Error('Document ingestion returned no content');
    }

    const parsed = parseStructuredOutput(raw, accountDocumentExtractionSchema);
    return {
      openaiFileId: uploadedFile.id,
      contextMarkdown: formatDocumentContextMarkdown(parsed),
    };
  } catch (error) {
    await deleteRemoteAccountDocument(uploadedFile.id);
    throw error;
  }
}

function formatDocumentContextMarkdown(extraction: AccountDocumentExtraction): string {
  const sections: string[] = [];

  sections.push(`### Summary\n${extraction.summary.trim()}`);

  if (extraction.keyFacts.length > 0) {
    sections.push(`### Key Facts\n${extraction.keyFacts.map((fact) => `- ${fact.trim()}`).join('\n')}`);
  }

  if (extraction.timeline.length > 0) {
    sections.push(`### Timeline Signals\n${extraction.timeline.map((item) => `- ${item.dateLabel.trim()}: ${item.event.trim()}`).join('\n')}`);
  }

  if (extraction.auth0Relevance.length > 0) {
    sections.push(`### Identity / Auth0 Relevance\n${extraction.auth0Relevance.map((item) => `- ${item.trim()}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

export function getAccountDocumentAbsolutePath(storagePath: string): string {
  return join(process.cwd(), storagePath);
}

export async function storeAccountDocumentFile(
  accountId: number,
  originalFilename: string,
  fileBuffer: Buffer
): Promise<string> {
  const sanitizedName = sanitizeFilename(originalFilename);
  const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizedName}`;
  const absolutePath = join(ACCOUNT_DOCUMENT_STORAGE_ROOT, String(accountId), storedName);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, fileBuffer);

  return join('data', 'account-documents', String(accountId), storedName);
}

export async function removeStoredAccountDocument(storagePath: string): Promise<void> {
  try {
    await unlink(getAccountDocumentAbsolutePath(storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function ingestAccountPdfDocument(
  accountName: string,
  filename: string,
  fileBuffer: Buffer
): Promise<{ openaiFileId: string | null; contextMarkdown: string }> {
  if (!(process.env.ACCOUNT_DOCUMENT_API_KEY || process.env.OPENAI_API_KEY)) {
    throw new Error('ACCOUNT_DOCUMENT_API_KEY or OPENAI_API_KEY environment variable is not set');
  }

  try {
    const extractedText = await extractPdfText(fileBuffer);

    if (extractedText.length < MIN_ACCOUNT_DOCUMENT_SOURCE_TEXT_CHARS) {
      throw new Error('The PDF did not contain enough extractable text to build account context');
    }

    const contextMarkdown = await summarizeAccountDocumentText(accountName, filename, extractedText);
    return {
      openaiFileId: null,
      contextMarkdown,
    };
  } catch (localExtractionError) {
    if (!ACCOUNT_DOCUMENT_REMOTE_FILE_FALLBACK) {
      throw localExtractionError;
    }

    try {
      return await ingestAccountPdfDocumentViaRemoteFile(accountName, filename, fileBuffer);
    } catch (remoteFileError) {
      throw new Error(
        [
          `Local PDF extraction failed: ${getErrorMessage(localExtractionError)}`,
          `Remote file fallback failed: ${getErrorMessage(remoteFileError)}`,
        ].join(' ')
      );
    }
  }
}

export async function deleteRemoteAccountDocument(openaiFileId: string | null | undefined): Promise<void> {
  if (!openaiFileId || !(process.env.ACCOUNT_DOCUMENT_API_KEY || process.env.OPENAI_API_KEY)) return;

  try {
    await accountDocumentClient.files.delete(openaiFileId);
  } catch (error) {
    console.warn(`Failed to delete remote account document file ${openaiFileId}:`, error);
  }
}

export function serializeAccountDocument(document: AccountDocumentRow, accountId = document.account_id): AccountDocumentClient {
  return {
    id: document.id,
    filename: document.filename,
    mimeType: document.mime_type,
    fileSizeBytes: document.file_size_bytes,
    processingStatus: document.processing_status,
    extractionError: document.extraction_error,
    contextMarkdown: document.context_markdown,
    uploadedAt: document.created_at,
    updatedAt: document.updated_at,
    downloadUrl: `/api/accounts/${accountId}/documents/${document.id}/download`,
  };
}

export function buildAttachedAccountDocumentContext(accountId: number): string {
  const readyDocuments = getAccountDocuments(accountId)
    .filter((document) => document.processing_status === 'ready' && document.context_markdown?.trim());

  if (readyDocuments.length === 0) {
    return '';
  }

  const sections: string[] = [
    'ATTACHED ACCOUNT DOCUMENTS',
    'These PDFs were uploaded by the account team. Treat them as durable, user-supplied account context for future generations. Prefer the most specific document-backed detail when it sharpens the narrative, but do not invent beyond it.',
  ];

  let currentLength = sections.join('\n').length;

  for (const document of readyDocuments) {
    const block = [
      `### ${document.filename}`,
      `Uploaded: ${document.created_at}`,
      document.context_markdown?.trim() || '',
    ].join('\n');

    if (currentLength + block.length > MAX_ATTACHED_DOCUMENT_CONTEXT_CHARS) {
      const remaining = MAX_ATTACHED_DOCUMENT_CONTEXT_CHARS - currentLength;
      if (remaining > 200) {
        sections.push(`${block.slice(0, remaining).trimEnd()}\n[document context truncated]`);
      }
      break;
    }

    sections.push(block);
    currentLength += block.length;
  }

  return sections.join('\n\n');
}
