'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface JobData {
  job: {
    id: number;
    filename: string;
    status: string;
    total_accounts: number;
    processed_count: number;
    failed_count: number;
    current_company: string | null;
    created_at: string;
    completed_at: string | null;
  };
  results: Array<{
    id: number;
    account_name: string;
    linkedin_employee_count: string | null;
    dnb_employee_count: string | null;
    error_message: string | null;
  }>;
  progress: {
    total: number;
    processed: number;
    failed: number;
    percentage: number;
  };
}

export default function EmployeeCountProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchJobData = async () => {
    try {
      const res = await fetch(`/api/employee-counts/jobs/${jobId}`);
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

  const handleDownloadCSV = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/employee-counts/download/${jobId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to download CSV');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employee-counts-job-${jobId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert(err instanceof Error ? err.message : 'Failed to download CSV');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    fetchJobData();

    // Auto-refresh every 3 seconds while processing
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/employee-counts/jobs/${jobId}`);
        if (!res.ok) return;
        const jobData = await res.json();
        setData(jobData);

        // Stop polling if job is completed or failed
        if (jobData.job.status === 'completed' || jobData.job.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading job data...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error || 'Failed to load job data'}</p>
          <button
            onClick={() => router.push('/employee-counts')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Back to Upload
          </button>
        </div>
      </main>
    );
  }

  const { job, results, progress } = data;
  const isProcessing = job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Employee Count Enrichment</h1>
            <p className="text-gray-600">Job #{job.id} - {job.filename}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/employee-counts/jobs')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              All Jobs
            </button>
            {isCompleted && (
              <button
                onClick={handleDownloadCSV}
                disabled={downloading}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {downloading ? 'Downloading...' : 'Download CSV'}
              </button>
            )}
            <button
              onClick={() => router.push('/employee-counts')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              New Enrichment
            </button>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`mb-6 p-4 rounded-lg border ${
        isCompleted ? 'bg-green-50 border-green-200' :
        isFailed ? 'bg-red-50 border-red-200' :
        'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isProcessing && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            )}
            {isCompleted && (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {isFailed && (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div>
              <p className={`font-semibold ${
                isCompleted ? 'text-green-800' :
                isFailed ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {isProcessing && job.current_company && `Processing: ${job.current_company}`}
                {isProcessing && !job.current_company && 'Processing accounts...'}
                {isCompleted && 'Enrichment Complete!'}
                {isFailed && 'Enrichment Failed'}
              </p>
              <p className={`text-sm ${
                isCompleted ? 'text-green-700' :
                isFailed ? 'text-red-700' :
                'text-blue-700'
              }`}>
                {isCompleted && `CSV file is ready for download`}
                {isProcessing && `Processing 50 accounts concurrently`}
                {isFailed && 'An error occurred during processing'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Total Accounts</p>
          <p className="text-3xl font-bold text-gray-900">{progress.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Processed</p>
          <p className="text-3xl font-bold text-green-600">{progress.processed}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Failed</p>
          <p className="text-3xl font-bold text-red-600">{progress.failed}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-1">Progress</p>
          <p className="text-3xl font-bold text-blue-600">{progress.percentage}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-gray-600">
            {progress.processed + progress.failed} of {progress.total} accounts
          </span>
          <span className="text-gray-600">{progress.percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          ></div>
        </div>
      </div>

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Results ({results.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LinkedIn Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    D&B Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.slice().reverse().map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.account_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {result.linkedin_employee_count || (
                        <span className="text-gray-400 italic">Not found</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {result.dnb_employee_count || (
                        <span className="text-gray-400 italic">Not found</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {result.error_message ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Complete
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
