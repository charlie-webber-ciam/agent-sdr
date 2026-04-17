'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AccountCard from '@/components/AccountCard';
import AccountTable from '@/components/AccountTable';
import SearchBar, { FilterState } from '@/components/SearchBar';
import ExportModal from '@/components/ExportModal';
import { usePerspective } from '@/lib/perspective-context';
import { useToast } from '@/lib/toast-context';
import { Suspense } from 'react';
import { customerStatusLabel } from '@/lib/customer-status';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Account {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  customerStatus?: 'auth0_customer' | 'okta_customer' | 'common_customer' | null;
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
  reviewStatus?: 'new' | 'reviewed' | 'working' | 'dismissed';
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: '',
  customerStatus: '',
  industry: '',
  tier: '',
  oktaTier: '',
  accountOwner: '',
  oktaAccountOwner: '',
  hqState: '',
  oktaPatch: '',
  reviewStatus: '',
  showGlobalParent: false,
  sortBy: '',
};

const ITEMS_PER_PAGE = 30;

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { perspective } = usePerspective();
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountOwners, setAccountOwners] = useState<string[]>([]);
  const [oktaAccountOwners, setOktaAccountOwners] = useState<string[]>([]);
  const [hqStates, setHqStates] = useState<string[]>([]);
  const [oktaPatches, setOktaPatches] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Pagination state
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection and bulk retry state
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [isRetrying, setIsRetrying] = useState(false);
  const [reprocessMode, setReprocessMode] = useState<'both' | 'auth0' | 'okta'>('both');

  // Bulk reprocess confirmation state
  const [showReprocessConfirm, setShowReprocessConfirm] = useState(false);

  // Bulk delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Bulk account owner assignment state
  const [newOwnerName, setNewOwnerName] = useState('');
  const [isAssigningOwner, setIsAssigningOwner] = useState(false);

  // Bulk review status state
  const [isUpdatingReviewStatus, setIsUpdatingReviewStatus] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);

  // View mode state (grid or table)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Search debounce pending state
  const [searchPending, setSearchPending] = useState(false);

  // Track selectable count from IDs endpoint for accurate "Select All" toggle
  const [selectableCount, setSelectableCount] = useState(0);
  const [isSelectingAll, setIsSelectingAll] = useState(false);

  // Initialize filters and page from URL params (URL is source of truth)
  useEffect(() => {
    const initFilters = { ...DEFAULT_FILTERS };
    let page = 1;

    // Load from URL params
    searchParams.forEach((value, key) => {
      if (key === 'page') {
        page = Math.max(1, parseInt(value) || 1);
      } else if (key === 'view') {
        if (value === 'table' || value === 'grid') setViewMode(value);
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
      setHasLoadedOnce(true);

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
      if (data.filters?.availableOktaPatches) {
        setOktaPatches(data.filters.availableOktaPatches);
      }
      if (data.filters?.availableIndustries) {
        setIndustries(data.filters.availableIndustries);
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

  const buildUrlParams = useCallback((overrides: { filters?: FilterState; page?: number; view?: 'grid' | 'table' } = {}) => {
    const f = overrides.filters ?? filters;
    const p = overrides.page ?? currentPage;
    const v = overrides.view ?? viewMode;
    const params = new URLSearchParams();
    Object.entries(f).forEach(([key, value]) => {
      if (value !== null && value !== '' && value !== DEFAULT_FILTERS[key as keyof FilterState]) {
        params.set(key, String(value));
      }
    });
    params.set('page', String(p));
    if (v === 'table') params.set('view', 'table');
    return params;
  }, [filters, currentPage, viewMode]);

  // Build a query string that detail pages use for "Back to Accounts" and prev/next
  const listQuery = useMemo(() => {
    return buildUrlParams().toString();
  }, [buildUrlParams]);

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setSelectedAccountIds(new Set()); // Clear selection when filters change
    setSelectableCount(0);

    const params = buildUrlParams({ filters: newFilters, page: 1 });
    const newUrl = params.toString() ? `/accounts?${params.toString()}` : '/accounts';
    router.push(newUrl, { scroll: false });
  }, [router, buildUrlParams]);

  const handlePageChange = useCallback((newPage: number) => {
    const params = buildUrlParams({ page: newPage });
    router.push(`/accounts?${params.toString()}`, { scroll: true });
  }, [router, buildUrlParams]);

  const handleViewModeChange = useCallback((mode: 'grid' | 'table') => {
    setViewMode(mode);
    const params = buildUrlParams({ view: mode });
    router.push(`/accounts?${params.toString()}`, { scroll: false });
  }, [router, buildUrlParams]);

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

  const handleBulkRetry = () => {
    if (selectedAccountIds.size === 0) return;
    setShowReprocessConfirm(true);
  };

  const executeBulkRetry = async () => {
    setShowReprocessConfirm(false);
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
      toast.error(err instanceof Error ? err.message : 'Failed to reprocess accounts');
      setIsRetrying(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAccountIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const executeBulkDelete = async () => {
    setShowDeleteConfirm(false);
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
      toast.success(`Successfully deleted ${data.deletedCount} account(s).`);
      setSelectedAccountIds(new Set());
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete accounts');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkReviewStatus = async (status: string) => {
    if (selectedAccountIds.size === 0) return;
    setIsUpdatingReviewStatus(true);
    try {
      const res = await fetch('/api/accounts/bulk-review-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: Array.from(selectedAccountIds), reviewStatus: status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update review status');
      }
      const data = await res.json();
      const labels: Record<string, string> = { new: 'New', working: 'Working', reviewed: 'Reviewed', dismissed: 'Dismissed' };
      toast.success(`Marked ${data.updatedCount} account(s) as "${labels[status] || status}".`);
      setSelectedAccountIds(new Set());
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update review status');
    } finally {
      setIsUpdatingReviewStatus(false);
    }
  };

  const handleBulkAssignOwner = async () => {
    if (selectedAccountIds.size === 0) {
      toast.error('Please select at least one account');
      return;
    }

    if (!newOwnerName.trim()) {
      toast.error('Please enter an account owner name');
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
      toast.success(`Updated ${data.successCount} account(s) with owner: ${data.accountOwner}`);

      // Refresh the page to show updated data
      setSelectedAccountIds(new Set());
      setNewOwnerName('');
      fetchAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update account owners');
    } finally {
      setIsAssigningOwner(false);
    }
  };

  // Get active filter chips
  const getActiveFilters = () => {
    const active: Array<{ key: keyof FilterState; label: string; value: string }> = [];

    if (filters.search) active.push({ key: 'search', label: 'Search', value: filters.search });

    if (filters.industry) {
      active.push({ key: 'industry', label: 'Industry', value: filters.industry });
    }

    if (filters.tier) {
      const tierLabel = filters.tier === 'unassigned' ? 'Unassigned' : `Tier ${filters.tier}`;
      active.push({ key: 'tier', label: 'Auth0 Tier', value: tierLabel });
    }

    if (filters.customerStatus) {
      const statusLabel = filters.customerStatus === 'unassigned'
        ? 'Blank'
        : customerStatusLabel(filters.customerStatus as Account['customerStatus']) || filters.customerStatus;
      active.push({ key: 'customerStatus', label: 'Customer Status', value: statusLabel });
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

    if (filters.oktaPatch) {
      const patchLabels: Record<string, string> = {
        emerging: 'Emerging', crp: 'Corporate', ent: 'Enterprise', stg: 'Strategic', pubsec: 'Public Sector', unassigned: 'Unassigned',
      };
      active.push({ key: 'oktaPatch', label: 'Okta Patch', value: patchLabels[filters.oktaPatch] || filters.oktaPatch });
    }

    if (filters.hqState) {
      const stateLabel = filters.hqState === 'unassigned' ? 'Unassigned' : filters.hqState;
      active.push({ key: 'hqState', label: 'HQ State', value: stateLabel });
    }

    if (filters.reviewStatus) {
      const reviewLabels: Record<string, string> = {
        new: 'New',
        working: 'Working',
        reviewed: 'Reviewed',
        dismissed: 'Dismissed',
      };
      active.push({ key: 'reviewStatus', label: 'Review', value: reviewLabels[filters.reviewStatus] || filters.reviewStatus });
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
        industry: 'By Industry',
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
    setIsSelectingAll(true);
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
      // Fallback to current page only — but tell the user
      const idsToSelect = accounts.map(a => a.id);
      setSelectedAccountIds(new Set(idsToSelect));
      setSelectableCount(idsToSelect.length);
      if (totalAccounts > idsToSelect.length) {
        toast.error(`Could not select all ${totalAccounts} accounts. Selected ${idsToSelect.length} on this page only.`);
      }
    } finally {
      setIsSelectingAll(false);
    }
  };

  const isAllSelected = selectedAccountIds.size > 0 &&
                       selectableCount > 0 &&
                       selectedAccountIds.size >= selectableCount;

  return (
    <main className={`mx-auto max-w-7xl ${selectedAccountIds.size > 0 ? 'pb-32' : 'pb-8'}`}>
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
        industries={industries}
        oktaPatches={oktaPatches}
        perspective={perspective}
        onSearchPendingChange={setSearchPending}
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

      {loading && !hasLoadedOnce && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <Card key={i} className="border-l-4 border-l-transparent">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Skeleton className="mb-2 h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-1 h-4 w-5/6" />
                  <Skeleton className="mt-1 h-4 w-2/3" />
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t px-5 py-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {(!loading || hasLoadedOnce) && !error && accounts.length === 0 && (
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

      {(!loading || hasLoadedOnce) && !error && accounts.length > 0 && (
        <>
          {/* Inline loading indicator for re-fetches and search debounce */}
          {(loading || searchPending) && hasLoadedOnce && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {searchPending ? 'Searching...' : 'Updating results...'}
            </div>
          )}
          <div className={`transition-opacity duration-150 ${(loading || searchPending) && hasLoadedOnce ? 'opacity-60 pointer-events-none' : ''}`}>
          <div className="sticky top-14 md:top-0 z-30 bg-background pt-2 pb-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-y-3">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalAccounts)} of {totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
              {selectedAccountIds.size > 0 && (
                <span className="ml-2 font-semibold text-primary">
                  ({selectedAccountIds.size} selected)
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* View mode toggle */}
              <div className="flex rounded-md border border-border">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-r-none border-0 px-2.5"
                  onClick={() => handleViewModeChange('grid')}
                  aria-label="Grid view"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-l-none border-0 px-2.5"
                  onClick={() => handleViewModeChange('table')}
                  aria-label="Table view"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </Button>
              </div>
              <Button
                onClick={isAllSelected ? handleClearSelection : handleSelectAll}
                disabled={isSelectingAll}
              >
                {isSelectingAll ? 'Selecting...' : isAllSelected ? 'Deselect All' : `Select All (${totalAccounts})`}
              </Button>
              <Button asChild variant="outline">
                <Link href="/accounts/map">Account Map</Link>
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
          </div>

          {viewMode === 'table' ? (
            <Card>
              <AccountTable
                accounts={accounts}
                selectable
                selectedIds={selectedAccountIds}
                onSelectionChange={handleSelectionChange}
                sortBy={filters.sortBy || effectiveDefaultSortBy}
                onSortChange={(newSortBy) => {
                  handleFiltersChange({ ...filters, sortBy: newSortBy === effectiveDefaultSortBy ? '' : newSortBy });
                }}
                listQuery={listQuery}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  selectable
                  selected={selectedAccountIds.has(account.id)}
                  onSelectionChange={handleSelectionChange}
                  listQuery={listQuery}
                />
              ))}
            </div>
          )}

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
          </div>
        </>
      )}

      {/* Bulk Action Bar */}
      {selectedAccountIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-2xl">
          <div className="mx-auto max-w-7xl px-8 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Selection info */}
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">
                  {selectedAccountIds.size} selected
                  {selectedAccountIds.size > accounts.length && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">(across all pages)</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                >
                  Clear
                </Button>
              </div>

              <Separator orientation="vertical" className="hidden h-7 sm:block" />

              {/* Reprocess controls */}
              <div className="flex items-center gap-2">
                <Select
                  value={reprocessMode}
                  onValueChange={(value) => setReprocessMode(value as 'both' | 'auth0' | 'okta')}
                >
                  <SelectTrigger className="h-8 w-[130px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="auth0">Auth0 Only</SelectItem>
                    <SelectItem value="okta">Okta Only</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleBulkRetry}
                  disabled={isRetrying}
                  className="whitespace-nowrap"
                >
                  {isRetrying ? 'Starting...' : `Process (${selectedAccountIds.size})`}
                </Button>
              </div>

              {/* Owner assignment (only in owner filter mode) */}
              {showOwnerMode && (
                <>
                  <Separator orientation="vertical" className="hidden h-7 sm:block" />
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder="Owner name..."
                      className="h-8 w-[160px] text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={handleBulkAssignOwner}
                      disabled={isAssigningOwner || !newOwnerName.trim()}
                      className="whitespace-nowrap"
                    >
                      {isAssigningOwner ? 'Assigning...' : 'Assign Owner'}
                    </Button>
                  </div>
                </>
              )}

              {/* Review Status */}
              <Separator orientation="vertical" className="hidden h-7 sm:block" />
              <Select
                value=""
                onValueChange={(value) => handleBulkReviewStatus(value)}
                disabled={isUpdatingReviewStatus}
              >
                <SelectTrigger className="h-8 w-[140px] text-sm">
                  <SelectValue placeholder={isUpdatingReviewStatus ? 'Updating...' : 'Mark as...'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="working">Working</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>

              {/* Delete — pushed to far right on wide screens */}
              <div className="ml-auto">
                <Button
                  variant="destructive"
                  size="sm"
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

      {/* Reprocess Confirmation Dialog */}
      <AlertDialog open={showReprocessConfirm} onOpenChange={setShowReprocessConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprocess {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will run AI research ({reprocessMode === 'both' ? 'Auth0 + Okta' : reprocessMode === 'auth0' ? 'Auth0 only' : 'Okta only'}) on {selectedAccountIds.size === 1 ? 'this account' : `all ${selectedAccountIds.size} selected accounts`}, overwriting existing research data. This may take a while and uses API credits.
                </p>
                {(() => {
                  const selectedNames = accounts
                    .filter(a => selectedAccountIds.has(a.id))
                    .map(a => a.companyName);
                  const maxShow = 5;
                  const shown = selectedNames.slice(0, maxShow);
                  const remaining = selectedAccountIds.size - shown.length;
                  return (
                    <ul className="rounded-md border bg-muted/50 p-2 text-sm max-h-40 overflow-y-auto space-y-1">
                      {shown.map((name, i) => (
                        <li key={i} className="truncate">{name}</li>
                      ))}
                      {remaining > 0 && (
                        <li className="text-muted-foreground italic">
                          and {remaining} more account{remaining !== 1 ? 's' : ''}{selectedAccountIds.size > accounts.length ? ' (across pages)' : ''}
                        </li>
                      )}
                    </ul>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkRetry}>
              Process {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will permanently delete {selectedAccountIds.size === 1 ? 'this account' : `all ${selectedAccountIds.size} selected accounts`} and their research data, categorization, emails, and notes. This action cannot be undone.
                </p>
                {(() => {
                  const selectedNames = accounts
                    .filter(a => selectedAccountIds.has(a.id))
                    .map(a => a.companyName);
                  const maxShow = 5;
                  const shown = selectedNames.slice(0, maxShow);
                  const remaining = selectedAccountIds.size - shown.length;
                  return (
                    <ul className="rounded-md border bg-muted/50 p-2 text-sm max-h-40 overflow-y-auto space-y-1">
                      {shown.map((name, i) => (
                        <li key={i} className="truncate">{name}</li>
                      ))}
                      {remaining > 0 && (
                        <li className="text-muted-foreground italic">
                          and {remaining} more account{remaining !== 1 ? 's' : ''}{selectedAccountIds.size > accounts.length ? ' (across pages)' : ''}
                        </li>
                      )}
                    </ul>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkDelete}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Delete {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
