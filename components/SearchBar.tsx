'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, ChevronDown, X } from 'lucide-react';
import { CUSTOMER_STATUS_FILTER_OPTIONS } from '@/lib/customer-status';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FilterState {
  search: string;
  status: string;            // research status filter
  customerStatus: string;    // customer status filter
  industry: string;          // industry filter
  tier: string;              // Auth0 tier
  oktaTier: string;          // Okta tier
  accountOwner: string;      // Auth0 account owner
  oktaAccountOwner: string;  // Okta account owner
  hqState: string;           // HQ state/region filter
  oktaPatch: string;         // Okta patch/segment filter
  reviewStatus: string;      // review workflow status filter
  showGlobalParent: boolean; // show accounts with global parent companies
  sortBy: string;
}

interface SearchBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  auth0AccountOwners: string[];
  oktaAccountOwners: string[];
  hqStates: string[];
  industries: string[];
  oktaPatches?: string[];
  perspective?: 'auth0' | 'okta';
  onSearchPendingChange?: (pending: boolean) => void;
}

const TIERS = ['A', 'B', 'C', 'unassigned'];

const SECONDARY_FILTER_KEYS: (keyof FilterState)[] = [
  'customerStatus', 'industry', 'tier', 'oktaTier', 'accountOwner', 'oktaAccountOwner', 'oktaPatch', 'hqState', 'reviewStatus',
];

function countActiveFilters(filters: FilterState): number {
  let count = 0;
  for (const key of SECONDARY_FILTER_KEYS) {
    if (filters[key]) count++;
  }
  if (filters.showGlobalParent) count++;
  return count;
}

function ControlledSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value || 'all'} onValueChange={(next) => onValueChange(next === 'all' ? '' : next)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SORT_OPTIONS_AUTH0 = [
  { value: 'priority_score', label: 'Priority Score' },
  { value: 'tier', label: 'Tier (A→C)' },
  { value: 'processed_at', label: 'Recently Processed' },
  { value: 'created_at', label: 'Recently Added' },
  { value: 'company_name', label: 'Name (A→Z)' },
  { value: 'industry', label: 'Industry (A→Z)' },
];

const SORT_OPTIONS_OKTA = [
  { value: 'okta_priority_score', label: 'Priority Score' },
  { value: 'okta_tier', label: 'Tier (A→C)' },
  { value: 'processed_at', label: 'Recently Processed' },
  { value: 'created_at', label: 'Recently Added' },
  { value: 'company_name', label: 'Name (A→Z)' },
  { value: 'industry', label: 'Industry (A→Z)' },
];

const OKTA_PATCH_OPTIONS = [
  { value: 'emerging', label: 'Emerging' },
  { value: 'crp', label: 'Corporate' },
  { value: 'ent', label: 'Enterprise' },
  { value: 'stg', label: 'Strategic' },
  { value: 'pubsec', label: 'Public Sector' },
];

export default function SearchBar({ filters, onFiltersChange, auth0AccountOwners, oktaAccountOwners, hqStates, industries, oktaPatches = [], perspective = 'auth0', onSearchPendingChange }: SearchBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [showMore, setShowMore] = useState(false);
  const [searchPending, setSearchPending] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const activeCount = countActiveFilters(filters);

  // Auto-expand if secondary filters are already active
  useEffect(() => {
    if (activeCount > 0) setShowMore(true);
  }, [activeCount]);

  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    // Signal that a search is pending during debounce
    const willChange = value !== filters.search;
    setSearchPending(willChange);
    onSearchPendingChange?.(willChange);
    searchTimerRef.current = setTimeout(() => {
      setSearchPending(false);
      onSearchPendingChange?.(false);
      onFiltersChange({ ...filters, search: value });
    }, 300);
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    setLocalSearch('');
    onFiltersChange({
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
      sortBy: filters.sortBy,
    });
  };

  const hasAnyFilter = !!(filters.search || filters.status || activeCount > 0);

  return (
    <Card className="mb-6">
      <CardContent className="space-y-4 pt-6">
        {/* Primary row: search + status + filter toggle */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1 min-w-0 md:max-w-sm">
            <Label htmlFor="search" className="mb-2 block text-muted-foreground">Search</Label>
            <div className="relative">
              <Input
                id="search"
                type="text"
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Company name or domain..."
                className={searchPending ? 'pr-8' : ''}
              />
              {searchPending && (
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  <svg className="h-4 w-4 animate-spin text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div className="w-full md:w-44">
            <Label htmlFor="status" className="mb-2 block text-muted-foreground">Status</Label>
            <ControlledSelect
              value={filters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
              placeholder="All statuses"
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'processing', label: 'Processing' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
          </div>

          <div className="w-full md:w-52">
            <Label htmlFor="sortBy" className="mb-2 block text-muted-foreground">Sort By</Label>
            <Select
              value={filters.sortBy || (perspective === 'okta' ? 'okta_priority_score' : 'priority_score')}
              onValueChange={(value) => {
                const defaultSort = perspective === 'okta' ? 'okta_priority_score' : 'priority_score';
                onFiltersChange({ ...filters, sortBy: value === defaultSort ? '' : value });
              }}
            >
              <SelectTrigger>
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {(perspective === 'okta' ? SORT_OPTIONS_OKTA : SORT_OPTIONS_AUTH0).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMore((v) => !v)}
              className="gap-1.5"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
              More Filters
              {activeCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 min-w-5 justify-center px-1.5">{activeCount}</Badge>
              )}
            </Button>

            {hasAnyFilter && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible secondary filters */}
        {showMore && (
          <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-7">
              <div>
                <Label htmlFor="customerStatus" className="mb-2 block text-muted-foreground">Customer Status</Label>
                <ControlledSelect
                  value={filters.customerStatus}
                  onValueChange={(value) => handleFilterChange('customerStatus', value)}
                  placeholder="All customer statuses"
                  options={[
                    { value: 'unassigned', label: 'Blank' },
                    ...CUSTOMER_STATUS_FILTER_OPTIONS.map((status) => ({ value: status.value, label: status.label })),
                  ]}
                />
              </div>

              <div>
                <Label htmlFor="industry" className="mb-2 block text-muted-foreground">Industry</Label>
                <ControlledSelect
                  value={filters.industry}
                  onValueChange={(value) => handleFilterChange('industry', value)}
                  placeholder="All industries"
                  options={industries.map((ind) => ({ value: ind, label: ind }))}
                />
              </div>

              <div>
                <Label htmlFor="tier" className="mb-2 block text-muted-foreground">Auth0 Tier</Label>
                <ControlledSelect
                  value={filters.tier}
                  onValueChange={(value) => handleFilterChange('tier', value)}
                  placeholder="All tiers"
                  options={TIERS.map((tier) => ({
                    value: tier,
                    label: tier === 'unassigned' ? 'Unassigned' : `Tier ${tier}`,
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="oktaTier" className="mb-2 block text-muted-foreground">Okta Tier</Label>
                <ControlledSelect
                  value={filters.oktaTier}
                  onValueChange={(value) => handleFilterChange('oktaTier', value)}
                  placeholder="All tiers"
                  options={TIERS.map((tier) => ({
                    value: tier,
                    label: tier === 'unassigned' ? 'Unassigned' : `Tier ${tier}`,
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="accountOwner" className="mb-2 block text-muted-foreground">Auth0 Owner</Label>
                <ControlledSelect
                  value={filters.accountOwner}
                  onValueChange={(value) => handleFilterChange('accountOwner', value)}
                  placeholder="All owners"
                  options={[
                    { value: 'unassigned', label: 'No Owner' },
                    ...auth0AccountOwners.map((owner) => ({ value: owner, label: owner })),
                  ]}
                />
              </div>

              <div>
                <Label htmlFor="oktaAccountOwner" className="mb-2 block text-muted-foreground">Okta Owner</Label>
                <ControlledSelect
                  value={filters.oktaAccountOwner}
                  onValueChange={(value) => handleFilterChange('oktaAccountOwner', value)}
                  placeholder="All owners"
                  options={[
                    { value: 'unassigned', label: 'No Owner' },
                    ...oktaAccountOwners.map((owner) => ({ value: owner, label: owner })),
                  ]}
                />
              </div>

              {oktaPatches.length > 0 && (
                <div>
                  <Label htmlFor="oktaPatch" className="mb-2 block text-muted-foreground">Okta Patch</Label>
                  <ControlledSelect
                    value={filters.oktaPatch}
                    onValueChange={(value) => handleFilterChange('oktaPatch', value)}
                    placeholder="All patches"
                    options={[
                      { value: 'unassigned', label: 'Unassigned' },
                      ...OKTA_PATCH_OPTIONS.filter((opt) => oktaPatches.includes(opt.value)),
                    ]}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="hqState" className="mb-2 block text-muted-foreground">HQ State</Label>
                <ControlledSelect
                  value={filters.hqState}
                  onValueChange={(value) => handleFilterChange('hqState', value)}
                  placeholder="All states"
                  options={[
                    { value: 'unassigned', label: 'Unassigned' },
                    ...hqStates.map((state) => ({ value: state, label: state })),
                  ]}
                />
              </div>

              <div>
                <Label htmlFor="reviewStatus" className="mb-2 block text-muted-foreground">Review Status</Label>
                <ControlledSelect
                  value={filters.reviewStatus}
                  onValueChange={(value) => handleFilterChange('reviewStatus', value)}
                  placeholder="All statuses"
                  options={[
                    { value: 'new', label: 'New' },
                    { value: 'working', label: 'Working' },
                    { value: 'reviewed', label: 'Reviewed' },
                    { value: 'dismissed', label: 'Dismissed' },
                  ]}
                />
              </div>
            </div>

            <Button
              variant={filters.showGlobalParent ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onFiltersChange({ ...filters, showGlobalParent: !filters.showGlobalParent })}
            >
              {filters.showGlobalParent ? 'Showing Global Parent Accounts' : 'Global Parent Accounts Hidden'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
