'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';

interface JobStatus {
  id: number;
  filename: string;
  total_accounts: number;
  processed_count: number;
  removed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_company: string | null;
  output_filename: string | null;
  paused?: number; // SQLite boolean (0/1)
  created_at: string;
  results: {
    total: number;
    valid: number;
    duplicates: number;
    inactive: number;
    failed: number;
  };
}

export default function PreprocessProgressPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchJobStatus = async () => {
      try {
        const res = await fetch(`/api/preprocess/jobs/${jobId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch job status');
        }
        const data = await res.json();
        setJob(data);
        // Return whether job is still active
        return data.status === 'processing' || data.status === 'pending';
      } catch (err) {
        console.error('Error fetching job status:', err);
        setError(err instanceof Error ? err.message : 'Failed to load job');
        return false;
      }
    };

    fetchJobStatus();

    // Poll every 3 seconds, checking job status on each poll
    const interval = setInterval(async () => {
      const isActive = await fetchJobStatus();
      // Interval will keep running but only fetch when active
      if (!isActive) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]); // Only depend on jobId, not job status

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/preprocess/download/${jobId}`);
      if (!res.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = job?.output_filename || `cleaned_accounts_${jobId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/preprocess/jobs/${jobId}/pause`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pause job');
      // Refresh job status
      const statusRes = await fetch(`/api/preprocess/jobs/${jobId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setJob(data);
      }
    } catch (err) {
      console.error('Pause error:', err);
      alert('Failed to pause job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/preprocess/jobs/${jobId}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resume job');
      // Refresh job status
      const statusRes = await fetch(`/api/preprocess/jobs/${jobId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setJob(data);
      }
    } catch (err) {
      console.error('Resume error:', err);
      alert('Failed to resume job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this job? This cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/preprocess/jobs/${jobId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to cancel job');
      // Refresh job status
      const statusRes = await fetch(`/api/preprocess/jobs/${jobId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setJob(data);
      }
    } catch (err) {
      console.error('Cancel error:', err);
      alert('Failed to cancel job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job and all its data? This cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/preprocess/jobs/${jobId}/delete`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete job');
      // Redirect to dashboard
      router.push('/');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete job');
      setActionLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = job.total_accounts > 0
    ? Math.round((job.processed_count / job.total_accounts) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navigation />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Preprocessing Progress
          </h1>
          <p className="text-gray-600">{job.filename}</p>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center mb-6">
          {job.status === 'pending' && (
            <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              ⏳ Pending
            </span>
          )}
          {job.status === 'processing' && job.paused === 1 && (
            <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
              ⏸️ Paused
            </span>
          )}
          {job.status === 'processing' && job.paused === 0 && (
            <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              🔄 Processing
            </span>
          )}
          {job.status === 'completed' && (
            <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              ✅ Completed
            </span>
          )}
          {job.status === 'failed' && (
            <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              ❌ Failed/Cancelled
            </span>
          )}
        </div>

        {/* Control Buttons */}
        {(job.status === 'processing' || job.status === 'pending') && (
          <div className="flex justify-center gap-3 mb-6">
            {job.paused === 0 ? (
              <button
                onClick={handlePause}
                disabled={actionLoading}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                <span>⏸️</span>
                {actionLoading ? 'Pausing...' : 'Pause'}
              </button>
            ) : (
              <button
                onClick={handleResume}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                <span>▶️</span>
                {actionLoading ? 'Resuming...' : 'Resume'}
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
            >
              <span>✖️</span>
              {actionLoading ? 'Cancelling...' : 'Cancel'}
            </button>
          </div>
        )}

        {/* Delete Button for Failed/Completed Jobs */}
        {(job.status === 'failed' || job.status === 'completed') && (
          <div className="flex justify-center mb-6">
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
            >
              <span>🗑️</span>
              {actionLoading ? 'Deleting...' : 'Delete Job'}
            </button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="text-center text-sm text-gray-600">
            {job.processed_count} / {job.total_accounts} companies processed
          </div>

          {job.current_company && job.status === 'processing' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Currently validating:</span> {job.current_company}
              </p>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
            <div className="text-2xl font-bold text-gray-900">{job.results.valid}</div>
            <div className="text-sm text-gray-600">Valid Accounts</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
            <div className="text-2xl font-bold text-gray-900">{job.results.duplicates}</div>
            <div className="text-sm text-gray-600">Duplicates</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-orange-500">
            <div className="text-2xl font-bold text-gray-900">{job.results.inactive}</div>
            <div className="text-sm text-gray-600">Inactive</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
            <div className="text-2xl font-bold text-gray-900">{job.results.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>

        {/* Completion Actions */}
        {job.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <div className="text-3xl mr-4">🎉</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  Preprocessing Complete!
                </h3>
                <p className="text-sm text-green-800 mb-4">
                  Your cleaned CSV file is ready. It contains {job.results.valid} validated accounts.
                  Download it and upload to the main research agent to begin full research.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                  >
                    {downloading ? 'Downloading...' : '📥 Download Cleaned CSV'}
                  </button>
                  <button
                    onClick={() => router.push('/upload')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Upload to Research Agent →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Info */}
        {job.status === 'processing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">What's happening:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Validating company names and domains</li>
              <li>Checking if companies are still in business</li>
              <li>Detecting and removing duplicates</li>
              <li>Building cleaned CSV file</li>
            </ul>
            <p className="text-xs text-blue-600 mt-3">
              This page auto-refreshes every 3 seconds
            </p>
          </div>
        )}

        {/* Failed Info */}
        {job.status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Processing Failed</h3>
            <p className="text-sm text-red-800">
              An error occurred during preprocessing. Please try uploading again.
            </p>
            <button
              onClick={() => router.push('/preprocess')}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
