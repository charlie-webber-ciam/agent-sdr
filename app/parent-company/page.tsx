'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context';

interface ParentCompanyStats {
  totalCompleted: number;
  alreadyProcessed: number;
  needsProcessing: number;
  australianParent: number;
  globalParent: number;
}

export default function ParentCompanyPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ParentCompanyStats | null>(null);
  const [unprocessedOnly, setUnprocessedOnly] = useState(true);
  const [limit, setLimit] = useState(10000);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/parent-company/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const targetCount = stats
    ? unprocessedOnly
      ? stats.needsProcessing
      : stats.totalCompleted
    : 0;

  const handleStart = async () => {
    setLoading(true);
    try {
      // Create the job
      const createRes = await fetch('/api/parent-company/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unprocessedOnly, limit }),
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        toast.error(error.error || 'Failed to create job');
        return;
      }

      const createData = await createRes.json();

      if (createData.totalAccounts === 0) {
        toast.info('No accounts found matching the specified filters');
        return;
      }

      // Start the job
      const startRes = await fetch('/api/parent-company/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: createData.jobId }),
      });

      if (startRes.ok) {
        router.push(`/parent-company/progress/${createData.jobId}`);
      } else {
        toast.error('Failed to start parent company finder job');
      }
    } catch (error) {
      console.error('Failed to start parent company finder:', error);
      toast.error('An error occurred while starting the job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Parent Company Finder</h1>
        <p className="text-gray-600">
          Detect whether accounts have an Australian or global parent company. Accounts with global parents are hidden from the default accounts view.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Configure Detection</h2>

            {/* Stats Banner */}
            {stats && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalCompleted}</div>
                    <div className="text-xs text-gray-600">Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.alreadyProcessed}</div>
                    <div className="text-xs text-gray-600">Processed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{stats.needsProcessing}</div>
                    <div className="text-xs text-gray-600">Needs Detection</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.australianParent}</div>
                    <div className="text-xs text-gray-600">AU Parent</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{stats.globalParent}</div>
                    <div className="text-xs text-gray-600">Global Parent</div>
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
                      checked={unprocessedOnly}
                      onChange={() => setUnprocessedOnly(true)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <div>
                      <div className="font-medium">Unprocessed Only</div>
                      <div className="text-sm text-gray-600">
                        Only detect parent companies for accounts that haven't been checked yet
                        {stats && <span className="text-amber-600 font-medium"> ({stats.needsProcessing} accounts)</span>}
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="scope"
                      checked={!unprocessedOnly}
                      onChange={() => setUnprocessedOnly(false)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <div>
                      <div className="font-medium">Re-check All</div>
                      <div className="text-sm text-gray-600">
                        Re-detect parent companies for all completed accounts
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
                  'No Accounts to Process'
                ) : (
                  `Start Detection for ${Math.min(targetCount, limit)} Accounts`
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
                <div>Accounts are sent to AI in batches of 25</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">2</div>
                <div>AI identifies whether each company has a parent/holding company</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">3</div>
                <div>Parent companies are classified as Australian or global</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 font-semibold">4</div>
                <div>Accounts with global parents are hidden from the default accounts view</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">Classification Rules</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5 font-bold">-</span>
                <span><strong>No parent:</strong> Company is the top-level entity (stays visible)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5 font-bold">-</span>
                <span><strong>Australian parent:</strong> ASX-listed or ASIC-registered HQ (stays visible)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5 font-bold">-</span>
                <span><strong>Global parent:</strong> US, UK, EU, Asia HQ (hidden by default)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
