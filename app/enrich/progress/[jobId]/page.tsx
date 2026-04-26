'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { useJobPolling } from '@/lib/hooks/useJobPolling';
import { ProgressBar } from '@/components/ProgressBar';

interface JobData {
  job: {
    id: number;
    type: string;
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

export default function EnrichmentProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { loading } = useJobPolling<JobData>({
    url: `/api/enrichment/jobs/${jobId}`,
    isActive: (data) => data.job.status === 'processing' || data.job.status === 'pending',
    onData: (data) => setJobData(data),
    onError: (err) => setError(err.message),
  });

  if (loading && !jobData) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Spinner />
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
            onClick={() => router.push('/enrich')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Enrichment
          </button>
        </div>
      </main>
    );
  }

  const { job, currentAccount } = jobData;
  const progressPercentage = job.total_accounts > 0
    ? Math.round((job.processed_count / job.total_accounts) * 100)
    : 0;
  const totalDone = job.processed_count + job.failed_count;

  const isProcessing = job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/enrich')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Enrichment
        </button>
        <h1 className="text-4xl font-bold mb-2">{job.name}</h1>
        <p className="text-gray-600">
          Enrichment Job #{job.id} &middot; Type: <span className="font-semibold">{job.type}</span>
        </p>
      </div>

      {/* Status Banner */}
      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-bold">
            Enrichment complete! {job.processed_count} accounts updated.
          </p>
        </div>
      )}
      {isFailed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-bold">Job failed or was cancelled.</p>
        </div>
      )}

      {/* Progress Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Progress</h2>
          {isProcessing && <Spinner />}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{totalDone} / {job.total_accounts} accounts</span>
            <span>{progressPercentage}%</span>
          </div>
          <ProgressBar percentage={progressPercentage} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{job.total_accounts}</p>
            <p className="text-xs text-gray-600">Total</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{job.processed_count}</p>
            <p className="text-xs text-gray-600">Updated</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{job.failed_count}</p>
            <p className="text-xs text-gray-600">Failed</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">
              {job.total_accounts > 0
                ? ((job.processed_count / Math.max(totalDone, 1)) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-xs text-gray-600">Success Rate</p>
          </div>
        </div>
      </div>

      {/* Current Account */}
      {isProcessing && currentAccount && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold mb-3">Currently Processing</h3>
          <div className="border-l-4 border-blue-500 pl-4">
            <p className="font-bold text-gray-900">{currentAccount.company_name}</p>
            {currentAccount.domain && (
              <p className="text-sm text-gray-600">{currentAccount.domain}</p>
            )}
          </div>
        </div>
      )}

      {/* Job Details */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold mb-3">Job Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Created</p>
            <p className="font-medium">{new Date(job.created_at).toLocaleString()}</p>
          </div>
          {job.completed_at && (
            <div>
              <p className="text-gray-500">Completed</p>
              <p className="font-medium">{new Date(job.completed_at).toLocaleString()}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Status</p>
            <p className="font-medium capitalize">{job.status}</p>
          </div>
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium">{job.type}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
