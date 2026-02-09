'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AccountCard from '@/components/AccountCard';
import SearchBar, { FilterState } from '@/components/SearchBar';

interface Account {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  status: string;
  researchSummary: string | null;
  processedAt: string | null;
  tier?: 'A' | 'B' | 'C' | null;
  priorityScore?: number | null;
  auth0Skus?: string[];
  auth0AccountOwner?: string | null;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  industry: '',
  status: '',
  tier: '',
  sku: '',
  useCase: '',
  minPriority: null,
  revenue: '',
  accountOwner: '',
  sortBy: 'priority_score',
};

export default function AccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);
  const [accountOwners, setAccountOwners] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Selection and bulk retry state
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [currentStatusFilter, setCurrentStatusFilter] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);

  // Bulk account owner assignment state
  const [showOwnerAssignment, setShowOwnerAssignment] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [isAssigningOwner, setIsAssigningOwner] = useState(false);

  // Initialize filters from URL and localStorage on mount
  useEffect(() => {
    const initFilters = { ...DEFAULT_FILTERS };

    // First try localStorage (for returning users)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('accountFilters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          Object.assign(initFilters, parsed);
        } catch (e) {
          console.error('Failed to parse saved filters:', e);
        }
      }
    }

    // URL params override localStorage (for shared links)
    searchParams.forEach((value, key) => {
      if (key in initFilters) {
        if (key === 'minPriority') {
          initFilters[key] = value ? parseInt(value) : null;
        } else {
          initFilters[key as keyof FilterState] = value as never;
        }
      }
    });

    setFilters(initFilters);
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // Add all non-empty filter values
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== '' && value !== DEFAULT_FILTERS[key as keyof FilterState]) {
          params.set(key, String(value));
        }
      });

      const res = await fetch(`/api/accounts?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = await res.json();
      setAccounts(data.accounts);

      // Extract unique industries for filter dropdown
      const uniqueIndustries = Array.from(
        new Set(data.accounts.map((a: Account) => a.industry))
      ) as string[];
      setIndustries(uniqueIndustries);

      // Set available account owners from API
      if (data.filters?.availableAccountOwners) {
        setAccountOwners(data.filters.availableAccountOwners);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch accounts when filters change (with debouncing handled by SearchBar)
  useEffect(() => {
    if (filters === DEFAULT_FILTERS && !searchParams.toString()) {
      // Skip initial render before filters are loaded
      return;
    }
    fetchAccounts();
  }, [filters, fetchAccounts, searchParams]);

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentStatusFilter(newFilters.status);
    setSelectedAccountIds(new Set()); // Clear selection when filters change

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('accountFilters', JSON.stringify(newFilters));
    }

    // Update URL params
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== null && value !== '' && value !== DEFAULT_FILTERS[key as keyof FilterState]) {
        params.set(key, String(value));
      }
    });

    const newUrl = params.toString() ? `/accounts?${params.toString()}` : '/accounts';
    router.push(newUrl, { scroll: false });
  }, [router]);

  const handleClearAllFilters = () => {
    handleFiltersChange(DEFAULT_FILTERS);
  };

  const handleRemoveFilter = (key: keyof FilterState) => {
    handleFiltersChange({ ...filters, [key]: DEFAULT_FILTERS[key] });
  };

  const handleShowFailedOnly = () => {
    handleFiltersChange({ ...filters, status: 'failed' });
  };

  const handleSelectionChange = (accountId: number, selected: boolean) => {
    setSelectedAccountIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(accountId);
      } else {
        newSet.delete(accountId);
      }
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedAccountIds(new Set());
  };

  const handleBulkRetry = async () => {
    if (selectedAccountIds.size === 0) return;

    setIsRetrying(true);
    try {
      const res = await fetch('/api/accounts/retry-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountIds: Array.from(selectedAccountIds),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retry accounts');
      }

      const data = await res.json();
      router.push(data.redirectUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry accounts');
      setIsRetrying(false);
    }
  };

  const handleBulkAssignOwner = async () => {
    if (selectedAccountIds.size === 0) {
      alert('Please select at least one account');
      return;
    }

    if (!newOwnerName.trim()) {
      alert('Please enter an account owner name');
      return;
    }

    setIsAssigningOwner(true);
    try {
      const res = await fetch('/api/accounts/bulk-update-owner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountIds: Array.from(selectedAccountIds),
          accountOwner: newOwnerName.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update account owners');
      }

      const data = await res.json();
      alert(`Success! Updated ${data.successCount} account(s) with owner: ${data.accountOwner}`);

      // Refresh the page to show updated data
      setSelectedAccountIds(new Set());
      setNewOwnerName('');
      setShowOwnerAssignment(false);
      fetchAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update account owners');
    } finally {
      setIsAssigningOwner(false);
    }
  };

  // Get active filter chips
  const getActiveFilters = () => {
    const active: Array<{ key: keyof FilterState; label: string; value: string }> = [];

    if (filters.search) active.push({ key: 'search', label: 'Search', value: filters.search });
    if (filters.industry) active.push({ key: 'industry', label: 'Industry', value: filters.industry });
    if (filters.status) active.push({ key: 'status', label: 'Status', value: filters.status });
    if (filters.tier) {
      const tierLabel = filters.tier === 'unassigned' ? 'Unassigned' : `Tier ${filters.tier}`;
      active.push({ key: 'tier', label: 'Tier', value: tierLabel });
    }
    if (filters.sku) active.push({ key: 'sku', label: 'SKU', value: filters.sku });
    if (filters.useCase) active.push({ key: 'useCase', label: 'Use Case', value: filters.useCase });
    if (filters.minPriority !== null) {
      active.push({ key: 'minPriority', label: 'Min Priority', value: `≥ ${filters.minPriority}` });
    }
    if (filters.revenue) active.push({ key: 'revenue', label: 'Revenue', value: filters.revenue });
    if (filters.accountOwner) {
      const ownerValue = filters.accountOwner === 'unassigned' ? 'No Owner' : filters.accountOwner;
      active.push({ key: 'accountOwner', label: 'Account Owner', value: ownerValue });
    }
    if (filters.sortBy && filters.sortBy !== 'priority_score') {
      const sortLabels: Record<string, string> = {
        processed_at: 'Recently Processed',
        created_at: 'Recently Added',
        tier: 'By Tier',
        company_name: 'By Name',
      };
      active.push({ key: 'sortBy', label: 'Sort', value: sortLabels[filters.sortBy] || filters.sortBy });
    }

    return active;
  };

  const activeFilters = getActiveFilters();
  const failedAccounts = accounts.filter((a) => a.status === 'failed');
  const pendingAccounts = accounts.filter((a) => a.status === 'pending');
  const noOwnerAccounts = accounts.filter((a) => !a.auth0AccountOwner);
  const retryableAccounts = (currentStatusFilter === 'failed') ? failedAccounts :
                            (currentStatusFilter === 'pending') ? pendingAccounts : [];
  const showRetryMode = (currentStatusFilter === 'failed' || currentStatusFilter === 'pending') &&
                        retryableAccounts.length > 0;
  const showOwnerMode = filters.accountOwner === 'unassigned' && noOwnerAccounts.length > 0;
  const showSelectionMode = showRetryMode || showOwnerMode;

  const handleSelectAll = () => {
    let idsToSelect: number[] = [];

    if (showRetryMode) {
      idsToSelect = retryableAccounts.map(a => a.id);
    } else if (showOwnerMode) {
      idsToSelect = noOwnerAccounts.map(a => a.id);
    }

    setSelectedAccountIds(new Set(idsToSelect));
  };

  const selectableAccounts = showRetryMode ? retryableAccounts :
                            showOwnerMode ? noOwnerAccounts : [];
  const isAllSelected = selectableAccounts.length > 0 &&
                       selectedAccountIds.size === selectableAccounts.length;

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto pb-32">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Account Research</h1>
            <p className="text-gray-600">
              Browse and search all researched accounts
            </p>
          </div>
          <div className="flex gap-2">
            {failedAccounts.length > 0 && currentStatusFilter !== 'failed' && (
              <button
                onClick={handleShowFailedOnly}
                className="px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-lg font-semibold hover:bg-red-200 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Show Failed Only ({failedAccounts.length})
              </button>
            )}
            {pendingAccounts.length > 0 && currentStatusFilter !== 'pending' && (
              <button
                onClick={() => handleFiltersChange({ ...filters, status: 'pending' })}
                className="px-4 py-2 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-lg font-semibold hover:bg-yellow-200 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Show Pending Only ({pendingAccounts.length})
              </button>
            )}
            {noOwnerAccounts.length > 0 && filters.accountOwner !== 'unassigned' && (
              <button
                onClick={() => handleFiltersChange({ ...filters, accountOwner: 'unassigned' })}
                className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-300 rounded-lg font-semibold hover:bg-blue-200 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Show No Owner ({noOwnerAccounts.length})
              </button>
            )}
          </div>
        </div>
      </div>

      <SearchBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        industries={industries}
        accountOwners={accountOwners}
      />

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 font-medium">Active filters:</span>
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => handleRemoveFilter(filter.key)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors"
            >
              <span className="font-semibold">{filter.label}:</span>
              <span>{filter.value}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
          <button
            onClick={handleClearAllFilters}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 font-medium underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-xl text-gray-600">Loading accounts...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && accounts.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {activeFilters.length > 0 ? (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No accounts match your filters
              </h3>
              <p className="text-gray-600 mb-4">
                Try adjusting or clearing your filters to see more results
              </p>
              <button
                onClick={handleClearAllFilters}
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Clear All Filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No accounts found
              </h3>
              <p className="text-gray-600 mb-4">
                Upload a CSV file to start researching accounts
              </p>
              <a
                href="/upload"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Upload Accounts
              </a>
            </>
          )}
        </div>
      )}

      {!loading && !error && accounts.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              {showSelectionMode && selectedAccountIds.size > 0 && (
                <span className="ml-2 text-blue-600 font-semibold">
                  ({selectedAccountIds.size} selected)
                </span>
              )}
            </div>
            {showSelectionMode && (
              <button
                onClick={isAllSelected ? handleClearSelection : handleSelectAll}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => {
              const isSelectable = showRetryMode
                ? (account.status === 'failed' || account.status === 'pending')
                : showOwnerMode
                ? !account.auth0AccountOwner
                : false;

              return (
                <AccountCard
                  key={account.id}
                  account={account}
                  selectable={isSelectable}
                  selected={selectedAccountIds.has(account.id)}
                  onSelectionChange={handleSelectionChange}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Bulk Action Bar - Retry Mode */}
      {selectedAccountIds.size > 0 && showRetryMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-lg font-semibold text-gray-900">
                    {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <button
                  onClick={handleClearSelection}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                >
                  Clear Selection
                </button>
              </div>
              <button
                onClick={handleBulkRetry}
                disabled={isRetrying}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isRetrying ? 'Processing...' : 'Reprocess Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar - Owner Assignment Mode */}
      {selectedAccountIds.size > 0 && showOwnerMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-200 shadow-2xl">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-lg font-semibold text-gray-900">
                    {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <button
                  onClick={handleClearSelection}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                >
                  Clear Selection
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="owner-input" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Assign Owner:
                  </label>
                  <input
                    id="owner-input"
                    type="text"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="Enter owner name..."
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px]"
                  />
                </div>
                <button
                  onClick={handleBulkAssignOwner}
                  disabled={isAssigningOwner || !newOwnerName.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {isAssigningOwner ? 'Assigning...' : 'Assign Owner'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
