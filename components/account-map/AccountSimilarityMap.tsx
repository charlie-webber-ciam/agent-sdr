'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import AccountCard from '@/components/AccountCard';
import AccountSimilarityGraph from '@/components/account-map/AccountSimilarityGraph';
import type {
  MapNodeRecord,
  MapResponse,
  Perspective,
  SimilarAccountView,
  ViewMode,
} from '@/components/account-map/types';
import {
  buildSimilarityReasons,
  findScoreBetweenAccounts,
  formatPercent,
  getPerspectiveOwner,
  getPerspectiveTier,
  similarityStrengthLabel,
} from '@/components/account-map/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BackfillJob {
  id: number;
  total_accounts: number;
  processed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  current_account_name: string | null;
}

const DEFAULT_LIMIT = 200;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function toAccountCardModel(record: MapNodeRecord) {
  return {
    id: record.accountId,
    companyName: record.companyName,
    domain: record.domain || '',
    industry: record.industry,
    status: 'completed',
    researchSummary: record.summarySnippet || null,
    processedAt: record.processedAt,
    tier: record.tier as 'A' | 'B' | 'C' | null,
    priorityScore: record.priorityScore,
    auth0AccountOwner: record.auth0AccountOwner,
    oktaTier: record.oktaTier as 'A' | 'B' | 'C' | 'DQ' | null,
    oktaPriorityScore: record.oktaPriorityScore,
    oktaAccountOwner: record.oktaAccountOwner,
  };
}

function cardPerspective(perspective: Perspective): 'auth0' | 'okta' {
  return perspective === 'okta' ? 'okta' : 'auth0';
}

function buildMapParams(options: {
  perspective: Perspective;
  limit: string;
  debouncedSearch: string;
  selectedId: number | null;
  tierFilter: string;
  ownerFilter: string;
}): URLSearchParams {
  const params = new URLSearchParams({
    perspective: options.perspective,
    limit: options.limit || String(DEFAULT_LIMIT),
  });

  if (options.debouncedSearch) params.set('search', options.debouncedSearch);
  if (options.selectedId) params.set('selectedAccountId', String(options.selectedId));

  if (options.perspective === 'okta') {
    if (options.tierFilter) params.set('oktaTier', options.tierFilter);
    if (options.ownerFilter) params.set('oktaAccountOwner', options.ownerFilter);
  } else {
    if (options.tierFilter) params.set('tier', options.tierFilter);
    if (options.ownerFilter) params.set('accountOwner', options.ownerFilter);
  }

  return params;
}

export default function AccountSimilarityMap() {
  const [perspective, setPerspective] = useState<Perspective>('overall');
  const [viewMode, setViewMode] = useState<ViewMode>('focus');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT));
  const [neighborCount, setNeighborCount] = useState('6');
  const [minimumSimilarity, setMinimumSimilarity] = useState('0.34');
  const [showLabels, setShowLabels] = useState(true);

  const [mapData, setMapData] = useState<MapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [inspectedAccountId, setInspectedAccountId] = useState<number | null>(null);
  const [backfillJob, setBackfillJob] = useState<BackfillJob | null>(null);
  const [backfillStarting, setBackfillStarting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 250);
  const minimumSimilarityValue = Number.parseFloat(minimumSimilarity) || 0;
  const neighborCountValue = Number.parseInt(neighborCount, 10) || 6;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = buildMapParams({
      perspective,
      limit,
      debouncedSearch,
      selectedId: selectedAccountId,
      tierFilter,
      ownerFilter,
    });

    fetch(`/api/accounts/map?${params.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load account similarity.');
        }
        return response.json() as Promise<MapResponse>;
      })
      .then((payload) => {
        setMapData(payload);
        setSelectedAccountId((current) => {
          if (current === null) return current;
          const resolved = payload.selectedRecord?.accountId ?? null;
          return current === resolved ? current : resolved;
        });
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load account similarity.');
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, limit, ownerFilter, perspective, selectedAccountId, tierFilter]);

  useEffect(() => {
    setTierFilter('');
    setOwnerFilter('');
    setSelectedAccountId(null);
    setInspectedAccountId(null);
  }, [perspective]);

  useEffect(() => {
    setInspectedAccountId(null);
  }, [selectedAccountId, viewMode]);

  useEffect(() => {
    if (!backfillJob || (backfillJob.status !== 'pending' && backfillJob.status !== 'processing')) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/accounts/vectors/backfill/${backfillJob.id}`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as { job: BackfillJob };
      setBackfillJob(payload.job);

      if (payload.job.status === 'completed' || payload.job.status === 'failed') {
        window.clearInterval(interval);
        const refreshParams = buildMapParams({
          perspective,
          limit,
          debouncedSearch,
          selectedId: selectedAccountId,
          tierFilter,
          ownerFilter,
        });
        const refreshed = await fetch(`/api/accounts/map?${refreshParams.toString()}`, { cache: 'no-store' });
        if (refreshed.ok) {
          const refreshedPayload = await refreshed.json() as MapResponse;
          setMapData(refreshedPayload);
          setSelectedAccountId((current) => {
            if (current === null) return current;
            const resolved = refreshedPayload.selectedRecord?.accountId ?? null;
            return current === resolved ? current : resolved;
          });
        }
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [backfillJob, debouncedSearch, limit, ownerFilter, perspective, selectedAccountId, tierFilter]);

  const accountById = useMemo(() => {
    const records = [
      ...(mapData?.nodes || []),
      ...(mapData?.neighborRecords || []),
      ...(mapData?.selectedRecord ? [mapData.selectedRecord] : []),
    ];

    return new Map(records.map((record) => [record.accountId, record]));
  }, [mapData?.neighborRecords, mapData?.nodes, mapData?.selectedRecord]);

  const selectedRecord = mapData?.selectedRecord || null;
  const effectiveSelectedAccountId = selectedAccountId ?? selectedRecord?.accountId ?? null;
  const selectedInAnchorList = useMemo(
    () => !!selectedRecord && (mapData?.nodes || []).some((node) => node.accountId === selectedRecord.accountId),
    [mapData?.nodes, selectedRecord]
  );

  const similarAccounts = useMemo<SimilarAccountView[]>(() => {
    if (!selectedRecord) return [];

    return selectedRecord.nearestNeighbors.reduce<SimilarAccountView[]>((result, neighbor, index) => {
      const record = accountById.get(neighbor.accountId);
      if (!record) return result;

      result.push({
        rank: index + 1,
        record,
        rawScore: neighbor.rawScore,
        relativeScore: neighbor.spreadScore,
      });

      return result;
    }, []);
  }, [accountById, selectedRecord]);

  const visibleSimilarAccounts = useMemo(
    () => similarAccounts.filter((account) => account.relativeScore >= minimumSimilarityValue).slice(0, neighborCountValue),
    [minimumSimilarityValue, neighborCountValue, similarAccounts]
  );

  const visibleClusterEdges = useMemo(
    () => (mapData?.edges || []).filter((edge) => edge.spreadScore >= minimumSimilarityValue),
    [mapData?.edges, minimumSimilarityValue]
  );

  const activeOwnerOptions = perspective === 'okta'
    ? (mapData?.filters.oktaAccountOwners || [])
    : (mapData?.filters.accountOwners || []);
  const activeTierLabel = perspective === 'okta' ? 'Okta Tier' : 'Tier';

  const inspectedRecord = useMemo(
    () => (inspectedAccountId ? accountById.get(inspectedAccountId) || null : selectedRecord),
    [accountById, inspectedAccountId, selectedRecord]
  );

  const inspectedScore = useMemo(
    () => findScoreBetweenAccounts(selectedRecord, inspectedRecord, mapData?.edges || []),
    [inspectedRecord, mapData?.edges, selectedRecord]
  );

  const inspectedReasons = useMemo(
    () => (inspectedRecord ? buildSimilarityReasons(selectedRecord, inspectedRecord, perspective) : []),
    [inspectedRecord, perspective, selectedRecord]
  );

  const handleStartBackfill = async () => {
    setBackfillStarting(true);
    try {
      const response = await fetch('/api/accounts/vectors/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to start vector backfill.');
      }
      setBackfillJob({
        id: payload.jobId,
        total_accounts: payload.totalAccounts,
        processed_count: 0,
        failed_count: 0,
        status: payload.totalAccounts > 0 ? 'pending' : 'completed',
        error_message: null,
        current_account_name: null,
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start vector backfill.');
    } finally {
      setBackfillStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account Similarity Explorer</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Search chooses the anchor account on the left. The graph on the right keeps similarity context broad so you can see the closest accounts and how clusters form around them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleStartBackfill} disabled={backfillStarting}>
            {backfillStarting ? 'Starting backfill...' : 'Backfill Vectors'}
          </Button>
          <Button asChild variant="outline">
            <Link href="/accounts">Back to Accounts</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2 xl:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
            <Input
              value={search}
              onChange={(event) => {
                setSelectedAccountId(null);
                setInspectedAccountId(null);
                setSearch(event.target.value);
              }}
              placeholder="Search by company or domain"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perspective</label>
            <Select value={perspective} onValueChange={(value) => setPerspective(value as Perspective)}>
              <SelectTrigger>
                <SelectValue placeholder="Select perspective" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overall">Overall</SelectItem>
                <SelectItem value="auth0">Auth0</SelectItem>
                <SelectItem value="okta">Okta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{activeTierLabel}</label>
            <Select value={tierFilter || '__all__'} onValueChange={(value) => {
              setSelectedAccountId(null);
              setInspectedAccountId(null);
              setTierFilter(value === '__all__' ? '' : value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder={`Filter by ${activeTierLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tiers</SelectItem>
                <SelectItem value="A">Tier A</SelectItem>
                <SelectItem value="B">Tier B</SelectItem>
                <SelectItem value="C">Tier C</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</label>
            <Select value={ownerFilter || '__all__'} onValueChange={(value) => {
              setSelectedAccountId(null);
              setInspectedAccountId(null);
              setOwnerFilter(value === '__all__' ? '' : value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All owners</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {activeOwnerOptions.map((owner) => (
                  <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account limit</label>
            <Select value={limit} onValueChange={(value) => {
              setSelectedAccountId(null);
              setInspectedAccountId(null);
              setLimit(value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="300">300</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {backfillJob && (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Vector indexing job #{backfillJob.id} · {backfillJob.status}
              </p>
              <p className="text-sm text-slate-600">
                {backfillJob.processed_count} / {backfillJob.total_accounts} accounts processed
                {backfillJob.current_account_name ? ` · Current: ${backfillJob.current_account_name}` : ''}
                {backfillJob.failed_count > 0 ? ` · Failed: ${backfillJob.failed_count}` : ''}
              </p>
            </div>
            {backfillJob.error_message && (
              <p className="max-w-xl text-sm text-amber-700">{backfillJob.error_message}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle>Indexed Accounts</CardTitle>
            <CardDescription>
              {mapData
                ? `${mapData.nodes.length} accounts loaded from ${mapData.total} indexed matches. Search narrows this list, not the similarity pool.`
                : 'Loading accounts'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="flex min-h-[640px] items-center justify-center text-sm text-slate-500">Loading accounts...</div>
            ) : error ? (
              <div className="flex min-h-[640px] flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm font-medium text-rose-700">{error}</p>
                <p className="max-w-md text-sm text-slate-500">
                  Ensure Qdrant is running and the embedding endpoint is configured before loading similarity results.
                </p>
              </div>
            ) : mapData && mapData.nodes.length > 0 ? (
              <div className="max-h-[calc(100vh-240px)] space-y-4 overflow-y-auto pr-1">
                {mapData.nodes.map((record) => (
                  <AccountCard
                    key={record.accountId}
                    account={toAccountCardModel(record)}
                    selected={effectiveSelectedAccountId === record.accountId}
                    onCardClick={(accountId) => {
                      setInspectedAccountId(null);
                      setSelectedAccountId(accountId);
                    }}
                    displayPerspective={cardPerspective(perspective)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[640px] flex-col items-center justify-center gap-4 p-8 text-center">
                <p className="text-base font-semibold text-slate-900">No indexed accounts match these filters.</p>
                <p className="max-w-md text-sm text-slate-500">
                  Run research on more accounts or backfill vectors for existing completed accounts to populate the similarity browser.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden border-stone-200">
            <Tabs value={viewMode} onValueChange={(value) => {
              setInspectedAccountId(null);
              setViewMode(value as ViewMode);
            }}>
              <CardHeader className="border-b border-stone-100 pb-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <CardTitle>Similarity Workspace</CardTitle>
                    <CardDescription>
                      {viewMode === 'focus'
                        ? 'Focus puts the selected account in the center so you can see the closest matches immediately.'
                        : 'Cluster shows the current filtered set as a relationship map so clusters and isolated accounts are obvious.'}
                    </CardDescription>
                  </div>
                  <TabsList className="bg-stone-100">
                    <TabsTrigger value="focus">Focus</TabsTrigger>
                    <TabsTrigger value="cluster">Cluster</TabsTrigger>
                  </TabsList>
                </div>

                <div className="grid gap-3 pt-2 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible neighbors</label>
                    <Select value={neighborCount} onValueChange={setNeighborCount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Visible neighbors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Minimum similarity</label>
                    <Select value={minimumSimilarity} onValueChange={setMinimumSimilarity}>
                      <SelectTrigger>
                        <SelectValue placeholder="Minimum similarity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">All links</SelectItem>
                        <SelectItem value="0.18">Related and up</SelectItem>
                        <SelectItem value="0.34">Moderate and up</SelectItem>
                        <SelectItem value="0.58">Strong and up</SelectItem>
                        <SelectItem value="0.82">Closest only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-slate-700">
                      <Checkbox
                        checked={showLabels}
                        onCheckedChange={(checked) => setShowLabels(checked === true)}
                        aria-label="Show graph labels"
                      />
                      Show labels
                    </label>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Badge variant="outline" className="border-stone-300 bg-stone-50 text-stone-700">
                      {viewMode === 'focus'
                        ? `${visibleSimilarAccounts.length} visible matches`
                        : `${visibleClusterEdges.length} visible links`}
                    </Badge>
                    <Badge variant="secondary">
                      Threshold {formatPercent(minimumSimilarityValue)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <TabsContent value="focus" className="mt-0 p-4">
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Hover a node to preview its details. Click a node to make it the new center account.
                  </p>
                  <AccountSimilarityGraph
                    mode="focus"
                    perspective={perspective}
                    nodes={mapData?.nodes || []}
                    edges={mapData?.edges || []}
                    selectedRecord={selectedRecord}
                    similarAccounts={similarAccounts}
                    neighborCount={neighborCountValue}
                    minimumRelativeScore={minimumSimilarityValue}
                    showLabels={showLabels}
                    onSelectAccount={(accountId) => {
                      setSelectedAccountId(accountId);
                      setInspectedAccountId(null);
                    }}
                    onInspectAccount={setInspectedAccountId}
                  />
                </div>
              </TabsContent>

              <TabsContent value="cluster" className="mt-0 p-4">
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    The selected account and its immediate neighborhood stay highlighted so you can see where it sits inside the filtered map.
                  </p>
                  <AccountSimilarityGraph
                    mode="cluster"
                    perspective={perspective}
                    nodes={mapData?.nodes || []}
                    edges={mapData?.edges || []}
                    selectedRecord={selectedRecord}
                    similarAccounts={similarAccounts}
                    neighborCount={neighborCountValue}
                    minimumRelativeScore={minimumSimilarityValue}
                    showLabels={showLabels}
                    onSelectAccount={(accountId) => {
                      setSelectedAccountId(accountId);
                      setInspectedAccountId(null);
                    }}
                    onInspectAccount={setInspectedAccountId}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="border-stone-200 bg-gradient-to-br from-stone-50 via-amber-50/50 to-white">
            <CardHeader className="border-b border-stone-100 pb-4">
              <CardTitle>Inspector</CardTitle>
              <CardDescription>
                {inspectedRecord
                  ? 'Hover previews an account here. Click a node or card to use it as the center account.'
                  : 'Select or hover an account to inspect why it is similar.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-4">
              {inspectedRecord ? (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-slate-900">{inspectedRecord.companyName}</h3>
                        {selectedRecord?.accountId === inspectedRecord.accountId ? (
                          <Badge variant="secondary">Current anchor</Badge>
                        ) : inspectedScore ? (
                          <Badge variant="secondary">{similarityStrengthLabel(inspectedScore.relativeScore)}</Badge>
                        ) : null}
                        {!selectedInAnchorList && selectedRecord?.accountId === inspectedRecord.accountId && (
                          <Badge variant="outline">Outside current search results</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        {inspectedRecord.domain || 'No domain'} · {inspectedRecord.industry || 'Unknown industry'}
                      </p>
                    </div>

                    {selectedRecord?.accountId !== inspectedRecord.accountId && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedAccountId(inspectedRecord.accountId);
                          setInspectedAccountId(null);
                        }}
                      >
                        Use As Center
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {inspectedScore && (
                      <>
                        <Badge variant="secondary">Raw {formatPercent(inspectedScore.rawScore)}</Badge>
                        <Badge variant="outline">Relative {formatPercent(inspectedScore.relativeScore)}</Badge>
                      </>
                    )}
                    {getPerspectiveTier(inspectedRecord, perspective) && (
                      <Badge variant="outline">
                        {perspective === 'okta' ? 'Okta ' : ''}Tier {getPerspectiveTier(inspectedRecord, perspective)}
                      </Badge>
                    )}
                    {getPerspectiveOwner(inspectedRecord, perspective) && (
                      <Badge variant="outline">{getPerspectiveOwner(inspectedRecord, perspective)}</Badge>
                    )}
                    {selectedInAnchorList && selectedRecord?.accountId === inspectedRecord.accountId && inspectedRecord.clusterId > 0 && (
                      <Badge variant="outline">Cluster {inspectedRecord.clusterId}</Badge>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div className="rounded-3xl border border-stone-200 bg-white/85 p-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Why This Is Close</h4>
                      <div className="mt-3 space-y-2">
                        {inspectedReasons.map((reason) => (
                          <p key={reason} className="text-sm text-slate-700">{reason}</p>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-stone-200 bg-white/85 p-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Summary Snapshot</h4>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {inspectedRecord.summarySnippet || 'No summary snippet is available for this account yet.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/accounts/${inspectedRecord.accountId}`}>Open Account</Link>
                    </Button>
                    {selectedRecord?.accountId !== inspectedRecord.accountId && (
                      <Button
                        onClick={() => {
                          setSelectedAccountId(inspectedRecord.accountId);
                          setInspectedAccountId(null);
                        }}
                      >
                        Recenter Graph
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-stone-200 bg-white/80 p-6 text-sm text-slate-600">
                  No account is selected yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
