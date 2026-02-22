'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProspectProcessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, unprocessed: 0, processed: 0 });
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/prospects?valueTier=HVT&limit=1&offset=0').then(r => r.json()),
      fetch('/api/prospects?valueTier=MVT&limit=1&offset=0').then(r => r.json()),
      fetch('/api/prospects?valueTier=LVT&limit=1&offset=0').then(r => r.json()),
      fetch('/api/prospects?limit=1&offset=0').then(r => r.json()),
    ]).then(([hvt, mvt, lvt, all]) => {
      setTierCounts({
        HVT: hvt.total || 0,
        MVT: mvt.total || 0,
        LVT: lvt.total || 0,
        Unclassified: (all.total || 0) - (hvt.total || 0) - (mvt.total || 0) - (lvt.total || 0),
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchData = async () => {
    try {
      // Fetch recent jobs
      const jobsRes = await fetch('/api/prospect-processing');
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setRecentJobs(data.jobs || []);
      }

      // Get prospect counts
      const prospectsRes = await fetch('/api/prospects?limit=1&aiProcessed=no');
      if (prospectsRes.ok) {
        const data = await prospectsRes.json();
        const unprocessed = Number(data.total) || 0;
        setStats(prev => ({ ...prev, unprocessed, processed: Math.max(0, prev.total - unprocessed) }));
      }
      const totalRes = await fetch('/api/prospects?limit=1');
      if (totalRes.ok) {
        const data = await totalRes.json();
        const total = Number(data.total) || 0;
        setStats(prev => {
          const unprocessed = prev.unprocessed;
          return { ...prev, total, processed: Math.max(0, total - unprocessed) };
        });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleStartJob = async (name: string, job_subtype: string, filters?: Record<string, any>) => {
    setLoading(true);
    try {
      // Create job
      const createRes = await fetch('/api/prospect-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          job_subtype,
          filters: filters || (job_subtype === 'classify' ? { unprocessedOnly: true } : job_subtype === 'contact_readiness' ? {} : { valueTier: job_subtype.replace('enrich_', '').toUpperCase() }),
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.json();
        setToast(error.error || 'Failed to create job');
        return;
      }

      const { jobId, totalProspects } = await createRes.json();

      if (totalProspects === 0) {
        setToast('No prospects match the specified filters');
        return;
      }

      // Start job
      const startRes = await fetch('/api/prospect-processing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (startRes.ok) {
        router.push(`/prospects/process/${jobId}`);
      } else {
        setToast('Failed to start processing job');
      }
    } catch (error) {
      console.error('Failed to start job:', error);
      setToast('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Keep backward-compatible alias used by old startJob call sites
  const startJob = (jobSubtype: string, name: string, filters?: Record<string, any>) =>
    handleStartJob(name, jobSubtype, filters);

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <button onClick={() => router.push('/prospects')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Prospects
        </button>
        <h1 className="text-4xl font-bold mb-2">AI Prospect Processing</h1>
        <p className="text-gray-600">Classify prospects into value tiers, then enrich with AI research per tier</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Prospects</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Unprocessed</div>
          <div className="text-2xl font-bold text-orange-600">{stats.unprocessed}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Processed</div>
          <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
        </div>
      </div>

      {/* Step 0: Assess Contact Readiness */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Step 0: Assess Contact Readiness</h2>
            <p className="text-sm text-gray-500 mt-1">
              Instantly flags each prospect as dial-ready, email-ready, social-only, or incomplete based on stored contact data. No AI needed.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Note: This runs automatically on import/create, but this button reassesses all prospects.
            </p>
          </div>
          <button
            onClick={() => handleStartJob('Reassess Contact Readiness', 'contact_readiness')}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            Reassess All Prospects
          </button>
        </div>
      </div>

      {/* Per-tier counts */}
      {Object.keys(tierCounts).length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {Object.entries(tierCounts).map(([tier, count]) => (
            <div key={tier} className={`rounded-lg border p-3 text-center ${
              tier === 'HVT' ? 'bg-red-50 border-red-200' :
              tier === 'MVT' ? 'bg-yellow-50 border-yellow-200' :
              tier === 'LVT' ? 'bg-green-50 border-green-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs font-medium text-gray-600">{tier}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1: Classify */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">1</div>
            <h2 className="text-xl font-bold">Classify Prospects</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Uses GPT-5.2 to classify each prospect into a value tier (HVT, MVT, LVT, etc.) based on their title, role, and account context. Fast classification with no web search.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
            <div className="font-medium text-gray-700 mb-1">What it does:</div>
            <ul className="text-gray-600 space-y-1">
              <li>- Assigns value tier (HVT/MVT/LVT/etc.)</li>
              <li>- Determines seniority level</li>
              <li>- Normalizes department tags</li>
              <li>- Adds prospect tags</li>
            </ul>
          </div>
          <button
            onClick={() => startJob('classify', `Classify Prospects - ${new Date().toLocaleDateString()}`)}
            disabled={loading || stats.unprocessed === 0}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Starting...' : `Classify ${stats.unprocessed} Unprocessed Prospects`}
          </button>
        </div>

        {/* Step 2: Enrich */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">2</div>
            <h2 className="text-xl font-bold">Enrich by Tier</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Deep AI research with web search per prospect. Different models per tier for cost optimization.
          </p>
          <div className="space-y-3">
            <div className="bg-red-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-red-800">HVT Enrichment</span>
                  <span className="text-xs text-red-600 ml-2">gpt-5.2</span>
                </div>
                <span className="text-sm font-medium text-red-700">{tierCounts.HVT ?? '—'} prospects</span>
              </div>
              <p className="text-xs text-red-700 mb-2">Most detailed research for high-value targets</p>
              <button
                onClick={() => startJob('enrich_hvt', `Enrich HVT Prospects - ${new Date().toLocaleDateString()}`, { valueTier: 'HVT' })}
                disabled={loading || (tierCounts.HVT ?? 0) === 0}
                className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start HVT Enrichment
              </button>
            </div>

            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-orange-800">MVT Enrichment</span>
                  <span className="text-xs text-orange-600 ml-2">gpt-5.2</span>
                </div>
                <span className="text-sm font-medium text-orange-700">{tierCounts.MVT ?? '—'} prospects</span>
              </div>
              <p className="text-xs text-orange-700 mb-2">Standard research for medium-value targets</p>
              <button
                onClick={() => startJob('enrich_mvt', `Enrich MVT Prospects - ${new Date().toLocaleDateString()}`, { valueTier: 'MVT' })}
                disabled={loading || (tierCounts.MVT ?? 0) === 0}
                className="w-full py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start MVT Enrichment
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-gray-800">LVT Enrichment</span>
                  <span className="text-xs text-gray-600 ml-2">gpt-5-nano</span>
                </div>
                <span className="text-sm font-medium text-gray-700">{tierCounts.LVT ?? '—'} prospects</span>
              </div>
              <p className="text-xs text-gray-700 mb-2">Quick research for lower-value targets</p>
              <button
                onClick={() => startJob('enrich_lvt', `Enrich LVT Prospects - ${new Date().toLocaleDateString()}`, { valueTier: 'LVT' })}
                disabled={loading || (tierCounts.LVT ?? 0) === 0}
                className="w-full py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start LVT Enrichment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-lg">Recent Processing Jobs</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => router.push(`/prospects/process/${job.id}`)}
                className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{job.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {job.job_subtype} | {job.processed_count}/{job.total_prospects} processed
                      {job.failed_count > 0 && ` | ${job.failed_count} failed`}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                    job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {job.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-red-600 z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
