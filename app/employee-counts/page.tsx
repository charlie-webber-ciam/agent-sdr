'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeeCountsPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
      } else {
        setError('Please upload a CSV file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
      } else {
        setError('Please upload a CSV file');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Upload CSV
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/employee-counts/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Failed to upload file');
      }

      // Start processing
      const startRes = await fetch('/api/employee-counts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: uploadData.jobId,
          accounts: uploadData.accounts,
        }),
      });

      const startData = await startRes.json();

      if (!startRes.ok) {
        throw new Error(startData.error || 'Failed to start processing');
      }

      // Redirect to progress page
      router.push(`/employee-counts/progress/${uploadData.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Employee Count Enrichment</h1>
            <p className="text-gray-600">
              Upload a CSV with up to 15,000+ account names to get LinkedIn and D&B employee counts
            </p>
          </div>
          <button
            onClick={() => router.push('/employee-counts/jobs')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View All Jobs
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">CSV Format Requirements</h2>
          <p className="text-gray-600 mb-4">
            Required column: <strong>account_name</strong> or <strong>company_name</strong>
          </p>
          <div className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-sm">
            account_name
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Example:<br/>
            "Acme Corporation"<br/>
            "Tech Innovations LLC"<br/>
            "Global Finance Inc"
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />

            {!file ? (
              <div>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-lg mb-2">
                  <label
                    htmlFor="file-upload"
                    className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium"
                  >
                    Click to upload
                  </label>
                  {' '}or drag and drop
                </p>
                <p className="text-sm text-gray-500">CSV file with account names</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center mb-4">
                  <svg
                    className="h-8 w-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="font-medium text-lg mb-1">{file.name}</p>
                <p className="text-sm text-gray-500 mb-4">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
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
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              disabled={!file || uploading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Starting Enrichment...' : 'Start Employee Count Enrichment'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              disabled={uploading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-8 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Processing Details:</strong>
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
              <li>Processes 50 accounts concurrently for fast results</li>
              <li>Searches LinkedIn and Dun & Bradstreet for each company</li>
              <li>Uses gpt-5-nano model for cost efficiency</li>
              <li>Handles 15,000+ accounts efficiently</li>
            </ul>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Output Format:</strong> CSV file with three columns:
            </p>
            <ul className="text-sm text-green-700 mt-2 space-y-1 list-disc list-inside">
              <li>Account Name</li>
              <li>LinkedIn Employee Count</li>
              <li>D&B Employee Count</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
