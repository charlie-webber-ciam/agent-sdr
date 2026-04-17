'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X, Users, UserPlus, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type SfdcType = 'contact' | 'lead';

interface AffectedAccount {
  id: number;
  name: string;
  count: number;
}

interface ImportResult {
  totalContacts: number;
  matchedCount: number;
  unmatchedCount: number;
  createdCount: number;
  skippedCount: number;
  updatedCount: number;
  unmatchedContacts: Array<{ name: string; company: string }>;
  affectedAccounts: AffectedAccount[];
}

interface CSVImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  onNavigateToAccount?: (accountId: number) => void;
}

export default function CSVImportDialog({ open, onClose, onImportComplete, onNavigateToAccount }: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [sfdcType, setSfdcType] = useState<SfdcType>('contact');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset state whenever dialog opens
  useEffect(() => {
    if (open) {
      setFile(null);
      setError(null);
      setResult(null);
      setImporting(false);
      setDragOver(false);
    }
  }, [open]);

  const handleFileSelect = useCallback((selected: File | null) => {
    if (selected && selected.name.endsWith('.csv')) {
      setFile(selected);
      setError(null);
      setResult(null);
    } else if (selected) {
      setError('Please select a CSV file');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files?.[0] || null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    handleFileSelect(dropped || null);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleImport = async () => {
    if (!file || importing) return;
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sfdc_type', sfdcType);

      const res = await fetch('/api/prospects/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Import failed');
        return;
      }

      const data: ImportResult = await res.json();
      setResult(data);
      onImportComplete();
    } catch {
      setError('Import failed — check your connection and try again');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (importing) return;
    onClose();
  };

  const handleGoToAccount = (accountId: number) => {
    onClose();
    onNavigateToAccount?.(accountId);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget && !importing) handleClose(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Import Salesforce Report</h3>
          <button
            onClick={handleClose}
            disabled={importing}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          Prospects are automatically matched to accounts by company name.
        </p>

        {/* Report Type Selector */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setSfdcType('contact'); setFile(null); setError(null); setResult(null); }}
            disabled={importing}
            className={cn(
              'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors',
              sfdcType === 'contact'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">Contact Report</p>
              <p className="text-[10px] opacity-70">Existing contacts</p>
            </div>
          </button>
          <button
            onClick={() => { setSfdcType('lead'); setFile(null); setError(null); setResult(null); }}
            disabled={importing}
            className={cn(
              'flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-colors',
              sfdcType === 'lead'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-medium">Lead Report</p>
              <p className="text-[10px] opacity-70">New leads</p>
            </div>
          </button>
        </div>

        {/* File upload area */}
        {!result && (
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={() => { setFile(null); setError(null); }}
                  disabled={importing}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-6 text-center transition-colors',
                  dragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                )}
              >
                <Upload className={cn('h-7 w-7', dragOver ? 'text-blue-500' : 'text-gray-400')} />
                <span className="text-sm text-gray-600">
                  {dragOver ? 'Drop CSV here' : 'Click or drag a CSV file here'}
                </span>
                <span className="text-[10px] text-gray-400">
                  {sfdcType === 'contact'
                    ? 'Contact ID, First Name, Last Name, Title, Email, Phone, Mobile'
                    : 'Lead ID, First Name, Last Name, Title, Email, Company'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-4 space-y-3">
            {/* Summary */}
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-800">
                {result.createdCount} new {sfdcType === 'lead' ? 'leads' : 'contacts'} created
                {result.updatedCount > 0 && `, ${result.updatedCount} existing updated`}
              </p>
              <p className="mt-0.5 text-xs text-green-700">
                {result.matchedCount} matched to accounts
                {result.skippedCount > 0 && ` \u00b7 ${result.skippedCount - result.updatedCount > 0 ? `${result.skippedCount - result.updatedCount} unchanged duplicates` : ''}`}
              </p>
            </div>

            {/* Affected accounts — clickable to navigate */}
            {result.affectedAccounts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Accounts updated:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.affectedAccounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleGoToAccount(a.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-150 bg-gray-50 px-3 py-2 text-left text-sm hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                    >
                      <span className="text-gray-800 group-hover:text-blue-700 truncate">{a.name}</span>
                      <span className="flex items-center gap-1 shrink-0 ml-2 text-xs text-gray-400 group-hover:text-blue-600">
                        {a.count} new
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched */}
            {result.unmatchedCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-sm font-medium text-amber-800">
                  {result.unmatchedCount} not matched to any account
                </p>
                <div className="mt-1 max-h-20 overflow-y-auto text-xs text-amber-700">
                  {result.unmatchedContacts.slice(0, 8).map((c, i) => (
                    <div key={i}>{c.name} — {c.company || 'no company'}</div>
                  ))}
                  {result.unmatchedCount > 8 && (
                    <div className="mt-0.5 italic">...and {result.unmatchedCount - 8} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          {result ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!file || importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${sfdcType === 'lead' ? 'Leads' : 'Contacts'}`
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
