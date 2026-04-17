'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePerspective, OktaPatch } from '@/lib/perspective-context';
import { useToast } from '@/lib/toast-context';

const PATCH_OPTIONS: { value: OktaPatch; label: string; desc: string }[] = [
  { value: 'emerging', label: 'Emerging', desc: '<300 employees' },
  { value: 'crp', label: 'Corporate', desc: '300-1,250 employees' },
  { value: 'ent', label: 'Enterprise', desc: '1,250-20K employees' },
  { value: 'stg', label: 'Strategic', desc: '20K+ employees' },
  { value: 'pubsec', label: 'Public Sector', desc: 'Gov & public entities' },
];

const PATCH_TIER_DEFS: Record<OktaPatch, { a: string; b: string; c: string; dq?: string }> = {
  emerging: {
    a: 'Score 75-100: $30K+ ARR, 150+ employees, SOC 2 / funding / rapid hiring triggers (~5-10%)',
    b: 'Score 50-74: $10K-$30K ARR, 50-150 employees, moderate growth (majority)',
    c: 'Score 25-49: <$10K ARR, <50 employees, very early stage (~20-30%)',
    dq: 'Score 0-24: Not a fit — too early, no identity needs',
  },
  crp: {
    a: 'Score 75-100: $75K+ ARR, 800+ employees, M&A / new CISO / HRIS gap triggers (~5-10%)',
    b: 'Score 50-74: $30K-$75K ARR, 500-800 employees, no urgent catalyst (majority)',
    c: 'Score 25-49: <$30K ARR, <500 employees, limited IAM complexity (~20-30%)',
  },
  ent: {
    a: 'Score 75-100: $500K+ ARR, 5,000+ employees, breach / Zero Trust / AD EOL triggers (~5-10%)',
    b: 'Score 50-74: $300K-$500K ARR, 2,000-5,000 employees, longer eval cycle (majority)',
    c: 'Score 25-49: <$300K ARR, <2,000 employees, single-product scope (~20-30%)',
  },
  stg: {
    a: 'Score 70-100: $2M+ ARR, 30,000+ employees, board mandate / regulatory triggers (~5-10%)',
    b: 'Score 45-69: $1.5M-$2M ARR, 20K-30K employees, no board urgency (majority)',
    c: 'Score 25-44: <$1.5M ARR, <20K employees, better in Enterprise patch (~20-30%)',
  },
  pubsec: {
    a: 'Score 70-100: $150K+ ARR, 500+ staff, active tender / Essential Eight uplift (~5-10%)',
    b: 'Score 45-69: $75K-$150K ARR, 200-500 staff, no active procurement (majority)',
    c: 'Score 25-44: <$75K ARR, <200 staff, basic SSO/MFA needs (~20-30%)',
  },
};

export default function CategorizePage() {
  const router = useRouter();
  const { perspective, oktaPatch } = usePerspective();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  // Filter state
  const [uncategorizedOnly, setUncategorizedOnly] = useState(true);
  const [industry, setIndustry] = useState('');
  const [limit, setLimit] = useState(10000);
  const [industries, setIndustries] = useState<string[]>([]);
  // Patch override for this run (defaults to context value)
  const [selectedPatch, setSelectedPatch] = useState<OktaPatch>(oktaPatch);

  // Sync with context when it changes
  useEffect(() => {
    setSelectedPatch(oktaPatch);
  }, [oktaPatch]);

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
        const uniqueIndustries = [...new Set(data.accounts.map((a: any) => a.industry))] as string[];
        setIndustries(uniqueIndustries.filter(Boolean).sort());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const [oktaProgress, setOktaProgress] = useState<{ total: number; done: number; running: boolean }>({ total: 0, done: 0, running: false });

  const handleStartCategorization = async () => {
    if (perspective === 'okta') {
      await handleStartOktaCategorization();
      return;
    }

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
        toast.error(error.message || 'Failed to create categorization job');
        return;
      }

      const createData = await createRes.json();

      if (createData.totalAccounts === 0) {
        toast.info('No accounts found matching the specified filters');
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
        toast.error('Failed to start categorization job');
      }
    } catch (error) {
      console.error('Failed to start categorization:', error);
      toast.error('An error occurred while starting categorization');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOktaCategorization = async () => {
    setLoading(true);
    try {
      // Get accounts to categorize
      const bulkRes = await fetch('/api/accounts/okta-categorize-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uncategorizedOnly,
          industry: industry || undefined,
          limit,
          patch: selectedPatch,
        }),
      });

      if (!bulkRes.ok) {
        const error = await bulkRes.json();
        toast.error(error.details || 'Failed to prepare Okta categorization');
        return;
      }

      const bulkData = await bulkRes.json();
      if (!bulkData.success || bulkData.totalAccounts === 0) {
        toast.info(bulkData.message || 'No accounts found matching the specified filters');
        return;
      }

      const ids: number[] = bulkData.accountIds;
      setOktaProgress({ total: ids.length, done: 0, running: true });

      // Process accounts sequentially
      let done = 0;
      for (const id of ids) {
        try {
          await fetch(`/api/accounts/${id}/okta-auto-categorize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patch: selectedPatch }),
          });
        } catch {
          // Continue on individual failures
        }
        done++;
        setOktaProgress({ total: ids.length, done, running: true });
      }

      setOktaProgress({ total: ids.length, done, running: false });
      toast.success(`Okta categorization complete! Processed ${done} of ${ids.length} accounts.`);
      fetchData(); // Refresh stats
    } catch (error) {
      console.error('Failed to start Okta categorization:', error);
      toast.error('An error occurred while starting Okta categorization');
    } finally {
      setLoading(false);
      setOktaProgress(prev => ({ ...prev, running: false }));
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

              {/* Okta Patch Selector */}
              {perspective === 'okta' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Okta Patch (Segment)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PATCH_OPTIONS.map(({ value, label, desc }) => (
                      <label
                        key={value}
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-purple-50 transition-colors ${
                          selectedPatch === value ? 'border-purple-500 bg-purple-50' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="patch"
                          checked={selectedPatch === value}
                          onChange={() => setSelectedPatch(value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <div>
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-gray-500">{desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Okta Progress Bar */}
              {oktaProgress.running && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-700">
                      Categorizing accounts ({PATCH_OPTIONS.find(p => p.value === selectedPatch)?.label} patch)...
                    </span>
                    <span className="text-sm text-purple-600">
                      {oktaProgress.done} / {oktaProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${oktaProgress.total > 0 ? (oktaProgress.done / oktaProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Start Button */}
              <button
                onClick={handleStartCategorization}
                disabled={loading || oktaProgress.running}
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
                  Calculates total score (0-100) for outreach
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Tier Definitions{perspective === 'okta' ? ` (${PATCH_OPTIONS.find(p => p.value === selectedPatch)?.label})` : ''}:
              </h4>
              {perspective === 'okta' ? (
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-green-600">A:</span>
                    <span>{PATCH_TIER_DEFS[selectedPatch].a}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600">B:</span>
                    <span>{PATCH_TIER_DEFS[selectedPatch].b}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-600">C:</span>
                    <span>{PATCH_TIER_DEFS[selectedPatch].c}</span>
                  </div>
                  {PATCH_TIER_DEFS[selectedPatch].dq && (
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-red-500">DQ:</span>
                      <span>{PATCH_TIER_DEFS[selectedPatch].dq}</span>
                    </div>
                  )}
                </div>
              ) : (
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
              )}
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
