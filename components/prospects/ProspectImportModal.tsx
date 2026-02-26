'use client';

import { useState, useRef } from 'react';

interface ProspectImportModalProps {
  accountId: number;
  onClose: () => void;
  onImportComplete: (stats: { created: number; skipped: number }) => void;
}

export default function ProspectImportModal({
  accountId,
  onClose,
  onImportComplete,
}: ProspectImportModalProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'csv'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; hierarchyUpdates: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePasteImport = async () => {
    if (!pasteText.trim()) return;

    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/accounts/${accountId}/prospects/import-paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText, buildHierarchy: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Import failed');
        return;
      }

      setResult({ created: data.created, skipped: data.skipped, hierarchyUpdates: data.hierarchyUpdates });
      onImportComplete({ created: data.created, skipped: data.skipped });
    } catch (err) {
      setError('Network error — please try again');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCsvImport = async (file: File) => {
    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('buildHierarchy', 'true');

      const res = await fetch(`/api/accounts/${accountId}/prospects/import-csv`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Import failed');
        return;
      }

      setResult({ created: data.created, skipped: data.skipped, hierarchyUpdates: data.hierarchyUpdates });
      onImportComplete({ created: data.created, skipped: data.skipped });
    } catch (err) {
      setError('Network error — please try again');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Import Prospects</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('paste')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Paste from ZoomInfo
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'csv'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload CSV
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'paste' ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Copy prospects from a ZoomInfo search results page and paste below. The parser handles the standard ZoomInfo format with name, title, company, industry, and rating.
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste ZoomInfo search results here..."
                className="w-full h-64 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                disabled={isImporting}
              />
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{pasteText.split('\n').filter(l => l.trim()).length} non-empty lines</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Upload a Salesforce CSV export. Expected columns: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">First Name</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Last Name</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Title</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Email</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Phone</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">Account Name</code>, etc.
              </p>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-gray-700">Click to upload CSV</p>
                <p className="text-xs text-gray-400 mt-1">Salesforce classic export format</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvImport(file);
                }}
                disabled={isImporting}
              />
            </div>
          )}

          {/* Status */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {result && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Imported {result.created} prospect{result.created !== 1 ? 's' : ''}.
              {result.skipped > 0 && ` Skipped ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''}.`}
              {result.hierarchyUpdates > 0 && ` Built ${result.hierarchyUpdates} hierarchy relationships.`}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {activeTab === 'paste' && !result && (
            <button
              onClick={handlePasteImport}
              disabled={isImporting || !pasteText.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? (
                <>
                  <svg className="w-4 h-4 inline mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importing &amp; Building Map...
                </>
              ) : (
                'Import & Build Map'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
