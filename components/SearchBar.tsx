'use client';

import { useState, useEffect, useRef } from 'react';

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
  tier: string;              // Auth0 tier
  oktaTier: string;          // Okta tier
  accountOwner: string;      // Auth0 account owner
  oktaAccountOwner: string;  // Okta account owner
  hqState: string;           // HQ state/region filter
  showGlobalParent: boolean; // show accounts with global parent companies
  sortBy: string;            // not exposed in UI, kept for default sort
}

interface SearchBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  auth0AccountOwners: string[];
  oktaAccountOwners: string[];
  hqStates: string[];
}

const TIERS = ['A', 'B', 'C', 'unassigned'];

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

export default function SearchBar({ filters, onFiltersChange, auth0AccountOwners, oktaAccountOwners, hqStates }: SearchBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const searchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

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
    searchTimerRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, search: value });
    }, 300);
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card className="mb-6">
      <CardContent className="space-y-4 pt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          <div className="md:col-span-2">
            <Label htmlFor="search" className="mb-2 block text-muted-foreground">Search</Label>
            <Input
              id="search"
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Company name or domain..."
            />
          </div>

          <div>
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
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
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
        </div>

        <Button
          variant={filters.showGlobalParent ? 'secondary' : 'outline'}
          onClick={() => onFiltersChange({ ...filters, showGlobalParent: !filters.showGlobalParent })}
        >
          {filters.showGlobalParent ? 'Showing Global Parent Accounts' : 'Global Parent Accounts Hidden'}
        </Button>
      </CardContent>
    </Card>
  );
}
