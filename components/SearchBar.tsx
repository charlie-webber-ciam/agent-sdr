'use client';

import { useState, useEffect, useRef } from 'react';

export interface FilterState {
  search: string;
  tier: string;              // Auth0 tier
  oktaTier: string;          // Okta tier
  accountOwner: string;      // Auth0 account owner
  oktaAccountOwner: string;  // Okta account owner
  sortBy: string;            // not exposed in UI, kept for default sort
}

interface SearchBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  auth0AccountOwners: string[];
  oktaAccountOwners: string[];
}

const selectClass = "w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50";
const inputClass = "w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400";

const TIERS = ['A', 'B', 'C', 'unassigned'];

export default function SearchBar({ filters, onFiltersChange, auth0AccountOwners, oktaAccountOwners }: SearchBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const searchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Sync local state when filters change externally (e.g. "Clear All")
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
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Search */}
        <div className="md:col-span-2">
          <label htmlFor="search" className="block text-sm font-medium text-gray-600 mb-2">
            Search
          </label>
          <input
            id="search"
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Company name or domain..."
            className={inputClass}
          />
        </div>

        {/* Auth0 Tier */}
        <div>
          <label htmlFor="tier" className="block text-sm font-medium text-gray-600 mb-2">
            Auth0 Tier
          </label>
          <select
            id="tier"
            value={filters.tier}
            onChange={(e) => handleFilterChange('tier', e.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier === 'unassigned' ? 'Unassigned' : `Tier ${tier}`}
              </option>
            ))}
          </select>
        </div>

        {/* Okta Tier */}
        <div>
          <label htmlFor="oktaTier" className="block text-sm font-medium text-gray-600 mb-2">
            Okta Tier
          </label>
          <select
            id="oktaTier"
            value={filters.oktaTier}
            onChange={(e) => handleFilterChange('oktaTier', e.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier === 'unassigned' ? 'Unassigned' : `Tier ${tier}`}
              </option>
            ))}
          </select>
        </div>

        {/* Auth0 Account Owner */}
        <div>
          <label htmlFor="accountOwner" className="block text-sm font-medium text-gray-600 mb-2">
            Auth0 Owner
          </label>
          <select
            id="accountOwner"
            value={filters.accountOwner}
            onChange={(e) => handleFilterChange('accountOwner', e.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            <option value="unassigned">No Owner</option>
            {auth0AccountOwners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        {/* Okta Account Owner */}
        <div>
          <label htmlFor="oktaAccountOwner" className="block text-sm font-medium text-gray-600 mb-2">
            Okta Owner
          </label>
          <select
            id="oktaAccountOwner"
            value={filters.oktaAccountOwner}
            onChange={(e) => handleFilterChange('oktaAccountOwner', e.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            <option value="unassigned">No Owner</option>
            {oktaAccountOwners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
