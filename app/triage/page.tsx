'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TriageJobSummary {
  id: number;
  filename: string;
  processingJobId: number | null;
  totalAccounts: number;
  processedCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  completed: { bg: 'bg-green-100', text: 'text-green-800' },
  failed: { bg: 'bg-red-100', text: 'text-red-800' },
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TriageListPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<TriageJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('/api/triage/list');
        if (!res.ok) throw new Error('Failed to fetch triage jobs');
        const data = await res.json();
        setJobs(data.jobs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load triage jobs');
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const navigateToJob = (job: TriageJobSummary) => {
    if (job.status === 'completed' || job.status === 'failed') {
      if (job.processingJobId) {
        router.push(`/triage/results/${job.id}?processingJobId=${job.processingJobId}`);
      } else {
        router.push(`/triage/progress/${job.id}`);
      }
    } else {
      if (job.processingJobId) {
        router.push(`/triage/progress/${job.id}?processingJobId=${job.processingJobId}`);
      } else {
        router.push(`/triage/progress/${job.id}`);
      }
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Triage Jobs</h1>
        <p className="text-gray-600">View all account triage runs and their results</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No triage jobs yet</h3>
          <p className="text-gray-600">
            Upload accounts and run triage to see results here.
          </p>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md divide-y divide-gray-200">
          {jobs.map((job) => {
            const colors = statusColors[job.status] || statusColors.pending;
            const successCount = job.processedCount - job.failedCount;
            return (
              <div
                key={job.id}
                onClick={() => navigateToJob(job)}
                className="p-5 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{job.filename}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{job.totalAccounts} accounts</span>
                      {job.processedCount > 0 && (
                        <span>{successCount} triaged</span>
                      )}
                      {job.failedCount > 0 && (
                        <span className="text-red-600">{job.failedCount} failed</span>
                      )}
                      <span>{formatDate(job.createdAt)}</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
