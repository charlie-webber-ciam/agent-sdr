'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AccountCard from '@/components/AccountCard';
import SearchBar, { FilterState } from '@/components/SearchBar';
import ExportModal from '@/components/ExportModal';
import { usePerspective } from '@/lib/perspective-context';
import { Suspense } from 'react';

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
  oktaTier?: 'A' | 'B' | 'C' | null;
  oktaPriorityScore?: number | null;
  oktaSkus?: string[];
  oktaAccountOwner?: string | null;
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
  freshness: '',
  tag: '',
};

const ITEMS_PER_PAGE = 30;

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { perspective } = usePerspective();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);
  const [accountOwners, setAccountOwners] = useState<string[]>([]);
  const [oktaAccountOwners, setOktaAccountOwners] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Pagination state
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection and bulk retry state
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [currentStatusFilter, setCurrentStatusFilter] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [reprocessMode, setReprocessMode] = useState<'both' | 'auth0' | 'okta'>('both');

  // Bulk delete state
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk account owner assignment state
  const [newOwnerName, setNewOwnerName] = useState('');
  const [isAssigningOwner, setIsAssigningOwner] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);

  // Initialize filters and page from URL params (URL is source of truth)
  useEffect(() => {
    const initFilters = { ...DEFAULT_FILTERS };
    let page = 1;

    // Load from URL params
    searchParams.forEach((value, key) => {
      if (key === 'page') {
        page = Math.max(1, parseInt(value) || 1);
      } else if (key in initFilters) {
        if (key === 'minPriority') {
          initFilters[key] = value ? parseInt(value) : null;
        } else {
          initFilters[key as keyof FilterState] = value as never;
        }
      }
    });

    setFilters(initFilters);
    setCurrentPage(page);
  }, [searchParams]);

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

      // Add pagination
      params.set('limit', String(ITEMS_PER_PAGE));
      params.set('offset', String((currentPage - 1) * ITEMS_PER_PAGE));

      const res = await fetch(`/api/accounts?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = await res.json();
      setAccounts(data.accounts);
      setTotalAccounts(data.total);
      setTotalPages(data.pagination.totalPages);

      // Extract unique industries for filter dropdown
      const uniqueIndustries = Array.from(
        new Set(data.accounts.map((a: Account) => a.industry))
      ) as string[];
      setIndustries(uniqueIndustries);

      // Set available account owners from API
      if (data.filters?.availableAccountOwners) {
        setAccountOwners(data.filters.availableAccountOwners);
      }
      if (data.filters?.availableOktaAccountOwners) {
        setOktaAccountOwners(data.filters.availableOktaAccountOwners);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage]);

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

    // Update URL params (reset to page 1 when filters change)
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== null && value !== '' && value !== DEFAULT_FILTERS[key as keyof FilterState]) {
        params.set(key, String(value));
      }
    });
    params.set('page', '1'); // Reset to first page on filter change

    const newUrl = params.toString() ? `/accounts?${params.toString()}` : '/accounts';
    router.push(newUrl, { scroll: false });
  }, [router]);

  const handlePageChange = useCallback((newPage: number) => {
    // Update URL with new page number
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== '' && value !== DEFAULT_FILTERS[key as keyof FilterState]) {
        params.set(key, String(value));
      }
    });
    params.set('page', String(newPage));

    router.push(`/accounts?${params.toString()}`, { scroll: true });
  }, [filters, router]);

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
      const res = await fetch('/api/accounts/reprocess-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountIds: Array.from(selectedAccountIds),
          researchType: reprocessMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reprocess accounts');
      }

      const data = await res.json();
      router.push(data.redirectUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reprocess accounts');
      setIsRetrying(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAccountIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedAccountIds.size} account(s)? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/accounts/bulk-delete', {
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
        throw new Error(data.error || 'Failed to delete accounts');
      }

      const data = await res.json();
      alert(`Successfully deleted ${data.deletedCount} account(s).`);
      setSelectedAccountIds(new Set());
      fetchAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete accounts');
    } finally {
      setIsDeleting(false);
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
          ownerType: perspective,
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
    if (filters.freshness) {
      const freshnessLabels: Record<string, string> = {
        fresh: 'Fresh (<30d)',
        aging: 'Aging (30-60d)',
        stale: 'Stale (>60d)',
      };
      active.push({ key: 'freshness', label: 'Freshness', value: freshnessLabels[filters.freshness] || filters.freshness });
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
  const isOkta = perspective === 'okta';
  const noOwnerAccounts = accounts.filter((a) => isOkta ? !a.oktaAccountOwner : !a.auth0AccountOwner);
  const retryableAccounts = (currentStatusFilter === 'failed') ? failedAccounts :
                            (currentStatusFilter === 'pending') ? pendingAccounts : [];
  const showRetryMode = (currentStatusFilter === 'failed' || currentStatusFilter === 'pending') &&
                        retryableAccounts.length > 0;
  const ownerFilterActive = isOkta ? filters.oktaAccountOwner === 'unassigned' : filters.accountOwner === 'unassigned';
  const showOwnerMode = ownerFilterActive && noOwnerAccounts.length > 0;
  const showSelectionMode = showRetryMode || showOwnerMode;

  const handleSelectAll = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== '' && value !== DEFAULT_FILTERS[key as keyof FilterState]) {
          params.set(key, String(value));
        }
      });

      const res = await fetch(`/api/accounts/ids?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch all IDs');
      const data = await res.json();

      setSelectedAccountIds(new Set(data.ids as number[]));
    } catch {
      // Fallback to current page selection
      let idsToSelect: number[] = [];
      if (showRetryMode) {
        idsToSelect = retryableAccounts.map(a => a.id);
      } else if (showOwnerMode) {
        idsToSelect = noOwnerAccounts.map(a => a.id);
      }
      setSelectedAccountIds(new Set(idsToSelect));
    }
  };

  const isAllSelected = selectedAccountIds.size > 0 &&
                       selectedAccountIds.size >= totalAccounts;

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
            {noOwnerAccounts.length > 0 && !ownerFilterActive && (
              <button
                onClick={() => {
                  if (isOkta) {
                    handleFiltersChange({ ...filters, oktaAccountOwner: 'unassigned' });
                  } else {
                    handleFiltersChange({ ...filters, accountOwner: 'unassigned' });
                  }
                }}
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
        oktaAccountOwners={oktaAccountOwners}
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
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalAccounts)} of {totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
              {showSelectionMode && selectedAccountIds.size > 0 && (
                <span className="ml-2 text-blue-600 font-semibold">
                  ({selectedAccountIds.size} selected)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {showSelectionMode && (
                <button
                  onClick={isAllSelected ? handleClearSelection : handleSelectAll}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  {isAllSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
              <Link
                href="/accounts/duplicates"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors text-sm"
              >
                Find Duplicates
              </Link>
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {selectedAccountIds.size > 0
                  ? `Export Selected (${selectedAccountIds.size})`
                  : `Export ${activeFilters.length > 0 ? 'Filtered' : 'All'} (${totalAccounts})`
                }
              </button>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          {totalPages > 1 && (
            <div className="mb-6 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      1
                    </button>
                    {currentPage > 4 && <span className="px-2 text-gray-500">...</span>}
                  </>
                )}

                {/* Page numbers around current */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage ||
                           (page >= currentPage - 2 && page <= currentPage + 2);
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-4 py-2 border rounded-lg transition-colors ${
                        page === currentPage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2 text-gray-500">...</span>}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => {
              const isSelectable = showRetryMode
                ? (account.status === 'failed' || account.status === 'pending')
                : showOwnerMode
                ? (isOkta ? !account.oktaAccountOwner : !account.auth0AccountOwner)
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

          {/* Pagination Controls - Bottom */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      1
                    </button>
                    {currentPage > 4 && <span className="px-2 text-gray-500">...</span>}
                  </>
                )}

                {/* Page numbers around current */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage ||
                           (page >= currentPage - 2 && page <= currentPage + 2);
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-4 py-2 border rounded-lg transition-colors ${
                        page === currentPage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2 text-gray-500">...</span>}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          )}
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
              <div className="flex items-center gap-3">
                {/* Reprocess Mode Selector */}
                <div className="flex items-center gap-2 border-l pl-4">
                  <span className="text-sm font-medium text-gray-700">Research Type:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReprocessMode('both')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        reprocessMode === 'both'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Both
                    </button>
                    <button
                      onClick={() => setReprocessMode('auth0')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        reprocessMode === 'auth0'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Auth0
                    </button>
                    <button
                      onClick={() => setReprocessMode('okta')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        reprocessMode === 'okta'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Okta
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {isDeleting ? 'Deleting...' : 'Delete Selected'}
                </button>
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

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedAccountIds={selectedAccountIds}
        currentFilters={filters}
        totalFilteredAccounts={totalAccounts}
      />
    </main>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="text-xl text-gray-600">Loading accounts...</div>
        </div>
      </main>
    }>
      <AccountsPageContent />
    </Suspense>
  );
}
