'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context';

interface SummarizationStats {
  accountsWithActivities: number;
  alreadySummarized: number;
  needsSummary: number;
}

export default function SummarizeActivitiesPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<SummarizationStats | null>(null);
  const [unsummarizedOnly, setUnsummarizedOnly] = useState(true);
  const [limit, setLimit] = useState(10000);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/activity-summarization/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const targetCount = stats
    ? unsummarizedOnly
      ? stats.needsSummary
      : stats.accountsWithActivities
    : 0;

  const handleStart = async () => {
    setLoading(true);
    try {
      // Create the job
      const createRes = await fetch('/api/activity-summarization/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unsummarizedOnly, limit }),
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        toast.error(error.error || 'Failed to create job');
        return;
      }

      const createData = await createRes.json();

      if (createData.totalAccounts === 0) {
        toast.info('No accounts found with activities matching the specified filters');
        return;
      }

      // Start the job
      const startRes = await fetch('/api/activity-summarization/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: createData.jobId }),
      });

      if (startRes.ok) {
        router.push(`/summarize-activities/progress/${createData.jobId}`);
      } else {
        toast.error('Failed to start activity summarization job');
      }
    } catch (error) {
      console.error('Failed to start summarization:', error);
      toast.error('An error occurred while starting summarization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Bulk Activity Summarization</h1>
        <p className="text-gray-600">
          Generate AI summaries of CRM activity logs for accounts with imported activities
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Configure Summarization</h2>

            {/* Stats Banner */}
            {stats && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.accountsWithActivities}</div>
                    <div className="text-xs text-gray-600">With Activities</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.alreadySummarized}</div>
                    <div className="text-xs text-gray-600">Already Summarized</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{stats.needsSummary}</div>
                    <div className="text-xs text-gray-600">Needs Summary</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Scope
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="scope"
                      checked={unsummarizedOnly}
                      onChange={() => setUnsummarizedOnly(true)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <div>
                      <div className="font-medium">Unsummarized Only</div>
                      <div className="text-sm text-gray-600">
                        Only summarize accounts that don't have an activity summary yet
                        {stats && <span className="text-amber-600 font-medium"> ({stats.needsSummary} accounts)</span>}
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="scope"
                      checked={!unsummarizedOnly}
                      onChange={() => setUnsummarizedOnly(false)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <div>
                      <div className="font-medium">Re-summarize All</div>
                      <div className="text-sm text-gray-600">
                        Re-generate summaries for all accounts with activities
                        {stats && <span className="text-gray-500 font-medium"> ({stats.accountsWithActivities} accounts)</span>}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Accounts
                </label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 10000)}
                  min="1"
                  max="10000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum number of accounts to process in this batch (1-10,000)
                </p>
              </div>

              {/* Matching Count */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Accounts to process:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {Math.min(targetCount, limit)}
                    {targetCount > limit && (
                      <span className="text-sm font-normal text-gray-500 ml-1">of {targetCount}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                disabled={loading || targetCount === 0}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-semibold text-lg hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Starting...
                  </span>
                ) : targetCount === 0 ? (
                  'No Accounts to Summarize'
                ) : (
                  `Start Summarizing ${Math.min(targetCount, limit)} Accounts`
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">How It Works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">1</div>
                <div>Finds accounts with imported CRM activities</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">2</div>
                <div>AI reads the full activity log (emails, calls, meetings)</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">3</div>
                <div>Generates a structured engagement summary per account</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">4</div>
                <div>Summaries are stored for use in personalized outreach</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">Summary Includes</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">-</span>
                Engagement timeline and status
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">-</span>
                Key contacts and relationships
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">-</span>
                Conversation themes and topics
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">-</span>
                Deal intelligence and buying signals
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">-</span>
                Meeting and follow-up history
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">-</span>
                Recommended outreach approach
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
