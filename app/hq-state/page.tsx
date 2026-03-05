'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface HqStateStats {
  totalCompleted: number;
  alreadyAssigned: number;
  needsAssignment: number;
}

export default function HqStatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<HqStateStats | null>(null);
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [limit, setLimit] = useState(10000);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/hq-state/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const targetCount = stats
    ? unassignedOnly
      ? stats.needsAssignment
      : stats.totalCompleted
    : 0;

  const handleStart = async () => {
    setLoading(true);
    try {
      // Create the job
      const createRes = await fetch('/api/hq-state/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unassignedOnly, limit }),
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        alert(error.error || 'Failed to create job');
        return;
      }

      const createData = await createRes.json();

      if (createData.totalAccounts === 0) {
        alert('No accounts found matching the specified filters');
        return;
      }

      // Start the job
      const startRes = await fetch('/api/hq-state/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: createData.jobId }),
      });

      if (startRes.ok) {
        router.push(`/hq-state/progress/${createData.jobId}`);
      } else {
        alert('Failed to start HQ state assignment job');
      }
    } catch (error) {
      console.error('Failed to start HQ state assignment:', error);
      alert('An error occurred while starting the job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">HQ State Assignment</h1>
        <p className="text-gray-600">
          Auto-assign headquarters state/region to accounts using AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Configure Assignment</h2>

            {/* Stats Banner */}
            {stats && (
              <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalCompleted}</div>
                    <div className="text-xs text-gray-600">Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.alreadyAssigned}</div>
                    <div className="text-xs text-gray-600">Assigned</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{stats.needsAssignment}</div>
                    <div className="text-xs text-gray-600">Needs Assignment</div>
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
                      checked={unassignedOnly}
                      onChange={() => setUnassignedOnly(true)}
                      className="w-4 h-4 text-teal-600"
                    />
                    <div>
                      <div className="font-medium">Unassigned Only</div>
                      <div className="text-sm text-gray-600">
                        Only assign states for accounts that don&apos;t have one yet
                        {stats && <span className="text-amber-600 font-medium"> ({stats.needsAssignment} accounts)</span>}
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="scope"
                      checked={!unassignedOnly}
                      onChange={() => setUnassignedOnly(false)}
                      className="w-4 h-4 text-teal-600"
                    />
                    <div>
                      <div className="font-medium">Re-check All</div>
                      <div className="text-sm text-gray-600">
                        Re-assign states for all completed accounts
                        {stats && <span className="text-gray-500 font-medium"> ({stats.totalCompleted} accounts)</span>}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                className="w-full py-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg font-semibold text-lg hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
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
                  'No Accounts to Process'
                ) : (
                  `Start Assignment for ${Math.min(targetCount, limit)} Accounts`
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
                <div className="w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">1</div>
                <div>Accounts are sent to AI in batches of 50</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">2</div>
                <div>AI infers HQ location from company name, domain, industry, and research summary</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">3</div>
                <div>Each account is assigned a state code (NSW, VIC, QLD, SA, WA, TAS, ACT, NT, NZ)</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">4</div>
                <div>Use the HQ State filter in the accounts browser to segment by location</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">Valid States</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT', 'NZ'].map(state => (
                <div key={state} className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-center font-medium">
                  {state}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Accounts where the AI cannot determine the HQ state with confidence will be left unassigned.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
