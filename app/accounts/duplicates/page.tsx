'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DuplicatePair {
  id1: number;
  company_name_1: string;
  domain_1: string | null;
  industry_1: string;
  tier_1: string | null;
  prospect_count_1: number;
  opportunity_count_1: number;
  id2: number;
  company_name_2: string;
  domain_2: string | null;
  industry_2: string;
  tier_2: string | null;
  prospect_count_2: number;
  opportunity_count_2: number;
}

type RelationshipType = 'parent' | 'subsidiary' | 'formerly_known_as';

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  parent: 'Parent of each other',
  subsidiary: 'Subsidiary',
  formerly_known_as: 'Formerly known as',
};

function tierBadgeClass(tier: string | null): string {
  if (tier === 'A') return 'bg-purple-100 text-purple-700';
  if (tier === 'B') return 'bg-blue-100 text-blue-700';
  if (tier === 'C') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-50 text-gray-400';
}

function AccountCard({ id, name, domain, industry, tier, prospectCount, oppCount }: {
  id: number;
  name: string;
  domain: string | null;
  industry: string;
  tier: string | null;
  prospectCount: number;
  oppCount: number;
}) {
  return (
    <div className="flex-1 bg-gray-50 rounded-lg p-3 min-w-0">
      <div className="flex items-start gap-2 mb-1">
        {tier && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${tierBadgeClass(tier)}`}>{tier}</span>
        )}
        <Link href={`/accounts/${id}`} className="font-semibold text-gray-900 hover:text-blue-600 text-sm leading-tight break-words">
          {name}
        </Link>
      </div>
      <p className="text-xs text-gray-500">{domain || 'No domain'}</p>
      <p className="text-xs text-gray-500">{industry}</p>
      <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
        <span>{prospectCount} prospect{prospectCount !== 1 ? 's' : ''}</span>
        <span>{oppCount} opp{oppCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

export default function DuplicatesPage() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<null | {
    type: 'merge_left' | 'merge_right' | 'relate' | 'not_duplicate';
    pair: DuplicatePair;
    relType?: RelationshipType;
  }>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [relateDropdowns, setRelateDropdowns] = useState<Record<string, RelationshipType>>({});

  useEffect(() => {
    fetch('/api/accounts/duplicates')
      .then(r => r.json())
      .then(data => setPairs(data.pairs || []))
      .catch(() => setError('Failed to load potential duplicates'))
      .finally(() => setLoading(false));
  }, []);

  const removePair = (pair: DuplicatePair) => {
    setPairs(prev => prev.filter(p => !(p.id1 === pair.id1 && p.id2 === pair.id2)));
  };

  const handleMerge = async (keepId: number, deleteId: number, pair: DuplicatePair) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/accounts/${keepId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mergeFromId: deleteId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Merge failed');
        return;
      }
      removePair(pair);
    } catch {
      setError('Merge failed');
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const handleRelate = async (id1: number, id2: number, type: RelationshipType | 'not_duplicate', pair: DuplicatePair) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/accounts/${id1}/relate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatedAccountId: id2, relationshipType: type }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to save relationship');
        return;
      }
      removePair(pair);
    } catch {
      setError('Failed to save relationship');
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const pairKey = (p: DuplicatePair) => `${p.id1}-${p.id2}`;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/accounts" className="text-sm text-gray-500 hover:text-gray-700">← Accounts</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Potential Duplicate Accounts</h1>
          <p className="text-gray-500 text-sm mt-1">
            Showing up to 200 potential duplicate pairs based on similar company names.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {pairs.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-gray-500 font-medium">No potential duplicates found</p>
          <p className="text-gray-400 text-sm mt-1">All accounts appear to be unique</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pairs.map(pair => (
            <div key={pairKey(pair)} className="bg-white border border-gray-200 rounded-xl p-4">
              {/* Account cards */}
              <div className="flex items-stretch gap-3 mb-4">
                <AccountCard
                  id={pair.id1}
                  name={pair.company_name_1}
                  domain={pair.domain_1}
                  industry={pair.industry_1}
                  tier={pair.tier_1}
                  prospectCount={pair.prospect_count_1}
                  oppCount={pair.opportunity_count_1}
                />
                <div className="flex items-center justify-center shrink-0 text-gray-400 font-bold">vs</div>
                <AccountCard
                  id={pair.id2}
                  name={pair.company_name_2}
                  domain={pair.domain_2}
                  industry={pair.industry_2}
                  tier={pair.tier_2}
                  prospectCount={pair.prospect_count_2}
                  oppCount={pair.opportunity_count_2}
                />
              </div>

              {/* Confirmation state */}
              {pendingAction && pendingAction.pair === pair ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                  {pendingAction.type === 'merge_left' && (
                    <p className="text-orange-800 mb-2">
                      Merge <strong>{pair.company_name_2}</strong> into <strong>{pair.company_name_1}</strong>?
                      All prospects, opportunities, tags and notes will be transferred. This cannot be undone.
                    </p>
                  )}
                  {pendingAction.type === 'merge_right' && (
                    <p className="text-orange-800 mb-2">
                      Merge <strong>{pair.company_name_1}</strong> into <strong>{pair.company_name_2}</strong>?
                      All prospects, opportunities, tags and notes will be transferred. This cannot be undone.
                    </p>
                  )}
                  {pendingAction.type === 'relate' && (
                    <p className="text-orange-800 mb-2">
                      Mark these accounts as <strong>{RELATIONSHIP_LABELS[pendingAction.relType!]}</strong>?
                    </p>
                  )}
                  {pendingAction.type === 'not_duplicate' && (
                    <p className="text-orange-800 mb-2">
                      Mark these accounts as <strong>not duplicates</strong>? They won&apos;t appear here again.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (pendingAction.type === 'merge_left') handleMerge(pair.id1, pair.id2, pair);
                        else if (pendingAction.type === 'merge_right') handleMerge(pair.id2, pair.id1, pair);
                        else if (pendingAction.type === 'relate') handleRelate(pair.id1, pair.id2, pendingAction.relType!, pair);
                        else if (pendingAction.type === 'not_duplicate') handleRelate(pair.id1, pair.id2, 'not_duplicate', pair);
                      }}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 disabled:opacity-50"
                    >
                      {actionLoading ? 'Processing...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setPendingAction(null)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Action buttons */
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPendingAction({ type: 'merge_left', pair })}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                  >
                    Merge → keep &quot;{pair.company_name_1.slice(0, 20)}{pair.company_name_1.length > 20 ? '…' : ''}&quot;
                  </button>
                  <button
                    onClick={() => setPendingAction({ type: 'merge_right', pair })}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
                  >
                    Merge → keep &quot;{pair.company_name_2.slice(0, 20)}{pair.company_name_2.length > 20 ? '…' : ''}&quot;
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <select
                      value={relateDropdowns[pairKey(pair)] || ''}
                      onChange={e => setRelateDropdowns(prev => ({ ...prev, [pairKey(pair)]: e.target.value as RelationshipType }))}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    >
                      <option value="">Mark as related...</option>
                      {(Object.keys(RELATIONSHIP_LABELS) as RelationshipType[]).map(k => (
                        <option key={k} value={k}>{RELATIONSHIP_LABELS[k]}</option>
                      ))}
                    </select>
                    {relateDropdowns[pairKey(pair)] && (
                      <button
                        onClick={() => setPendingAction({ type: 'relate', pair, relType: relateDropdowns[pairKey(pair)] })}
                        className="px-3 py-1.5 border border-blue-400 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-50"
                      >
                        Apply
                      </button>
                    )}
                    <button
                      onClick={() => setPendingAction({ type: 'not_duplicate', pair })}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100"
                    >
                      Not Duplicates
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
