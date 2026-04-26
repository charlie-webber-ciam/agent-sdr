'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useJobPolling } from '@/lib/hooks/useJobPolling';
import { ProgressBar } from '@/components/ProgressBar';

interface JobData {
  job: {
    id: number;
    name: string;
    status: string;
    total_prospects: number;
    overviews_needed: number;
    overviews_generated: number;
    overviews_failed: number;
    emails_generated: number;
    emails_failed: number;
    current_stage: string | null;
    email_type: string;
    research_context: string;
    created_at: string;
    completed_at: string | null;
  };
}

export default function BulkEmailProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isActive = (data: JobData) =>
    ['pending', 'generating_overviews', 'generating_emails'].includes(data.job.status);

  const { loading } = useJobPolling<JobData>({
    url: `/api/bulk-email/jobs/${jobId}`,
    isActive,
    onData: (data) => {
      setJobData(data);
      // Auto-redirect to review on completion
      if (data.job.status === 'completed') {
        router.push(`/bulk-email/review/${jobId}`);
      }
    },
    onError: (err) => setError(err.message),
  });

  if (loading && !jobData) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
            onClick={() => router.push('/bulk-email')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Bulk Email
          </button>
        </div>
      </main>
    );
  }

  const { job } = jobData;
  const isOverviewStage = job.current_stage === 'overviews' || job.status === 'generating_overviews';
  const isEmailStage = job.current_stage === 'emails' || job.status === 'generating_emails';
  const isProcessing = isActive(jobData);
  const isFailed = job.status === 'failed';

  const overviewProgress = job.overviews_needed > 0
    ? Math.round(((job.overviews_generated + job.overviews_failed) / job.overviews_needed) * 100)
    : 100;

  const emailProgress = job.total_prospects > 0
    ? Math.round(((job.emails_generated + job.emails_failed) / job.total_prospects) * 100)
    : 0;

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.push('/bulk-email')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Bulk Email
        </button>
        <h1 className="text-4xl font-bold mb-2">Generating Emails</h1>
        <p className="text-gray-600">
          Job #{job.id} &middot; {job.total_prospects} prospects &middot; {job.email_type} &middot; {job.research_context}
        </p>
      </div>

      {isFailed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-bold">Job failed or was cancelled.</p>
        </div>
      )}

      {/* Stage 1: Overviews */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isOverviewStage ? 'bg-blue-600 text-white' :
              overviewProgress === 100 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              1
            </div>
            <div>
              <h2 className="text-lg font-bold">Generate Missing Overviews</h2>
              <p className="text-sm text-gray-500">
                {job.overviews_needed === 0
                  ? 'All accounts already have overviews'
                  : `${job.overviews_needed} accounts need overviews`}
              </p>
            </div>
          </div>
          {isOverviewStage && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
        </div>

        {job.overviews_needed > 0 && (
          <>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{job.overviews_generated + job.overviews_failed} / {job.overviews_needed}</span>
              <span>{overviewProgress}%</span>
            </div>
            <ProgressBar percentage={overviewProgress} />
            {job.overviews_failed > 0 && (
              <p className="text-xs text-red-600 mt-1">{job.overviews_failed} failed</p>
            )}
          </>
        )}
      </div>

      {/* Stage 2: Emails */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              isEmailStage ? 'bg-blue-600 text-white' :
              emailProgress === 100 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
            <div>
              <h2 className="text-lg font-bold">Generate Emails</h2>
              <p className="text-sm text-gray-500">{job.total_prospects} emails to generate</p>
            </div>
          </div>
          {isEmailStage && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
        </div>

        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{job.emails_generated + job.emails_failed} / {job.total_prospects}</span>
          <span>{emailProgress}%</span>
        </div>
        <ProgressBar percentage={emailProgress} />
        {job.emails_failed > 0 && (
          <p className="text-xs text-red-600 mt-1">{job.emails_failed} failed</p>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold mb-3">Summary</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{job.total_prospects}</p>
            <p className="text-xs text-gray-600">Total Prospects</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{job.emails_generated}</p>
            <p className="text-xs text-gray-600">Emails Generated</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{job.emails_failed}</p>
            <p className="text-xs text-gray-600">Failed</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-700">{job.overviews_generated}</p>
            <p className="text-xs text-gray-600">Overviews Generated</p>
          </div>
        </div>

        {isProcessing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing... will redirect to review when complete
          </div>
        )}
      </div>
    </main>
  );
}
