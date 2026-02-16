'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';

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
  triageAuth0Tier: 'A' | 'B' | 'C' | null;
  triageOktaTier: 'A' | 'B' | 'C' | null;
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

const formatDomain = (domain: string | null) => {
  if (!domain || domain.includes('.placeholder')) {
    return 'No domain';
  }
  return domain;
};

const tierColors = {
  A: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  B: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  C: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
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
      // Get account IDs for the selected tier
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

  // Filter accounts based on selected tier
  const filteredAccounts = accounts.filter(a => {
    if (filterTier === 'all') return true;
    const column = filterType === 'auth0' ? 'triageAuth0Tier' : 'triageOktaTier';
    return a[column] === filterTier;
  });

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
        <p className="text-gray-600">{job.filename} — {job.processedCount} accounts triaged</p>
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
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            Accounts
            {filterTier !== 'all' && ` — ${filterType === 'auth0' ? 'Auth0' : 'Okta'} Tier ${filterTier}`}
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
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredAccounts.map((account) => (
            <div key={account.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-lg">{account.companyName}</h4>
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
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 ml-4"
                >
                  View
                </button>
              </div>
            </div>
          ))}
          {filteredAccounts.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No accounts match the selected filter.
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
