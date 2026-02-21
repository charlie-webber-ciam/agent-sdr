'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface OpportunityWithAccount {
  id: number;
  account_id: number;
  opportunity_name: string;
  stage: string | null;
  last_stage_change_date: string | null;
  business_use_case: string | null;
  champions: string | null;
  company_name: string;
  domain: string | null;
  industry: string;
  tier: string | null;
  okta_tier: string | null;
  prospect_count: number;
}

const STAGE_OPTIONS = [
  'Closed Won',
  'Closed Lost',
  'Negotiation',
  'Proposal',
  'Qualification',
  'Discovery',
  'Prospecting',
  'Value Proposition',
  'Id. Decision Makers',
  'Perception Analysis',
  'Needs Analysis',
];

function stageBadgeClass(stage: string | null): string {
  if (!stage) return 'bg-gray-100 text-gray-600';
  const s = stage.toLowerCase();
  if (s.includes('closed won')) return 'bg-green-100 text-green-700';
  if (s.includes('closed lost')) return 'bg-red-100 text-red-700';
  if (s.includes('negotiation') || s.includes('proposal')) return 'bg-blue-100 text-blue-700';
  if (s.includes('qualification') || s.includes('discovery')) return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
}

function tierBadgeClass(tier: string | null): string {
  if (tier === 'A') return 'bg-purple-100 text-purple-700';
  if (tier === 'B') return 'bg-blue-100 text-blue-700';
  if (tier === 'C') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-50 text-gray-400';
}

const PAGE_SIZE = 50;

function OpportunitiesPageInner() {
  const searchParams = useSearchParams();

  const [opportunities, setOpportunities] = useState<OpportunityWithAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stage, setStage] = useState(searchParams.get('stage') || '');
  const [tier, setTier] = useState(searchParams.get('tier') || '');
  const [industry, setIndustry] = useState(searchParams.get('industry') || '');
  const [offset, setOffset] = useState(parseInt(searchParams.get('offset') || '0', 10));

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (stage) params.set('stage', stage);
    if (tier) params.set('tier', tier);
    if (industry) params.set('industry', industry);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));

    try {
      const res = await fetch(`/api/opportunities?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOpportunities(data.opportunities);
      setTotal(data.total);
    } catch {
      setError('Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  }, [search, stage, tier, industry, offset]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const applyFilters = () => {
    setOffset(0);
    fetchOpportunities();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyFilters();
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total opportunities across all accounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search opportunity name, account, use case..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={stage}
            onChange={e => { setStage(e.target.value); setOffset(0); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Stages</option>
            {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={tier}
            onChange={e => { setTier(e.target.value); setOffset(0); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Tiers</option>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No opportunities found.
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Opportunity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Last Stage Change</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Champions</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Use Case</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Prospects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {opportunities.map(opp => (
                  <tr key={opp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/accounts/${opp.account_id}?tab=opportunities`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {opp.company_name}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {opp.tier && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tierBadgeClass(opp.tier)}`}>
                            {opp.tier}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{opp.industry}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 max-w-[200px]">
                      <span className="line-clamp-2">{opp.opportunity_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {opp.stage ? (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${stageBadgeClass(opp.stage)}`}>
                          {opp.stage}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {opp.last_stage_change_date
                        ? new Date(opp.last_stage_change_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px]">
                      <span className="line-clamp-1 text-xs">{opp.champions || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                      <span className="line-clamp-2 text-xs">{opp.business_use_case || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 font-medium">
                      {opp.prospect_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    }>
      <OpportunitiesPageInner />
    </Suspense>
  );
}
