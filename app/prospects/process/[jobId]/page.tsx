'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProspectTierBadge from '@/components/prospects/ProspectTierBadge';

interface JobData {
  job: {
    id: number;
    name: string;
    status: string;
    total_prospects: number;
    processed_count: number;
    failed_count: number;
    job_subtype: string;
    filters: any;
    created_at: string;
    completed_at: string | null;
  };
  currentProspect: {
    id: number;
    first_name: string;
    last_name: string;
    title: string | null;
    value_tier: string | null;
  } | null;
  active: boolean;
  errors: string[];
}

export default function ProspectProcessProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobData = async () => {
    try {
      const res = await fetch(`/api/prospect-processing/${unwrappedParams.jobId}`);
      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to fetch job data');
        setLoading(false);
        return false;
      }

      const data = await res.json();
      setJobData(data);
      setLoading(false);
      return data.job.status === 'processing' || data.job.status === 'pending';
    } catch (err) {
      console.error('Failed to fetch job data:', err);
      setError('Failed to load job data');
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    fetchJobData();

    const interval = setInterval(async () => {
      const isActive = await fetchJobData();
      if (!isActive) clearInterval(interval);
    }, 3000);

    return () => clearInterval(interval);
  }, [unwrappedParams.jobId]);

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
          <button onClick={() => router.push('/prospects/process')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Back to Processing
          </button>
        </div>
      </main>
    );
  }

  const { job, currentProspect, errors } = jobData;
  const progressPercentage = job.total_prospects > 0
    ? Math.round(((job.processed_count + job.failed_count) / job.total_prospects) * 100)
    : 0;

  const isProcessing = job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  const SUBTYPE_LABELS: Record<string, string> = {
    classify: 'Classification',
    enrich_hvt: 'HVT Enrichment',
    enrich_mvt: 'MVT Enrichment',
    enrich_lvt: 'LVT Enrichment',
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <button onClick={() => router.push('/prospects/process')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Processing
        </button>
        <h1 className="text-4xl font-bold mb-2">{job.name}</h1>
        <p className="text-gray-600">
          {SUBTYPE_LABELS[job.job_subtype] || job.job_subtype} - Job #{job.id}
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <span className={`inline-block px-4 py-2 rounded-lg text-lg font-semibold ${
              isCompleted ? 'bg-green-100 text-green-800' :
              isProcessing ? 'bg-blue-100 text-blue-800' :
              isFailed ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Progress</div>
            <div className="text-3xl font-bold">{job.processed_count} / {job.total_prospects}</div>
            {job.failed_count > 0 && (
              <div className="text-sm text-red-600">({job.failed_count} failed)</div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Processing prospects...</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                isCompleted ? 'bg-green-600' : isFailed ? 'bg-red-600' : 'bg-purple-600'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Current Prospect */}
        {isProcessing && currentProspect && (
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-purple-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="font-semibold text-purple-900">Currently Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-purple-900">
                {currentProspect.first_name} {currentProspect.last_name}
              </span>
              <ProspectTierBadge tier={currentProspect.value_tier} />
            </div>
            {currentProspect.title && (
              <div className="text-sm text-purple-700">{currentProspect.title}</div>
            )}
          </div>
        )}

        {/* Completion */}
        {isCompleted && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold text-green-900">Processing Complete!</span>
            </div>
            <p className="text-sm text-green-700 mb-3">
              Successfully processed {job.processed_count} prospects.
              {job.failed_count > 0 && ` ${job.failed_count} failed.`}
            </p>
            <button onClick={() => router.push('/prospects')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              View Prospects
            </button>
          </div>
        )}

        {/* Failure */}
        {isFailed && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold text-red-900">Processing Failed</span>
            </div>
            <p className="text-sm text-red-700">The processing job encountered an error. Please try again.</p>
          </div>
        )}
      </div>

      {/* Job Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Job Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600">Type</div>
            <div className="font-medium">{SUBTYPE_LABELS[job.job_subtype] || job.job_subtype}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Created</div>
            <div className="font-medium">{new Date(job.created_at).toLocaleString()}</div>
          </div>
          {job.completed_at && (
            <div>
              <div className="text-sm text-gray-600">Completed</div>
              <div className="font-medium">{new Date(job.completed_at).toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      {/* Error Log */}
      {errors.length > 0 && (
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg shadow-md">
          <div className="p-4 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-bold text-lg text-red-800">Errors ({errors.length})</h3>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-red-100">
            {errors.map((err, i) => (
              <div key={i} className="px-4 py-3 text-sm font-mono text-red-700 hover:bg-red-100/50">
                {err}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
