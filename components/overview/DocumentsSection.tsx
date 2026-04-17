'use client';

import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import MarkdownContent from '@/components/MarkdownContent';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronDown, Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';

type AccountDocument = {
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
};

interface DocumentsSectionProps {
  documents: AccountDocument[];
  onUpload: (files: FileList | null) => Promise<void>;
  onRemove: (documentId: number) => void;
  uploadingDocuments: boolean;
  removingDocumentId: number | null;
  documentError: string | null;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function getStatusBadge(status: AccountDocument['processingStatus']) {
  switch (status) {
    case 'ready':
      return <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">Ready</Badge>;
    case 'failed':
      return <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700">Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700">Processing</Badge>;
  }
}

export default function DocumentsSection({
  documents,
  onUpload,
  onRemove,
  uploadingDocuments,
  removingDocumentId,
  documentError,
}: DocumentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Attached Documents</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Upload annual reports, strategy decks, or architecture docs. Extracted context is reused across all generations.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingDocuments || removingDocumentId !== null}
            className="h-7"
          >
            {uploadingDocuments ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-1 h-3 w-3" />
                Upload PDFs
              </>
            )}
          </Button>
        </div>
      </div>

      {documentError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{documentError}</AlertDescription>
        </Alert>
      )}

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-10 text-center">
          <FileText className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No PDFs attached yet</p>
          <p className="mt-1 text-xs text-gray-400">Upload documents to add durable account context beyond web research.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingDocuments}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload PDFs
          </Button>
        </div>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2 pr-3">
            {documents.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-gray-400" />
                      <h4 className="text-sm font-medium text-gray-900">{doc.filename}</h4>
                      {getStatusBadge(doc.processingStatus)}
                      <Badge variant="outline" className="text-[10px] border-gray-200">{formatFileSize(doc.fileSizeBytes)}</Badge>
                    </div>
                    <p className="text-[10px] text-gray-400">Uploaded {formatTimestamp(doc.uploadedAt)}</p>
                    {doc.extractionError && (
                      <p className="text-xs text-red-600">{doc.extractionError}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <a href={doc.downloadUrl} target="_blank" rel="noreferrer" title="Open PDF">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => onRemove(doc.id)}
                      disabled={removingDocumentId === doc.id || uploadingDocuments}
                      title="Remove PDF"
                    >
                      {removingDocumentId === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {doc.processingStatus === 'ready' && doc.contextMarkdown && (
                  <Collapsible className="mt-2">
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className="h-3 w-3" />
                      View extracted context
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/80 p-3">
                        <MarkdownContent content={doc.contextMarkdown} compact />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
