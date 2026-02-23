'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context';
import { Spinner } from '@/components/Spinner';
import { useJobPolling } from '@/lib/hooks/useJobPolling';
import { capitalize } from '@/lib/utils';
import { ProgressBar } from '@/components/ProgressBar';

interface JobData {
  job: {
    id: number;
    name: string;
    status: string;
    total_accounts: number;
    processed_count: number;
    failed_count: number;
    filters: any;
    created_at: string;
    completed_at: string | null;
  };
  currentAccount: {
    id: number;
    company_name: string;
    domain: string | null;
  } | null;
}

export default function CategorizationProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOrphaned, setIsOrphaned] = useState(false);
  const [restartLoading, setRestartLoading] = useState(false);

  const checkJobActive = async (jobStatus: string) => {
    if (jobStatus === 'processing') {
      try {
        const res = await fetch(`/api/categorization/jobs/${jobId}/active`);
        if (res.ok) {
          const { active } = await res.json();
          setIsOrphaned(!active);
        }
      } catch {
        // If we can't reach the endpoint, don't change orphan state
      }
    } else {
      setIsOrphaned(false);
    }
  };

  const { loading, refetch } = useJobPolling<JobData>({
    url: `/api/categorization/jobs/${jobId}`,
    isActive: (data) => data.job.status === 'processing' || data.job.status === 'pending',
    onData: (data) => {
      setJobData(data);
      checkJobActive(data.job.status);
    },
    onError: (err) => setError(err.message),
  });

  const handleRestart = async () => {
    setRestartLoading(true);
    try {
      const res = await fetch('/api/categorization/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: Number(jobId) }),
      });
      if (!res.ok) {
        toast.error('Failed to restart categorization job');
        return;
      }
      const data = await res.json();
      if (data.newJobId) {
        toast.success('Categorization job restarted');
        router.push(`/categorize/progress/${data.newJobId}`);
      } else {
        toast.info('No remaining accounts to categorize');
        setIsOrphaned(false);
        await refetch();
      }
    } catch {
      toast.error('Failed to restart categorization job');
    } finally {
      setRestartLoading(false);
    }
  };

  const handleCancel = async () => {
    setRestartLoading(true);
    try {
      const res = await fetch('/api/categorization/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: Number(jobId), cancelOnly: true }),
      });
      if (res.ok) {
        toast.info('Categorization job cancelled');
        setIsOrphaned(false);
        await refetch();
      } else {
        toast.error('Failed to cancel job');
      }
    } catch {
      toast.error('Failed to cancel job');
    } finally {
      setRestartLoading(false);
    }
  };

  if (loading && !jobData) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error || !jobData) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error || 'Job not found'}</p>
          <button
            onClick={() => router.push('/categorize')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Categorization
          </button>
        </div>
      </main>
    );
  }

  const { job, currentAccount } = jobData;
  const progressPercentage = job.total_accounts > 0
    ? Math.round((job.processed_count / job.total_accounts) * 100)
    : 0;

  const isProcessing = job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isInterrupted = isProcessing && isOrphaned;

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/categorize')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Categorization
        </button>
        <h1 className="text-4xl font-bold mb-2">{job.name}</h1>
        <p className="text-gray-600">
          Categorization Job #{job.id}
        </p>
      </div>

      {/* Interrupted Banner */}
      {isInterrupted && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="font-medium text-amber-800">Categorization was interrupted</p>
                <p className="text-sm text-amber-700">
                  The server may have restarted. {job.total_accounts - job.processed_count} account(s) remaining.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestart}
                disabled={restartLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 text-sm font-medium transition-colors"
              >
                {restartLoading ? 'Restarting...' : 'Restart Categorization'}
              </button>
              <button
                onClick={handleCancel}
                disabled={restartLoading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <span
              className={`inline-block px-4 py-2 rounded-lg text-lg font-semibold ${
                isCompleted
                  ? 'bg-green-100 text-green-800'
                  : isInterrupted
                  ? 'bg-amber-100 text-amber-800'
                  : isProcessing
                  ? 'bg-blue-100 text-blue-800'
                  : isFailed
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {isInterrupted ? 'Interrupted' : capitalize(job.status)}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Progress</div>
            <div className="text-3xl font-bold">
              {job.processed_count} / {job.total_accounts}
            </div>
            <div className="text-sm text-gray-600">
              {job.failed_count > 0 && `(${job.failed_count} failed)`}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Processing accounts...</span>
            <span>{progressPercentage}%</span>
          </div>
          <ProgressBar
            percentage={progressPercentage}
            status={isCompleted ? 'complete' : isFailed ? 'failed' : isInterrupted ? 'interrupted' : 'active'}
            activeColor="bg-purple-600"
          />
        </div>

        {/* Current Account */}
        {isProcessing && !isInterrupted && currentAccount && (
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Spinner className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">Currently Processing</span>
            </div>
            <div className="text-lg font-bold text-purple-900">
              {currentAccount.company_name}
            </div>
            {currentAccount.domain && (
              <div className="text-sm text-purple-700">{currentAccount.domain}</div>
            )}
          </div>
        )}

        {/* Completion Message */}
        {isCompleted && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-green-600"
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
              <span className="font-semibold text-green-900">Categorization Complete!</span>
            </div>
            <p className="text-sm text-green-700 mb-3">
              Successfully categorized {job.processed_count} accounts.
              {job.failed_count > 0 && ` ${job.failed_count} accounts failed.`}
            </p>
            <button
              onClick={() => router.push('/accounts')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              View Categorized Accounts
            </button>
          </div>
        )}

        {/* Failure Message */}
        {isFailed && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-semibold text-red-900">Categorization Failed</span>
            </div>
            <p className="text-sm text-red-700">
              The categorization job encountered an error. Please try again.
            </p>
          </div>
        )}
      </div>

      {/* Applied Filters */}
      {job.filters && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Applied Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Scope</div>
              <div className="font-medium">
                {job.filters.uncategorizedOnly ? 'Uncategorized Only' : 'All Accounts'}
              </div>
            </div>
            {job.filters.industry && (
              <div>
                <div className="text-sm text-gray-600">Industry</div>
                <div className="font-medium">{job.filters.industry}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-600">Limit</div>
              <div className="font-medium">{job.filters.limit || 'None'}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
