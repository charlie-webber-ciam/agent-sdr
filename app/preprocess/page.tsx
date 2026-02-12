'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';

export default function PreprocessPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please upload a CSV file');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Upload CSV
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/preprocess/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      const { jobId, companies } = uploadData;

      console.log(`Uploaded ${companies.length} companies for preprocessing`);

      // Start preprocessing
      const startRes = await fetch('/api/preprocess/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, companies }),
      });

      if (!startRes.ok) {
        throw new Error('Failed to start preprocessing');
      }

      // Redirect to progress page
      router.push(`/preprocess/progress/${jobId}`);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navigation />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            🔍 Bulk Account Preprocessing
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Clean and validate large account lists before full research
          </p>
          <p className="text-sm text-gray-500">
            Upload up to 10,000 accounts for quick validation
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="text-2xl mb-2">✅</div>
            <h3 className="font-semibold text-gray-900 mb-1">Validates</h3>
            <p className="text-sm text-gray-600">Company names, domains, and business status</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="text-2xl mb-2">🗑️</div>
            <h3 className="font-semibold text-gray-900 mb-1">Removes</h3>
            <p className="text-sm text-gray-600">Duplicates and inactive companies</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="text-2xl mb-2">📄</div>
            <h3 className="font-semibold text-gray-900 mb-1">Outputs</h3>
            <p className="text-sm text-gray-600">Clean CSV ready for research</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CSV File</h2>

          {/* CSV Format Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Required CSV Format:</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">company_name</span> - Company name (required)
              </p>
              <p>
                <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">industry</span> - Industry (required)
              </p>
              <p>
                <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">domain</span> - Website domain (optional, will be validated)
              </p>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Example: company_name,domain,industry
            </p>
          </div>

          {/* Drag & Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-3">
                <div className="text-4xl">📋</div>
                <p className="text-lg font-semibold text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-600">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-4xl">📁</div>
                <p className="text-lg font-semibold text-gray-900">
                  Drag and drop your CSV file here
                </p>
                <p className="text-sm text-gray-600">or</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Browse Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Upload Button */}
          {file && (
            <div className="mt-6">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Start Preprocessing'
                )}
              </button>
            </div>
          )}
        </div>

        {/* What Happens Next */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What happens next?</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">1.</span>
              <p>Each company is quickly validated using web search (10-15 seconds per company)</p>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">2.</span>
              <p>Duplicates are detected based on domains</p>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">3.</span>
              <p>Inactive/defunct companies are identified and removed</p>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">4.</span>
              <p>A clean CSV file is generated with validated data</p>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-blue-600 mr-3">5.</span>
              <p>Download the cleaned CSV and upload it to the main research agent</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
