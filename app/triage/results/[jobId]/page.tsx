'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { formatDomain } from '@/lib/utils';

interface TierStats {
  auth0: { tierA: number; tierB: number; tierC: number };
  okta: { tierA: number; tierB: number; tierC: number };
  total: number;
}

interface TriagedAccount {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  triageAuth0Tier: 'A' | 'B' | 'C' | null;
  triageOktaTier: 'A' | 'B' | 'C' | 'DQ' | null;
  triageSummary: string | null;
  triageData: {
    auth0_tier_reasoning: string;
    okta_tier_reasoning: string;
    estimated_arr: string;
    estimated_employees: string;
    key_signals: string[];
  } | null;
  triagedAt: string | null;
}

interface TriageResultsData {
  job: {
    id: number;
    filename: string;
    status: string;
    totalAccounts: number;
    processedCount: number;
    failedCount: number;
    completedAt: string | null;
  };
  tierStats: TierStats;
  accounts: TriagedAccount[];
}

const MODELS = [
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'o4-mini', label: 'o4-mini' },
  { value: 'o3', label: 'o3' },
];

const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  B: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  C: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  DQ: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  completed: { bg: 'bg-green-100', text: 'text-green-800' },
  failed: { bg: 'bg-red-100', text: 'text-red-800' },
};

export default function TriageResultsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<TriageResultsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-5.2');
  const [researchType, setResearchType] = useState<'both' | 'auth0' | 'okta'>('both');
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterType, setFilterType] = useState<'auth0' | 'okta'>('auth0');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [processingSelected, setProcessingSelected] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setProcessingJobId(urlParams.get('processingJobId'));
  }, []);

  useEffect(() => {
    if (!processingJobId) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/triage/jobs/${jobId}?processingJobId=${processingJobId}`);
        if (!res.ok) throw new Error('Failed to fetch triage results');
        const resultData = await res.json();
        setData(resultData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobId, processingJobId]);

  const handleProcessTier = async (tierType: 'auth0' | 'okta', tier: 'A' | 'B' | 'C') => {
    if (!data || !processingJobId) return;

    const tierKey = `${tierType}-${tier}`;
    setProcessingTier(tierKey);

    try {
      const column = tierType === 'auth0' ? 'triageAuth0Tier' : 'triageOktaTier';
      const accountIds = data.accounts
        .filter(a => a[column] === tier)
        .map(a => a.id);

      if (accountIds.length === 0) {
        setProcessingTier(null);
        return;
      }

      const res = await fetch('/api/accounts/reprocess-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds,
          researchType,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to start processing');
      }

      const result = await res.json();
      router.push(result.redirectUrl);
    } catch (err) {
      console.error('Process tier error:', err);
      setProcessingTier(null);
    }
  };

  const handleProcessSelected = async () => {
    if (selectedIds.size === 0) return;
    setProcessingSelected(true);

    try {
      const res = await fetch('/api/accounts/reprocess-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds: Array.from(selectedIds),
          researchType,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to start processing');
      }

      const result = await res.json();
      router.push(result.redirectUrl);
    } catch (err) {
      console.error('Process selected error:', err);
      setProcessingSelected(false);
    }
  };

  if (loading || !processingJobId) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error || 'Triage results not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  const { job, tierStats, accounts } = data;

  // Filter accounts based on selected tier and status
  const filteredAccounts = accounts.filter(a => {
    // Status filter
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    // Tier filter
    if (filterTier === 'all') return true;
    const column = filterType === 'auth0' ? 'triageAuth0Tier' : 'triageOktaTier';
    return a[column] === filterTier;
  });

  // Compute status counts for the filter badges
  const statusCounts = accounts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const allFilteredSelected = filteredAccounts.length > 0 && filteredAccounts.every(a => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      const newSet = new Set(selectedIds);
      filteredAccounts.forEach(a => newSet.delete(a.id));
      setSelectedIds(newSet);
    } else {
      // Select all filtered
      const newSet = new Set(selectedIds);
      filteredAccounts.forEach(a => newSet.add(a.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const TierCard = ({ tierType, tier, count }: { tierType: 'auth0' | 'okta'; tier: 'A' | 'B' | 'C'; count: number }) => {
    const colors = tierColors[tier];
    const tierKey = `${tierType}-${tier}`;
    const isProcessingThis = processingTier === tierKey;

    return (
      <div className={`${colors.bg} ${colors.border} border rounded-lg p-5`}>
        <div className="text-center mb-3">
          <p className={`text-4xl font-bold ${colors.text}`}>{count}</p>
          <p className={`text-sm font-medium ${colors.text}`}>Tier {tier}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleProcessTier(tierType, tier)}
            disabled={count === 0 || isProcessingThis}
            className={`w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              count === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isProcessingThis
                ? 'bg-gray-300 text-gray-500 cursor-wait'
                : 'bg-white text-gray-800 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {isProcessingThis ? 'Starting...' : `Process All (${count})`}
          </button>
          <button
            onClick={() => {
              setFilterType(tierType);
              setFilterTier(tier);
            }}
            disabled={count === 0}
            className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
              count === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            View
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Triage Results</h1>
        <p className="text-gray-600">
          {job.filename} — {job.processedCount} accounts triaged
          {job.failedCount > 0 && (
            <span className="text-red-600 ml-2">({job.failedCount} failed)</span>
          )}
        </p>
      </div>

      {/* Model & Research Type Selectors */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Research Model:</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Research Type:</label>
          <select
            value={researchType}
            onChange={(e) => setResearchType(e.target.value as 'both' | 'auth0' | 'okta')}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="both">Both (Auth0 + Okta)</option>
            <option value="auth0">Auth0 Only</option>
            <option value="okta">Okta Only</option>
          </select>
        </div>
      </div>

      {/* Tier Breakdown Cards */}
      {tierStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Auth0 CIAM Triage</h3>
            <div className="grid grid-cols-3 gap-3">
              <TierCard tierType="auth0" tier="A" count={tierStats.auth0.tierA} />
              <TierCard tierType="auth0" tier="B" count={tierStats.auth0.tierB} />
              <TierCard tierType="auth0" tier="C" count={tierStats.auth0.tierC} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Okta Workforce Triage</h3>
            <div className="grid grid-cols-3 gap-3">
              <TierCard tierType="okta" tier="A" count={tierStats.okta.tierA} />
              <TierCard tierType="okta" tier="B" count={tierStats.okta.tierB} />
              <TierCard tierType="okta" tier="C" count={tierStats.okta.tierC} />
            </div>
          </div>
        </div>
      )}

      {/* Account List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">
              Accounts
              {filterTier !== 'all' && ` — ${filterType === 'auth0' ? 'Auth0' : 'Okta'} Tier ${filterTier}`}
              {filterStatus !== 'all' && ` — ${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}`}
              {` (${filteredAccounts.length})`}
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'auth0' | 'okta')}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="auth0">Auth0</option>
                <option value="okta">Okta</option>
              </select>
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="all">All Tiers</option>
                <option value="A">Tier A</option>
                <option value="B">Tier B</option>
                <option value="C">Tier C</option>
                <option value="DQ">DQ</option>
              </select>
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 mr-1">Status:</span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({accounts.length})
            </button>
            {(['pending', 'failed', 'completed', 'processing'] as const).map(s => {
              const count = statusCounts[s] || 0;
              if (count === 0) return null;
              const colors = statusColors[s];
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterStatus === s
                      ? `${colors.bg} ${colors.text} ring-2 ring-offset-1 ring-gray-300`
                      : `${colors.bg} ${colors.text} hover:opacity-80`
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {/* Selection bar */}
          {filteredAccounts.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                Select all ({filteredAccounts.length})
              </label>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleProcessSelected}
                    disabled={processingSelected}
                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      processingSelected
                        ? 'bg-gray-300 text-gray-500 cursor-wait'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {processingSelected ? 'Starting...' : `Process Selected (${selectedIds.size})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="divide-y divide-gray-200">
          {filteredAccounts.map((account) => {
            const isSelected = selectedIds.has(account.id);
            const sColors = statusColors[account.status] || statusColors.pending;
            return (
              <div
                key={account.id}
                className={`p-4 hover:bg-gray-50 ${isSelected ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(account.id)}
                    className="w-4 h-4 mt-1.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium text-lg">{account.companyName}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sColors.bg} ${sColors.text}`}>
                        {account.status}
                      </span>
                      {account.triageAuth0Tier && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tierColors[account.triageAuth0Tier].bg} ${tierColors[account.triageAuth0Tier].text}`}>
                          Auth0: {account.triageAuth0Tier}
                        </span>
                      )}
                      {account.triageOktaTier && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tierColors[account.triageOktaTier].bg} ${tierColors[account.triageOktaTier].text}`}>
                          Okta: {account.triageOktaTier}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDomain(account.domain)} — {account.industry}
                    </p>
                    {account.triageSummary && (
                      <p className="text-sm text-gray-700 mt-1">{account.triageSummary}</p>
                    )}
                    {account.triageData?.key_signals && account.triageData.key_signals.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {account.triageData.key_signals.map((signal, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-800 border border-yellow-200">
                            {signal}
                          </span>
                        ))}
                      </div>
                    )}
                    {account.triageData && (
                      <div className="text-xs text-gray-500 mt-1">
                        {account.triageData.estimated_arr !== 'Unknown' && `ARR: ${account.triageData.estimated_arr}`}
                        {account.triageData.estimated_arr !== 'Unknown' && account.triageData.estimated_employees !== 'Unknown' && ' | '}
                        {account.triageData.estimated_employees !== 'Unknown' && `Employees: ${account.triageData.estimated_employees}`}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/accounts/${account.id}`)}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 ml-2 shrink-0"
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })}
          {filteredAccounts.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No accounts match the selected filters.
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Go Home
        </button>
        <button
          onClick={() => router.push('/accounts')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Browse All Accounts
        </button>
      </div>
    </main>
  );
}
