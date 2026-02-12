'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';

// Utility to format domain display
const formatDomain = (domain: string | null) => {
  if (!domain || domain.includes('.placeholder')) {
    return 'No domain';
  }
  return domain;
};

interface JobData {
  job: {
    id: number;
    filename: string;
    status: string;
    totalAccounts: number;
    processedCount: number;
    failedCount: number;
    progressPercent: number;
    paused: number; // SQLite boolean (0/1)
    createdAt: string;
    completedAt: string | null;
  };
  currentAccount: {
    id: number;
    companyName: string;
    domain: string;
  } | null;
  accounts: Array<{
    id: number;
    companyName: string;
    domain: string;
    industry: string;
    status: string;
    errorMessage: string | null;
    processedAt: string | null;
    auth0AccountOwner: string | null;
  }>;
}

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchJobData = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch job data');
      }
      const jobData = await res.json();
      setData(jobData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/process/${jobId}/pause`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pause job');
      await fetchJobData();
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
      const res = await fetch(`/api/process/${jobId}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resume job');
      await fetchJobData();
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
      const res = await fetch(`/api/process/${jobId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to cancel job');
      await fetchJobData();
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
      const res = await fetch(`/api/process/${jobId}/delete`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete job');
      router.push('/');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete job');
      setActionLoading(false);
    }
  };

  useEffect(() => {
    const fetchAndCheck = async () => {
      await fetchJobData();
    };

    fetchAndCheck();

    // Auto-refresh every 3 seconds, checking status on each poll
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const jobData = await res.json();
        setData(jobData);

        // Stop polling if job is complete
        if (jobData.job.status !== 'processing' && jobData.job.status !== 'pending') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]); // Only depend on jobId, not data state

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error || 'Job not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  const { job, currentAccount, accounts } = data;
  const isComplete = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isProcessing = job.status === 'processing' || job.status === 'pending';
  const isPaused = job.paused === 1;

  const completedAccounts = accounts.filter(a => a.status === 'completed');
  const failedAccounts = accounts.filter(a => a.status === 'failed');

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Research Progress</h1>
        <p className="text-gray-600">{job.filename}</p>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-lg p-6 mb-6 ${
          isComplete
            ? 'bg-green-50 border border-green-200'
            : isFailed
            ? 'bg-red-50 border border-red-200'
            : isPaused
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-blue-50 border border-blue-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-1">
              {isComplete
                ? 'Completed!'
                : isFailed
                ? 'Failed/Cancelled'
                : isPaused
                ? '⏸️ Paused'
                : 'Processing...'}
            </h2>
            <p className="text-gray-700">
              {job.processedCount} of {job.totalAccounts} accounts processed
              {job.failedCount > 0 && ` (${job.failedCount} failed)`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isComplete && (
              <button
                onClick={() => router.push('/accounts')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                View All Accounts
              </button>
            )}
            {isProcessing && (
              <>
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                  >
                    <span>▶️</span>
                    {actionLoading ? 'Resuming...' : 'Resume'}
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                  >
                    <span>⏸️</span>
                    {actionLoading ? 'Pausing...' : 'Pause'}
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
              </>
            )}
            {(isFailed || isComplete) && (
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                <span>🗑️</span>
                {actionLoading ? 'Deleting...' : 'Delete Job'}
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                isComplete ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${job.progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>{job.progressPercent}% complete</span>
            <span>
              {job.processedCount} / {job.totalAccounts}
            </span>
          </div>
        </div>

        {/* Current Account */}
        {isProcessing && currentAccount && (
          <div className="mt-4 p-3 bg-white rounded border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="font-medium">Currently researching:</span>
              <span className="text-gray-700">
                {currentAccount.companyName} ({currentAccount.domain})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold">Accounts</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {accounts.map((account) => (
            <div key={account.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-lg">{account.companyName}</h4>
                  <p className="text-sm text-gray-600">
                    {formatDomain(account.domain)} • {account.industry}
                  </p>
                  {account.auth0AccountOwner && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {account.auth0AccountOwner}
                    </p>
                  )}
                  {account.errorMessage && (
                    <p className="text-sm text-red-600 mt-1">
                      Error: {account.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {account.status === 'completed' && (
                    <>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✓ Completed
                      </span>
                      <button
                        onClick={() => router.push(`/accounts/${account.id}`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        View
                      </button>
                    </>
                  )}
                  {account.status === 'processing' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      Processing...
                    </span>
                  )}
                  {account.status === 'failed' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      Failed
                    </span>
                  )}
                  {account.status === 'pending' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Go Home
        </button>
        {completedAccounts.length > 0 && (
          <button
            onClick={() => router.push('/accounts')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Completed Accounts ({completedAccounts.length})
          </button>
        )}
      </div>
    </main>
  );
}
