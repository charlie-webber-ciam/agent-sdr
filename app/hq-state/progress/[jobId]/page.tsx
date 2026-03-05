'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function HqStateProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOrphaned, setIsOrphaned] = useState(false);

  const checkJobActive = async (jobStatus: string) => {
    if (jobStatus === 'processing') {
      try {
        const res = await fetch(`/api/hq-state/jobs/${jobId}/active`);
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

  const { loading } = useJobPolling<JobData>({
    url: `/api/hq-state/jobs/${jobId}`,
    isActive: (data) => data.job.status === 'processing' || data.job.status === 'pending',
    onData: (data) => {
      setJobData(data);
      checkJobActive(data.job.status);
    },
    onError: (err) => setError(err.message),
  });

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
            onClick={() => router.push('/hq-state')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to HQ State Assignment
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
          onClick={() => router.push('/hq-state')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to HQ State Assignment
        </button>
        <h1 className="text-4xl font-bold mb-2">{job.name}</h1>
        <p className="text-gray-600">HQ State Assignment Job #{job.id}</p>
      </div>

      {/* Interrupted Banner */}
      {isInterrupted && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="font-medium text-amber-800">Assignment was interrupted</p>
              <p className="text-sm text-amber-700">
                The server may have restarted. {job.total_accounts - job.processed_count} account(s) remaining.
              </p>
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
                  ? 'bg-teal-100 text-teal-800'
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
            <span>Assigning HQ states...</span>
            <span>{progressPercentage}%</span>
          </div>
          <ProgressBar
            percentage={progressPercentage}
            status={isCompleted ? 'complete' : isFailed ? 'failed' : isInterrupted ? 'interrupted' : 'active'}
            activeColor="bg-teal-600"
          />
        </div>

        {/* Current Account */}
        {isProcessing && !isInterrupted && currentAccount && (
          <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Spinner className="w-5 h-5 text-teal-600" />
              <span className="font-semibold text-teal-900">Currently Processing</span>
            </div>
            <div className="text-lg font-bold text-teal-900">
              {currentAccount.company_name}
            </div>
            {currentAccount.domain && (
              <div className="text-sm text-teal-700">{currentAccount.domain}</div>
            )}
          </div>
        )}

        {/* Completion Message */}
        {isCompleted && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold text-green-900">Assignment Complete!</span>
            </div>
            <p className="text-sm text-green-700 mb-3">
              Successfully processed {job.processed_count} accounts.
              {job.failed_count > 0 && ` ${job.failed_count} accounts failed.`}
            </p>
            <button
              onClick={() => router.push('/accounts?hqState=unassigned')}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
            >
              View Unassigned Accounts
            </button>
          </div>
        )}

        {/* Failure Message */}
        {isFailed && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold text-red-900">Assignment Failed</span>
            </div>
            <p className="text-sm text-red-700">
              The HQ state assignment job encountered an error. Please try again.
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
                {job.filters.unassignedOnly ? 'Unassigned Only' : 'All Accounts'}
              </div>
            </div>
            {job.filters.limit && (
              <div>
                <div className="text-sm text-gray-600">Limit</div>
                <div className="font-medium">{job.filters.limit}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
