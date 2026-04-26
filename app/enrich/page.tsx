'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context';

const ENRICHMENT_TYPES = [
  {
    value: 'domain',
    label: 'Domain Finder',
    desc: 'Find or correct missing/placeholder domains via web search',
  },
  {
    value: 'standardize_industry',
    label: 'Industry Standardizer',
    desc: 'Standardize industry names to a canonical set via web search',
  },
];

interface EnrichmentJob {
  id: number;
  type: string;
  name: string;
  status: string;
  total_accounts: number;
  processed_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
}

export default function EnrichPage() {
  const router = useRouter();
  const toast = useToast();
  const [selectedType, setSelectedType] = useState('domain');
  const [limit, setLimit] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [recentJobs, setRecentJobs] = useState<EnrichmentJob[]>([]);

  useEffect(() => {
    fetchRecentJobs();
  }, []);

  const fetchRecentJobs = async () => {
    try {
      const res = await fetch('/api/enrichment/jobs?limit=10');
      if (res.ok) {
        const data = await res.json();
        setRecentJobs(data.jobs || []);
      }
    } catch {
      // ignore
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      // Step 1: Create job
      const createRes = await fetch('/api/enrichment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, limit }),
      });

      const createData = await createRes.json();

      if (!createRes.ok || !createData.success) {
        toast.error(createData.error || createData.message || 'Failed to create job');
        return;
      }

      if (createData.totalAccounts === 0) {
        toast.info('No accounts eligible for this enrichment type');
        return;
      }

      // Step 2: Start job
      const startRes = await fetch('/api/enrichment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: createData.jobId }),
      });

      if (!startRes.ok) {
        const startData = await startRes.json();
        toast.error(startData.error || 'Failed to start job');
        return;
      }

      router.push(`/enrich/progress/${createData.jobId}`);
    } catch (error) {
      toast.error('An error occurred starting the enrichment job');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Bulk Enrichment</h1>
        <p className="text-gray-600">
          Run lightweight AI agents across all accounts to fix or enrich specific fields.
          Uses gpt-5-mini with web search, processing 50 accounts at a time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Config Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Configure Enrichment</h2>

            {/* Agent Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Enrichment Agent
              </label>
              <div className="space-y-3">
                {ENRICHMENT_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      selectedType === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="enrichmentType"
                      value={type.value}
                      checked={selectedType === type.value}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-bold text-gray-900">{type.label}</span>
                      <p className="text-sm text-gray-600 mt-0.5">{type.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Max Accounts */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Max Accounts to Process
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={50000}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Limits the number of accounts processed in this job
              </p>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating job...' : 'Start Enrichment'}
            </button>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h3 className="text-lg font-bold mb-4">How It Works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">1</span>
                <p>Select an enrichment agent and configure filters</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">2</span>
                <p>The system counts eligible accounts and creates a job</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">3</span>
                <p>The agent processes 50 accounts at a time using gpt-5-mini with web search</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">4</span>
                <p>Each account gets 1 focused web search to find/verify the target field</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs">5</span>
                <p>Results are saved to the database as each account completes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Recent Jobs */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">Recent Jobs</h3>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-gray-500">No enrichment jobs yet</p>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => router.push(`/enrich/progress/${job.id}`)}
                    className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm truncate">{job.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {job.processed_count}/{job.total_accounts} processed
                      {job.failed_count > 0 && ` (${job.failed_count} failed)`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adding New Agents Info */}
          <div className="bg-gray-50 rounded-lg shadow-md p-6 mt-6">
            <h3 className="text-lg font-bold mb-3">Extensible</h3>
            <p className="text-sm text-gray-600">
              New enrichment agents can be added in 3 steps: create a handler, register it, and add it to the UI.
              Each agent does one focused web search per account.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
