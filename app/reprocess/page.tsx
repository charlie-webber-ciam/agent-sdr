'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ReprocessStats {
  completedTotal: number;
  missingOkta: number;
  missingAuth0: number;
  hasBoth: number;
}

export default function ReprocessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ReprocessStats | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);

  // Config state
  const [researchType, setResearchType] = useState<'okta' | 'auth0' | 'both'>('okta');
  const [scope, setScope] = useState<'missing_okta' | 'missing_auth0' | 'all_completed'>('missing_okta');
  const [industry, setIndustry] = useState('');
  const [limit, setLimit] = useState(10000);

  useEffect(() => {
    fetchConfig();
  }, []);

  // Auto-set scope when research type changes
  useEffect(() => {
    if (researchType === 'okta') {
      setScope('missing_okta');
    } else if (researchType === 'auth0') {
      setScope('missing_auth0');
    } else {
      setScope('all_completed');
    }
  }, [researchType]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/reprocess/config');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setIndustries(data.industries || []);
      }
    } catch (error) {
      console.error('Failed to fetch reprocess config:', error);
    }
  };

  const matchingCount = stats
    ? scope === 'missing_okta'
      ? stats.missingOkta
      : scope === 'missing_auth0'
      ? stats.missingAuth0
      : stats.completedTotal
    : 0;

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reprocess/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          researchType,
          scope,
          industry: industry || undefined,
          limit,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to start reprocessing');
        return;
      }

      const data = await res.json();
      router.push(data.redirectUrl);
    } catch (error) {
      console.error('Failed to start reprocessing:', error);
      alert('An error occurred while starting reprocessing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Bulk Reprocess</h1>
        <p className="text-gray-600">
          Run missing research (Auth0, Okta, or both) on completed accounts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Configure Reprocessing</h2>

            {/* Stats Banner */}
            {stats && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.completedTotal}</div>
                    <div className="text-xs text-gray-600">Total Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{stats.missingOkta}</div>
                    <div className="text-xs text-gray-600">Missing Okta</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{stats.missingAuth0}</div>
                    <div className="text-xs text-gray-600">Missing Auth0</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.hasBoth}</div>
                    <div className="text-xs text-gray-600">Have Both</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Research Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Research Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="researchType"
                      checked={researchType === 'okta'}
                      onChange={() => setResearchType('okta')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium">Okta Only</div>
                      <div className="text-sm text-gray-600">
                        Run Okta Workforce Identity research on accounts missing it
                        {stats && <span className="text-amber-600 font-medium"> ({stats.missingOkta} accounts)</span>}
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="researchType"
                      checked={researchType === 'auth0'}
                      onChange={() => setResearchType('auth0')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium">Auth0 Only</div>
                      <div className="text-sm text-gray-600">
                        Run Auth0 CIAM research on accounts missing it
                        {stats && <span className="text-amber-600 font-medium"> ({stats.missingAuth0} accounts)</span>}
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="researchType"
                      checked={researchType === 'both'}
                      onChange={() => setResearchType('both')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <div className="font-medium">Both</div>
                      <div className="text-sm text-gray-600">
                        Re-run both Auth0 and Okta research on selected accounts
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Scope
                </label>
                <div className="space-y-2">
                  {researchType === 'okta' && (
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 bg-blue-50 border-blue-200">
                      <input
                        type="radio"
                        name="scope"
                        checked={scope === 'missing_okta'}
                        onChange={() => setScope('missing_okta')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div>
                        <div className="font-medium">Missing Okta Research</div>
                        <div className="text-sm text-gray-600">
                          Accounts with Auth0 research but no Okta research
                        </div>
                      </div>
                    </label>
                  )}
                  {researchType === 'auth0' && (
                    <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 bg-blue-50 border-blue-200">
                      <input
                        type="radio"
                        name="scope"
                        checked={scope === 'missing_auth0'}
                        onChange={() => setScope('missing_auth0')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div>
                        <div className="font-medium">Missing Auth0 Research</div>
                        <div className="text-sm text-gray-600">
                          Accounts with Okta research but no Auth0 research
                        </div>
                      </div>
                    </label>
                  )}
                  {researchType === 'both' && (
                    <>
                      <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="scope"
                          checked={scope === 'all_completed'}
                          onChange={() => setScope('all_completed')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="font-medium">All Completed Accounts</div>
                          <div className="text-sm text-gray-600">
                            Re-run both research types on all completed accounts
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="scope"
                          checked={scope === 'missing_okta'}
                          onChange={() => setScope('missing_okta')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="font-medium">Missing Okta Research</div>
                          <div className="text-sm text-gray-600">
                            Only accounts missing Okta research
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="scope"
                          checked={scope === 'missing_auth0'}
                          onChange={() => setScope('missing_auth0')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="font-medium">Missing Auth0 Research</div>
                          <div className="text-sm text-gray-600">
                            Only accounts missing Auth0 research
                          </div>
                        </div>
                      </label>
                    </>
                  )}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum number of accounts to reprocess (1-10,000)
                </p>
              </div>

              {/* Matching Count */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Accounts matching filters:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {Math.min(matchingCount, limit)}
                    {matchingCount > limit && (
                      <span className="text-sm font-normal text-gray-500 ml-1">of {matchingCount}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStart}
                disabled={loading || matchingCount === 0}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold text-lg hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
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
                ) : matchingCount === 0 ? (
                  'No Accounts to Reprocess'
                ) : (
                  `Start Reprocessing ${Math.min(matchingCount, limit)} Accounts`
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
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  1
                </div>
                <div>Select the research type you want to run</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  2
                </div>
                <div>Choose the scope of accounts to target</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  3
                </div>
                <div>Matching accounts are reset and queued for research</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  4
                </div>
                <div>Processing runs in background using the existing pipeline</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">
                  5
                </div>
                <div>Each account is auto-categorized after research completes</div>
              </div>
            </div>
          </div>

          {stats && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold mb-4">Account Coverage</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm font-medium text-green-700">Have Both</span>
                  <span className="text-lg font-bold text-green-700">{stats.hasBoth}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-sm font-medium text-amber-700">Missing Okta</span>
                  <span className="text-lg font-bold text-amber-700">{stats.missingOkta}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-sm font-medium text-amber-700">Missing Auth0</span>
                  <span className="text-lg font-bold text-amber-700">{stats.missingAuth0}</span>
                </div>

                {/* Coverage bar */}
                {stats.completedTotal > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Research Coverage</div>
                    <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
                      {stats.hasBoth > 0 && (
                        <div
                          className="bg-green-500 transition-all duration-500"
                          style={{ width: `${(stats.hasBoth / stats.completedTotal) * 100}%` }}
                          title={`Both: ${stats.hasBoth}`}
                        />
                      )}
                      {stats.missingOkta > 0 && (
                        <div
                          className="bg-amber-400 transition-all duration-500"
                          style={{ width: `${(stats.missingOkta / stats.completedTotal) * 100}%` }}
                          title={`Missing Okta: ${stats.missingOkta}`}
                        />
                      )}
                      {stats.missingAuth0 > 0 && (
                        <div
                          className="bg-amber-300 transition-all duration-500"
                          style={{ width: `${(stats.missingAuth0 / stats.completedTotal) * 100}%` }}
                          title={`Missing Auth0: ${stats.missingAuth0}`}
                        />
                      )}
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>Both ({Math.round((stats.hasBoth / stats.completedTotal) * 100)}%)</span>
                      <span>Partial ({Math.round(((stats.missingOkta + stats.missingAuth0) / stats.completedTotal) * 100)}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
