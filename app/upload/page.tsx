'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MODELS = [
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'o4-mini', label: 'o4-mini' },
  { value: 'o3', label: 'o3' },
];

interface UploadResult {
  jobId: number;
  totalRecords: number;
  newAccounts: number;
  csvDuplicates: number;
  dbDuplicates: number;
  totalSkipped: number;
  message: string;
  mode: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [mode, setMode] = useState<'triage' | 'research'>('triage');
  const [triageModel, setTriageModel] = useState('gpt-5.2');
  const [startingTriage, setStartingTriage] = useState(false);

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
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to upload file');
      }

      // If triage mode, start the triage job automatically
      if (mode === 'triage') {
        setStartingTriage(true);
        try {
          const triageRes = await fetch('/api/triage/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId: data.jobId,
              model: triageModel,
            }),
          });
          const triageData = await triageRes.json();
          if (!triageRes.ok) {
            throw new Error(triageData.error || 'Failed to start triage');
          }
          // Redirect to triage progress
          router.push(`/triage/progress/${triageData.triageJobId}?processingJobId=${data.jobId}`);
          return;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to start triage');
          setStartingTriage(false);
          setUploading(false);
          return;
        }
      }

      setUploadResult(data);
      setUploading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadResult(null);
    setError(null);
  };

  // Upload complete view (research mode only — triage mode redirects)
  if (uploadResult) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Upload Accounts</h1>
          <p className="text-gray-600">
            Upload a CSV file with up to 10,000 accounts to research
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Success header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-800">Upload Complete</h2>
              <p className="text-gray-600">{file?.name}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{uploadResult.totalRecords}</p>
              <p className="text-sm text-gray-600">Total rows</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{uploadResult.newAccounts}</p>
              <p className="text-sm text-green-700">New accounts</p>
            </div>
            {uploadResult.csvDuplicates > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-700">{uploadResult.csvDuplicates}</p>
                <p className="text-sm text-yellow-700">CSV duplicates</p>
              </div>
            )}
            {uploadResult.dbDuplicates > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-700">{uploadResult.dbDuplicates}</p>
                <p className="text-sm text-yellow-700">Already in DB</p>
              </div>
            )}
          </div>

          {uploadResult.totalSkipped > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-yellow-800">
                  {uploadResult.totalSkipped} record{uploadResult.totalSkipped !== 1 ? 's' : ''} skipped
                  {uploadResult.csvDuplicates > 0 && ` (${uploadResult.csvDuplicates} duplicate${uploadResult.csvDuplicates !== 1 ? 's' : ''} within CSV`}
                  {uploadResult.csvDuplicates > 0 && uploadResult.dbDuplicates > 0 && ', '}
                  {uploadResult.csvDuplicates === 0 && uploadResult.dbDuplicates > 0 && ' ('}
                  {uploadResult.dbDuplicates > 0 && `${uploadResult.dbDuplicates} already in database`}
                  {(uploadResult.csvDuplicates > 0 || uploadResult.dbDuplicates > 0) && ')'}
                </p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>{uploadResult.newAccounts} account{uploadResult.newAccounts !== 1 ? 's' : ''}</strong> ready for research.
              Research is already running in the background. View the progress page to monitor status.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/processing/${uploadResult.jobId}`)}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Research Progress
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Upload Another
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
            >
              Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Upload Accounts</h1>
        <p className="text-gray-600">
          Upload a CSV file with up to 10,000 accounts to research
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">CSV Format Requirements</h2>
          <p className="text-gray-600 mb-4">
            Required column: <strong>Account Name</strong><br/>
            Optional columns: <em>Website</em>, <em>Primary Industry</em>, <em>Auth0 Account Owner</em>, <em>Account Owner</em>
          </p>
          <div className="bg-gray-50 p-4 rounded border border-gray-200 font-mono text-sm">
            Account Name,Website,Primary Industry,Auth0 Account Owner,Account Owner
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Example: &quot;Acme Corp,acme.com,Technology,John Smith,Jane Doe&quot;<br/>
            Missing values are fine: &quot;Private Co,,,,&quot;
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
                <p className="text-sm text-gray-500">CSV file (max 10,000 accounts)</p>
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

          {/* Processing Mode Toggle */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <label className="text-sm font-medium text-gray-700 mb-3 block">Processing Mode</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode('triage')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors text-left ${
                  mode === 'triage'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">
                  {mode === 'triage' && <span className="text-purple-600 mr-1">&#10003;</span>}
                  Triage First
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Quick triage (~15-20s/account) to categorize into tiers, then selectively run full research.
                  Best for large lists.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode('research')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors text-left ${
                  mode === 'research'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">
                  {mode === 'research' && <span className="text-blue-600 mr-1">&#10003;</span>}
                  Research All
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Full research (~45-75s/account) on every account immediately. Best for small lists.
                </p>
              </button>
            </div>

            {/* Model selector for triage mode */}
            {mode === 'triage' && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-sm text-gray-600">Triage model:</label>
                <select
                  value={triageModel}
                  onChange={(e) => setTriageModel(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  {MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
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
              disabled={!file || uploading || startingTriage}
              className={`flex-1 px-6 py-3 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                mode === 'triage'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {uploading || startingTriage ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {startingTriage ? 'Starting Triage...' : 'Uploading...'}
                </>
              ) : mode === 'triage' ? (
                'Upload & Triage First'
              ) : (
                'Upload & Start Research'
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              disabled={uploading || startingTriage}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            {mode === 'triage' ? (
              <>
                <strong>Triage mode:</strong> Each account gets 2-3 quick web searches (~15-20s) to determine tier priority.
                After triage, you can selectively run full research on specific tiers.
              </>
            ) : (
              <>
                <strong>Note:</strong> Processing takes approximately 30-60 seconds per account.
                You&apos;ll be able to monitor progress in real-time after uploading.
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
