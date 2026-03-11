'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AccountCard from '@/components/AccountCard';
import SearchBar, { FilterState } from '@/components/SearchBar';
import ExportModal from '@/components/ExportModal';
import { usePerspective } from '@/lib/perspective-context';
import { Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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
  oktaPatch?: string | null;
  parentCompany?: string | null;
  parentCompanyRegion?: 'australia' | 'global' | null;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: '',
  tier: '',
  oktaTier: '',
  accountOwner: '',
  oktaAccountOwner: '',
  hqState: '',
  showGlobalParent: false,
  sortBy: '',
};

const ITEMS_PER_PAGE = 30;

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { perspective } = usePerspective();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountOwners, setAccountOwners] = useState<string[]>([]);
  const [oktaAccountOwners, setOktaAccountOwners] = useState<string[]>([]);
  const [hqStates, setHqStates] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Pagination state
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection and bulk retry state
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [isRetrying, setIsRetrying] = useState(false);
  const [reprocessMode, setReprocessMode] = useState<'both' | 'auth0' | 'okta'>('both');

  // Bulk delete state
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk account owner assignment state
  const [newOwnerName, setNewOwnerName] = useState('');
  const [isAssigningOwner, setIsAssigningOwner] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);

  // Track selectable count from IDs endpoint for accurate "Select All" toggle
  const [selectableCount, setSelectableCount] = useState(0);

  // Initialize filters and page from URL params (URL is source of truth)
  useEffect(() => {
    const initFilters = { ...DEFAULT_FILTERS };
    let page = 1;

    // Load from URL params
    searchParams.forEach((value, key) => {
      if (key === 'page') {
        page = Math.max(1, parseInt(value) || 1);
      } else if (key === 'showGlobalParent') {
        initFilters.showGlobalParent = value === 'true';
      } else if (key in initFilters) {
        initFilters[key as keyof FilterState] = value as never;
      }
    });

    setFilters(initFilters);
    setCurrentPage(page);
  }, [searchParams]);

  // Perspective-aware effective default sort
  const isOkta = perspective === 'okta';
  const effectiveDefaultSortBy = isOkta ? 'okta_priority_score' : 'priority_score';

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // Add all non-empty filter values
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'showGlobalParent') {
          // Map showGlobalParent to includeGlobalParent API param
          if (value) params.set('includeGlobalParent', 'true');
          return;
        }
        if (value !== null && value !== '' && value !== DEFAULT_FILTERS[key as keyof FilterState]) {
          params.set(key, String(value));
        }
      });

      // Always send the effective sort (use explicit or perspective-aware default)
      if (!params.has('sortBy')) {
        params.set('sortBy', effectiveDefaultSortBy);
      }

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

      // Set available account owners from API
      if (data.filters?.availableAccountOwners) {
        setAccountOwners(data.filters.availableAccountOwners);
      }
      if (data.filters?.availableOktaAccountOwners) {
        setOktaAccountOwners(data.filters.availableOktaAccountOwners);
      }
      if (data.filters?.availableHqStates) {
        setHqStates(data.filters.availableHqStates);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, effectiveDefaultSortBy]);

  // Fetch accounts when filters change (with debouncing handled by SearchBar)
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setSelectedAccountIds(new Set()); // Clear selection when filters change
    setSelectableCount(0);

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
    setSelectableCount(0);
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

    if (filters.tier) {
      const tierLabel = filters.tier === 'unassigned' ? 'Unassigned' : `Tier ${filters.tier}`;
      active.push({ key: 'tier', label: 'Auth0 Tier', value: tierLabel });
    }

    if (filters.oktaTier) {
      const tierLabel = filters.oktaTier === 'unassigned' ? 'Unassigned' : `Tier ${filters.oktaTier}`;
      active.push({ key: 'oktaTier', label: 'Okta Tier', value: tierLabel });
    }

    if (filters.accountOwner) {
      const ownerVal = filters.accountOwner === 'unassigned' ? 'No Owner' : filters.accountOwner;
      active.push({ key: 'accountOwner', label: 'Auth0 Owner', value: ownerVal });
    }

    if (filters.oktaAccountOwner) {
      const ownerVal = filters.oktaAccountOwner === 'unassigned' ? 'No Owner' : filters.oktaAccountOwner;
      active.push({ key: 'oktaAccountOwner', label: 'Okta Owner', value: ownerVal });
    }

    if (filters.hqState) {
      const stateLabel = filters.hqState === 'unassigned' ? 'Unassigned' : filters.hqState;
      active.push({ key: 'hqState', label: 'HQ State', value: stateLabel });
    }

    if (filters.status) {
      const statusLabels: Record<string, string> = {
        pending: 'Pending',
        processing: 'Processing',
        completed: 'Completed',
        failed: 'Failed',
      };
      active.push({ key: 'status', label: 'Status', value: statusLabels[filters.status] || filters.status });
    }

    if (filters.showGlobalParent) {
      active.push({ key: 'showGlobalParent', label: 'Global Parent', value: 'Showing' });
    }

    if (filters.sortBy && filters.sortBy !== effectiveDefaultSortBy) {
      const sortLabels: Record<string, string> = {
        processed_at: 'Recently Processed',
        created_at: 'Recently Added',
        tier: 'By Tier',
        okta_tier: 'By Okta Tier',
        company_name: 'By Name',
        priority_score: 'Priority Score',
        okta_priority_score: 'Okta Priority Score',
      };
      active.push({ key: 'sortBy', label: 'Sort', value: sortLabels[filters.sortBy] || filters.sortBy });
    }

    return active;
  };

  const activeFilters = getActiveFilters();
  const noOwnerAccounts = accounts.filter((a) => isOkta ? !a.oktaAccountOwner : !a.auth0AccountOwner);
  const ownerFilterActive = filters.accountOwner === 'unassigned' || filters.oktaAccountOwner === 'unassigned';
  const showOwnerMode = ownerFilterActive && noOwnerAccounts.length > 0;

  const handleSelectAll = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'showGlobalParent') {
          if (value) params.set('includeGlobalParent', 'true');
          return;
        }
        if (value !== null && value !== '' && value !== DEFAULT_FILTERS[key as keyof FilterState]) {
          params.set(key, String(value));
        }
      });

      const res = await fetch(`/api/accounts/ids?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch all IDs');
      const data = await res.json();

      const ids = data.ids as number[];
      setSelectedAccountIds(new Set(ids));
      setSelectableCount(ids.length);
    } catch {
      // Fallback to current page selection
      const idsToSelect = accounts.map(a => a.id);
      setSelectedAccountIds(new Set(idsToSelect));
      setSelectableCount(idsToSelect.length);
    }
  };

  const isAllSelected = selectedAccountIds.size > 0 &&
                       selectableCount > 0 &&
                       selectedAccountIds.size >= selectableCount;

  return (
    <main className="mx-auto max-w-7xl pb-32">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Account Research</h1>
            <p className="text-muted-foreground">
              Browse and search all researched accounts
            </p>
          </div>
          <div className="flex gap-2">
          </div>
        </div>
      </div>

      <SearchBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        auth0AccountOwners={accountOwners}
        oktaAccountOwners={oktaAccountOwners}
        hqStates={hqStates}
      />

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
          {activeFilters.map((filter) => (
            <Button
              key={filter.key}
              onClick={() => handleRemoveFilter(filter.key)}
              variant="outline"
              size="sm"
              className="h-7 rounded-full border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            >
              <span className="font-semibold">{filter.label}:</span>
              <span>{filter.value}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          ))}
          <Button
            onClick={handleClearAllFilters}
            variant="link"
            size="sm"
            className="h-7 px-1 text-muted-foreground"
          >
            Clear all filters
          </Button>
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12 text-center text-xl text-muted-foreground">
            Loading accounts...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && accounts.length === 0 && (
        <Card className="bg-muted/20">
          <CardContent className="p-12 text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-muted-foreground/60"
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
                <h3 className="mb-2 text-lg font-medium">No accounts match your filters</h3>
                <p className="mb-4 text-muted-foreground">
                  Try adjusting or clearing your filters to see more results
                </p>
                <Button onClick={handleClearAllFilters}>
                  Clear All Filters
                </Button>
              </>
            ) : (
              <>
                <h3 className="mb-2 text-lg font-medium">No accounts found</h3>
                <p className="mb-4 text-muted-foreground">
                  Upload a CSV file to start researching accounts
                </p>
                <Button asChild>
                  <Link href="/upload">Upload Accounts</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !error && accounts.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalAccounts)} of {totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
              {selectedAccountIds.size > 0 && (
                <span className="ml-2 font-semibold text-primary">
                  ({selectedAccountIds.size} selected)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={isAllSelected ? handleClearSelection : handleSelectAll}
              >
                {isAllSelected ? 'Deselect All' : `Select All (${totalAccounts})`}
              </Button>
              <Button asChild variant="outline">
                <Link href="/accounts/duplicates">Find Duplicates</Link>
              </Button>
              <Button
                onClick={() => setShowExportModal(true)}
                variant="secondary"
                className="gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {selectedAccountIds.size > 0
                  ? `Export Selected (${selectedAccountIds.size})`
                  : `Export ${activeFilters.length > 0 ? 'Filtered' : 'All'} (${totalAccounts})`
                }
              </Button>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          {totalPages > 1 && (
            <div className="mb-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(1)}
                    >
                      1
                    </Button>
                    {currentPage > 4 && <span className="px-2 text-muted-foreground">...</span>}
                  </>
                )}

                {/* Page numbers around current */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage ||
                           (page >= currentPage - 2 && page <= currentPage + 2);
                  })
                  .map(page => (
                    <Button
                      key={page}
                      variant={page === currentPage ? 'default' : 'outline'}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}

                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2 text-muted-foreground">...</span>}
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(totalPages)}
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                selectable
                selected={selectedAccountIds.has(account.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))}
          </div>

          {/* Pagination Controls - Bottom */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(1)}
                    >
                      1
                    </Button>
                    {currentPage > 4 && <span className="px-2 text-muted-foreground">...</span>}
                  </>
                )}

                {/* Page numbers around current */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage ||
                           (page >= currentPage - 2 && page <= currentPage + 2);
                  })
                  .map(page => (
                    <Button
                      key={page}
                      variant={page === currentPage ? 'default' : 'outline'}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}

                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2 text-muted-foreground">...</span>}
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(totalPages)}
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Bulk Action Bar */}
      {selectedAccountIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-2xl">
          <div className="mx-auto max-w-7xl px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-lg font-semibold">
                    {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Bulk mode
                </Badge>
                <Button
                  variant="ghost"
                  onClick={handleClearSelection}
                >
                  Clear
                </Button>
              </div>

              <div className="flex items-center gap-3">
                {/* Reprocess controls */}
                <Select
                  value={reprocessMode}
                  onValueChange={(value) => setReprocessMode(value as 'both' | 'auth0' | 'okta')}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="auth0">Auth0 Only</SelectItem>
                    <SelectItem value="okta">Okta Only</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleBulkRetry}
                  disabled={isRetrying}
                  className="whitespace-nowrap"
                >
                  {isRetrying ? 'Starting...' : `Process (${selectedAccountIds.size})`}
                </Button>

                {/* Owner assignment (only in owner filter mode) */}
                {showOwnerMode && (
                  <>
                    <Separator orientation="vertical" className="h-8" />
                    <Input
                      type="text"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder="Owner name..."
                      className="min-w-[180px]"
                    />
                    <Button
                      onClick={handleBulkAssignOwner}
                      disabled={isAssigningOwner || !newOwnerName.trim()}
                      className="whitespace-nowrap"
                    >
                      {isAssigningOwner ? 'Assigning...' : 'Assign Owner'}
                    </Button>
                  </>
                )}

                {/* Delete */}
                <Separator orientation="vertical" className="h-8" />
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="whitespace-nowrap"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
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
      <main className="mx-auto max-w-7xl">
        <Card>
          <CardContent className="py-12 text-center text-xl text-muted-foreground">
            Loading accounts...
          </CardContent>
        </Card>
      </main>
    }>
      <AccountsPageContent />
    </Suspense>
  );
}
