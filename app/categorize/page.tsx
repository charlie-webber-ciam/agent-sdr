'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CategorizePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  // Filter state
  const [uncategorizedOnly, setUncategorizedOnly] = useState(true);
  const [industry, setIndustry] = useState('');
  const [limit, setLimit] = useState(10000);
  const [industries, setIndustries] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch stats to get uncategorized count
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setUncategorizedCount(stats.uncategorized || 0);
      }

      // Fetch recent categorization jobs
      const jobsRes = await fetch('/api/categorization/jobs?limit=5');
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setRecentJobs(data.jobs || []);
      }

      // Fetch available industries
      const accountsRes = await fetch('/api/accounts?limit=1000');
      if (accountsRes.ok) {
        const data = await accountsRes.json();
        const uniqueIndustries = [...new Set(data.accounts.map((a: any) => a.industry))];
        setIndustries(uniqueIndustries.filter(Boolean).sort());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleStartCategorization = async () => {
    setLoading(true);
    try {
      // Create categorization job
      const createRes = await fetch('/api/accounts/categorize-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uncategorizedOnly,
          industry: industry || undefined,
          limit,
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        alert(error.message || 'Failed to create categorization job');
        return;
      }

      const createData = await createRes.json();

      if (createData.totalAccounts === 0) {
        alert('No accounts found matching the specified filters');
        return;
      }

      // Start the job
      const startRes = await fetch('/api/categorization/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: createData.jobId }),
      });

      if (startRes.ok) {
        // Redirect to progress page
        router.push(`/categorize/progress/${createData.jobId}`);
      } else {
        alert('Failed to start categorization job');
      }
    } catch (error) {
      console.error('Failed to start categorization:', error);
      alert('An error occurred while starting categorization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Bulk Categorization</h1>
        <p className="text-gray-600">
          Auto-categorize accounts using AI to identify tiers, revenue potential, and SKU opportunities
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Configure Categorization</h2>

            {/* Uncategorized Accounts Info */}
            {uncategorizedCount > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-5 h-5 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="font-semibold text-yellow-800">
                    {uncategorizedCount} account{uncategorizedCount !== 1 ? 's' : ''} need{uncategorizedCount === 1 ? 's' : ''} categorization
                  </span>
                </div>
                <p className="text-sm text-yellow-700">
                  These accounts have completed research but haven't been categorized yet.
                </p>
              </div>
            )}

            {/* Filters */}
            <div className="space-y-6">
              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Categorization Scope
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="scope"
                      checked={uncategorizedOnly}
                      onChange={() => setUncategorizedOnly(true)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <div className="font-medium">Uncategorized Only</div>
                      <div className="text-sm text-gray-600">
                        Only categorize accounts that don't have a tier assigned
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="scope"
                      checked={!uncategorizedOnly}
                      onChange={() => setUncategorizedOnly(false)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <div className="font-medium">Re-categorize All</div>
                      <div className="text-sm text-gray-600">
                        Re-run categorization on all completed accounts
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Industry Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Industry (Optional)
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Industries</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum number of accounts to process in this batch (1-10,000)
                </p>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartCategorization}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold text-lg hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Starting...
                  </span>
                ) : (
                  'Start Categorization'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          {/* How It Works */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">How It Works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  1
                </div>
                <div>
                  AI analyzes research data for each account
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  2
                </div>
                <div>
                  Assigns tier based on ARR potential and buying triggers
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  3
                </div>
                <div>
                  Estimates revenue potential and user volume
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  4
                </div>
                <div>
                  Identifies applicable use cases and Auth0 SKUs
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  5
                </div>
                <div>
                  Calculates priority score (1-10) for outreach
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Tier Definitions:</h4>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-green-600">A:</span>
                  <span>$250K+ ARR potential with near-term buying triggers (rare, ~5-10%)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600">B:</span>
                  <span>Mid-market with moderate CIAM needs (majority, ~60-70%)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-gray-600">C:</span>
                  <span>Smaller companies or longer sales cycles (~20-30%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Jobs */}
          {recentJobs.length > 0 && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold">Recent Jobs</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {recentJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => router.push(`/categorize/progress/${job.id}`)}
                    className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-sm mb-1">{job.name}</div>
                    <div className="text-xs text-gray-600">
                      {job.processed_count} / {job.total_accounts} completed
                    </div>
                    <span
                      className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                        job.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : job.status === 'processing'
                          ? 'bg-blue-100 text-blue-800'
                          : job.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {job.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
