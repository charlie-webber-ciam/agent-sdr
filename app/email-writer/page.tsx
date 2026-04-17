'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import EmailWriter from '@/components/EmailWriter';
import LeadReportEmailWriter from '@/components/LeadReportEmailWriter';
import StandaloneEmailWriter from '@/components/StandaloneEmailWriter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STORAGE_KEY = 'sdr-email-writer-context-account-id';

interface AccountSearchItem {
  id: number;
  companyName: string;
  domain: string | null;
  industry: string | null;
  status: string;
  processedAt: string | null;
  oktaProcessedAt: string | null;
}

function hasResearchContext(account: AccountSearchItem): boolean {
  return Boolean(account.processedAt || account.oktaProcessedAt);
}

function mapSearchAccount(raw: {
  id: number;
  companyName: string;
  domain?: string | null;
  industry?: string | null;
  status?: string;
  processedAt?: string | null;
  oktaProcessedAt?: string | null;
}): AccountSearchItem {
  return {
    id: raw.id,
    companyName: raw.companyName,
    domain: raw.domain ?? null,
    industry: raw.industry ?? null,
    status: raw.status ?? 'unknown',
    processedAt: raw.processedAt ?? null,
    oktaProcessedAt: raw.oktaProcessedAt ?? null,
  };
}

export default function EmailWriterPage() {
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState<AccountSearchItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingSavedContext, setLoadingSavedContext] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeAccount, setActiveAccount] = useState<AccountSearchItem | null>(null);

  const fetchAccounts = useCallback(async (searchQuery: string): Promise<AccountSearchItem[]> => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    params.set('status', 'completed');
    params.set('limit', '25');
    params.set('offset', '0');

    const response = await fetch(`/api/accounts?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch accounts');
    }

    const rawAccounts = Array.isArray(data.accounts) ? data.accounts : [];
    return rawAccounts.map(mapSearchAccount);
  }, []);

  const fetchAccountById = useCallback(async (accountId: number): Promise<AccountSearchItem> => {
    const response = await fetch(`/api/accounts/${accountId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch account context');
    }

    return mapSearchAccount({
      id: data.id,
      companyName: data.companyName,
      domain: data.domain,
      industry: data.industry,
      status: data.status,
      processedAt: data.processedAt,
      oktaProcessedAt: data.oktaProcessedAt,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      setLoadingAccounts(true);
      setSearchError(null);
      try {
        const next = await fetchAccounts(query.trim());
        if (!cancelled) {
          setAccounts(next);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchError(error instanceof Error ? error.message : 'Failed to search accounts');
          setAccounts([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingAccounts(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, fetchAccounts]);

  useEffect(() => {
    let cancelled = false;

    const hydrateSavedContext = async () => {
      if (typeof window === 'undefined') {
        setLoadingSavedContext(false);
        return;
      }

      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setLoadingSavedContext(false);
        return;
      }

      const parsed = Number.parseInt(stored, 10);
      if (!Number.isFinite(parsed)) {
        window.localStorage.removeItem(STORAGE_KEY);
        setLoadingSavedContext(false);
        return;
      }

      try {
        const account = await fetchAccountById(parsed);
        if (!cancelled) {
          setActiveAccount(account);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        if (!cancelled) {
          setLoadingSavedContext(false);
        }
      }
    };

    hydrateSavedContext();

    return () => {
      cancelled = true;
    };
  }, [fetchAccountById]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeAccount) {
      window.localStorage.setItem(STORAGE_KEY, String(activeAccount.id));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeAccount]);

  const resultsLabel = useMemo(() => {
    if (loadingAccounts) return 'Searching...';
    if (query.trim()) return `${accounts.length} result${accounts.length === 1 ? '' : 's'}`;
    return `${accounts.length} accounts`;
  }, [loadingAccounts, query, accounts.length]);

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Email Writer Agent</h1>
        <p className="text-sm text-gray-600">
          Run live company research for one-off outbound emails, or switch to saved account context if you want to reuse existing research.
        </p>
      </div>

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList className="w-fit">
          <TabsTrigger value="live">Live Research</TabsTrigger>
          <TabsTrigger value="lead-report">Lead Report</TabsTrigger>
          <TabsTrigger value="saved">Saved Account</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-0">
          <StandaloneEmailWriter />
        </TabsContent>

        <TabsContent value="lead-report" className="mt-0">
          <LeadReportEmailWriter />
        </TabsContent>

        <TabsContent value="saved" className="mt-0">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Account Context</h2>
                <span className="text-xs text-gray-500">{resultsLabel}</span>
              </div>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search accounts..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-9 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {searchError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {searchError}
                </div>
              )}

              <div className="max-h-[64vh] space-y-2 overflow-y-auto pr-1">
                {loadingAccounts && (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading accounts...
                  </div>
                )}

                {!loadingAccounts && accounts.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-sm text-gray-500">
                    No accounts found for this search.
                  </div>
                )}

                {!loadingAccounts && accounts.map((account) => {
                  const selected = activeAccount?.id === account.id;
                  const available = hasResearchContext(account);

                  return (
                    <div
                      key={account.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        selected
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="mb-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{account.companyName}</p>
                        <p className="truncate text-xs text-gray-500">
                          {account.domain || 'No domain'}{account.industry ? ` • ${account.industry}` : ''}
                        </p>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {account.processedAt && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            Auth0 context
                          </span>
                        )}
                        {account.oktaProcessedAt && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                            Okta context
                          </span>
                        )}
                        {!available && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            No research context
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!available || selected}
                        onClick={() => setActiveAccount(account)}
                        className="w-full rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                      >
                        {selected ? 'Using This Context' : 'Use This Account Context'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Active Context</h2>
                    {loadingSavedContext && !activeAccount ? (
                      <p className="mt-1 text-xs text-gray-500">Loading saved context...</p>
                    ) : activeAccount ? (
                      <div className="mt-1 space-y-1">
                        <p className="text-sm font-medium text-gray-900">{activeAccount.companyName}</p>
                        <p className="text-xs text-gray-500">
                          {activeAccount.domain || 'No domain'}{activeAccount.industry ? ` • ${activeAccount.industry}` : ''}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500">
                        Select an account from the left to start writing.
                      </p>
                    )}
                  </div>

                  {activeAccount && (
                    <button
                      type="button"
                      onClick={() => setActiveAccount(null)}
                      className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Clear Context
                    </button>
                  )}
                </div>
              </div>

              {activeAccount ? (
                <EmailWriter accountId={activeAccount.id} account={activeAccount} />
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
                  <p className="text-sm font-medium text-gray-700">No account context selected</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Search and choose an account on the left, then the saved-account email writer will appear here.
                  </p>
                </div>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
