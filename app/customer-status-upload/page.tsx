'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ImportResult {
  totalRows: number;
  processedRows: number;
  csvDuplicates: number;
  matchedRows: number;
  updatedAccounts: number;
  createdAccounts: number;
  clearedAccounts: number;
  message: string;
}

export default function CustomerStatusUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFile = (nextFile: File | null) => {
    setError(null);
    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.type === 'text/csv' || nextFile.name.endsWith('.csv')) {
      setFile(nextFile);
      return;
    }

    setError('Please upload a CSV file.');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/accounts/customer-status-import', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        const details = Array.isArray(payload.details) ? ` ${payload.details.join(' · ')}` : '';
        throw new Error(`${payload.error || 'Import failed'}${details}`);
      }

      setResult(payload);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to import customer statuses.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setError(null);
    setResult(null);
  };

  if (result) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">Customer Status Upload</h1>
          <p className="text-gray-600">Bulk update existing accounts and create missing ones from a CSV report.</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-800">Import Complete</h2>
              <p className="text-gray-600">{file?.name}</p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.totalRows}</p>
              <p className="text-sm text-gray-600">Total rows</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{result.updatedAccounts}</p>
              <p className="text-sm text-blue-700">Accounts updated</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.createdAccounts}</p>
              <p className="text-sm text-green-700">Accounts created</p>
            </div>
            <div className="rounded-lg bg-stone-50 p-4 text-center">
              <p className="text-2xl font-bold text-stone-700">{result.clearedAccounts}</p>
              <p className="text-sm text-stone-700">Cleared to blank</p>
            </div>
          </div>

          {(result.csvDuplicates > 0 || result.processedRows !== result.totalRows) && (
            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                Processed {result.processedRows} unique rows.
                {result.csvDuplicates > 0 ? ` ${result.csvDuplicates} duplicate row${result.csvDuplicates === 1 ? '' : 's'} in the CSV were collapsed to the last occurrence.` : ''}
              </p>
            </div>
          )}

          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">{result.message}</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push('/accounts')}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
            >
              Open Accounts
            </button>
            <button
              onClick={() => router.push('/accounts/map')}
              className="rounded-lg bg-gray-200 px-6 py-3 font-medium text-gray-700 hover:bg-gray-300"
            >
              Open Account Map
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg bg-gray-200 px-6 py-3 font-medium text-gray-700 hover:bg-gray-300"
            >
              Upload Another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold">Customer Status Upload</h1>
        <p className="text-gray-600">
          Upload a report to set `Customer Status` on existing accounts and create any missing accounts.
        </p>
      </div>

      <div className="rounded-lg bg-white p-8 shadow-md">
        <div className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">CSV Format</h2>
          <p className="mb-4 text-gray-600">
            Required columns: <strong>Account Name</strong> and <strong>Customer Status</strong>.
            Extra columns are ignored.
          </p>
          <div className="rounded border border-gray-200 bg-gray-50 p-4 font-mono text-sm">
            Account Name,Customer Status
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Accepted values for Customer Status: blank, Auth0 Customer, Okta Customer, Common Customer.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className={`rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setDragActive(false);
              handleFile(event.dataTransfer.files?.[0] || null);
            }}
          >
            <input
              type="file"
              id="customer-status-file"
              accept=".csv"
              onChange={(event) => handleFile(event.target.files?.[0] || null)}
              disabled={uploading}
              className="hidden"
            />

            {!file ? (
              <div>
                <svg className="mx-auto mb-4 h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mb-2 text-lg">
                  <label htmlFor="customer-status-file" className="cursor-pointer font-medium text-blue-600 hover:text-blue-700">
                    Click to upload
                  </label>{' '}
                  or drag and drop
                </p>
                <p className="text-sm text-gray-500">CSV file, up to 15,000 rows</p>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="mb-1 text-lg font-medium">{file.name}</p>
                <p className="mb-4 text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-sm text-gray-600 hover:text-gray-800"
                  disabled={uploading}
                >
                  Choose different file
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              disabled={!file || uploading}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Importing...' : 'Upload Customer Statuses'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/accounts')}
              disabled={uploading}
              className="rounded-lg bg-gray-200 px-6 py-3 font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
