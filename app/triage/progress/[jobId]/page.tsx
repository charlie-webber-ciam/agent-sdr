'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface TierStats {
  auth0: { tierA: number; tierB: number; tierC: number };
  okta: { tierA: number; tierB: number; tierC: number };
  total: number;
}

interface TriageJobData {
  job: {
    id: number;
    filename: string;
    status: string;
    totalAccounts: number;
    processedCount: number;
    failedCount: number;
    progressPercent: number;
    currentAccount: string | null;
    paused: number;
    createdAt: string;
    completedAt: string | null;
  };
  active: boolean;
  tierStats: TierStats | null;
}

export default function TriageProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<TriageJobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  // Read processingJobId from URL search params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setProcessingJobId(urlParams.get('processingJobId'));
  }, []);

  const fetchJobData = async () => {
    if (!processingJobId) return;
    try {
      const res = await fetch(`/api/triage/jobs/${jobId}?processingJobId=${processingJobId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch triage job data');
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

  useEffect(() => {
    if (!processingJobId) return;

    fetchJobData();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/triage/jobs/${jobId}?processingJobId=${processingJobId}`);
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
  }, [jobId, processingJobId]);

  if (loading || !processingJobId) {
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
          <p className="text-red-700">{error || 'Triage job not found'}</p>
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

  const { job, tierStats } = data;
  const isComplete = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isProcessing = job.status === 'processing' || job.status === 'pending';

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Triage Progress</h1>
        <p className="text-gray-600">{job.filename}</p>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-lg p-6 mb-6 ${
          isComplete
            ? 'bg-green-50 border border-green-200'
            : isFailed
            ? 'bg-red-50 border border-red-200'
            : 'bg-blue-50 border border-blue-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-1">
              {isComplete
                ? 'Triage Complete!'
                : isFailed
                ? 'Triage Failed'
                : 'Triaging Accounts...'}
            </h2>
            <p className="text-gray-700">
              {job.processedCount} of {job.totalAccounts} accounts triaged
              {job.failedCount > 0 && ` (${job.failedCount} failed)`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isComplete && (
              <button
                onClick={() => router.push(`/triage/results/${jobId}?processingJobId=${processingJobId}`)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                View Results
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
        {isProcessing && job.currentAccount && (
          <div className="mt-4 p-3 bg-white rounded border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="font-medium">Currently triaging:</span>
              <span className="text-gray-700">{job.currentAccount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Live Tier Breakdown */}
      {tierStats && (tierStats.auth0.tierA + tierStats.auth0.tierB + tierStats.auth0.tierC > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Auth0 Tiers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Auth0 CIAM Triage</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                <p className="text-3xl font-bold text-green-700">{tierStats.auth0.tierA}</p>
                <p className="text-sm text-green-700 font-medium">Tier A</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                <p className="text-3xl font-bold text-blue-700">{tierStats.auth0.tierB}</p>
                <p className="text-sm text-blue-700 font-medium">Tier B</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                <p className="text-3xl font-bold text-gray-700">{tierStats.auth0.tierC}</p>
                <p className="text-sm text-gray-700 font-medium">Tier C</p>
              </div>
            </div>
          </div>

          {/* Okta Tiers */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Okta Workforce Triage</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                <p className="text-3xl font-bold text-green-700">{tierStats.okta.tierA}</p>
                <p className="text-sm text-green-700 font-medium">Tier A</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                <p className="text-3xl font-bold text-blue-700">{tierStats.okta.tierB}</p>
                <p className="text-sm text-blue-700 font-medium">Tier B</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                <p className="text-3xl font-bold text-gray-700">{tierStats.okta.tierC}</p>
                <p className="text-sm text-gray-700 font-medium">Tier C</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Go Home
        </button>
        {isComplete && (
          <button
            onClick={() => router.push(`/triage/results/${jobId}?processingJobId=${processingJobId}`)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Triage Results
          </button>
        )}
      </div>
    </main>
  );
}
