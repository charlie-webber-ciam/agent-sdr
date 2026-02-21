'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ImportResult {
  jobId: number;
  totalContacts: number;
  matchedCount: number;
  unmatchedCount: number;
  createdCount: number;
  unmatchedContacts: Array<Record<string, string>>;
}

type Phase = 'upload' | 'results';

export default function ProspectImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('upload');
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    if (e.dataTransfer.files?.[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.endsWith('.csv') || f.type === 'text/csv') {
        setFile(f);
      } else {
        setError('Please upload a CSV file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      if (f.name.endsWith('.csv') || f.type === 'text/csv') {
        setFile(f);
      } else {
        setError('Please upload a CSV file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/prospects/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      setPhase('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  if (phase === 'results' && result) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/prospects')}
          className="text-blue-600 hover:text-blue-700 mb-6 flex items-center gap-2 font-medium transition-colors"
        >
          &larr; Back to Prospects
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">Import Results</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-3xl font-bold text-gray-900">{result.totalContacts}</div>
            <div className="text-sm text-gray-500 mt-1">Total Contacts</div>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-5 text-center">
            <div className="text-3xl font-bold text-green-700">{result.matchedCount}</div>
            <div className="text-sm text-gray-500 mt-1">Matched</div>
          </div>
          <div className="bg-white rounded-xl border border-blue-200 p-5 text-center">
            <div className="text-3xl font-bold text-blue-700">{result.createdCount}</div>
            <div className="text-sm text-gray-500 mt-1">Created</div>
          </div>
          <div className="bg-white rounded-xl border border-orange-200 p-5 text-center">
            <div className="text-3xl font-bold text-orange-700">{result.unmatchedCount}</div>
            <div className="text-sm text-gray-500 mt-1">Unmatched</div>
          </div>
        </div>

        {/* Unmatched contacts */}
        {result.unmatchedContacts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
              <h2 className="text-lg font-semibold text-orange-800">
                Unmatched Contacts ({result.unmatchedCount})
              </h2>
              <p className="text-sm text-orange-600 mt-1">
                These contacts could not be matched to existing accounts. Add the accounts first, then re-import.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Email</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Account</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Title</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.unmatchedContacts.map((c, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm text-gray-900">
                        {c.first_name} {c.last_name}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{c.email || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-orange-600 font-medium">
                        {c.account_name || 'No account'}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600">{c.title || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/prospects')}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Prospects
          </button>
          <button
            onClick={() => { setPhase('upload'); setFile(null); setResult(null); }}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Import More
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/prospects')}
        className="text-blue-600 hover:text-blue-700 mb-6 flex items-center gap-2 font-medium transition-colors"
      >
        &larr; Back to Prospects
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Import Salesforce Contacts</h1>
      <p className="text-gray-500 mb-8">
        Upload a Salesforce contact export CSV. Contacts will be automatically matched to existing accounts by company name.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
      )}

      {/* Upload zone */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : file
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {file ? (
            <div>
              <svg className="w-12 h-12 mx-auto text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                onClick={() => setFile(null)}
                className="mt-3 text-sm text-red-500 hover:text-red-600 font-medium"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-lg text-gray-600">Drag and drop your CSV file here</p>
              <p className="text-sm text-gray-400 mt-1">or</p>
              <label className="mt-3 inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                Browse Files
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          )}
        </div>

        {file && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Importing...
                </span>
              ) : (
                'Upload & Import'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Expected format */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Expected CSV Format</h3>
        <p className="text-sm text-gray-600 mb-3">
          Standard Salesforce contact export format. The following columns are recognized:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {['First Name', 'Last Name', 'Account Name', 'Title', 'Email', 'Phone', 'Department',
            'Mailing Address', 'Lead Source', 'Do Not Call', 'Description', 'LinkedIn URL'].map(col => (
            <span key={col} className="text-xs font-mono bg-white px-2 py-1 rounded border border-gray-200 text-gray-700">
              {col}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
