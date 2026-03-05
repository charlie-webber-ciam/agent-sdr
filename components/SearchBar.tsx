'use client';

import { useState, useEffect, useRef } from 'react';

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

const selectClass = "w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50";
const inputClass = "w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400";

const TIERS = ['A', 'B', 'C', 'unassigned'];

export default function SearchBar({ filters, onFiltersChange, auth0AccountOwners, oktaAccountOwners, hqStates }: SearchBarProps) {
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
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
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

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-600 mb-2">
            Status
          </label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
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

      {/* HQ State filter row */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-7 gap-4">
        <div>
          <label htmlFor="hqState" className="block text-sm font-medium text-gray-600 mb-2">
            HQ State
          </label>
          <select
            id="hqState"
            value={filters.hqState}
            onChange={(e) => handleFilterChange('hqState', e.target.value)}
            className={selectClass}
          >
            <option value="">All States</option>
            <option value="unassigned">Unassigned</option>
            {hqStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Parent toggle */}
      <div className="mt-4">
        <button
          onClick={() => onFiltersChange({ ...filters, showGlobalParent: !filters.showGlobalParent })}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
            filters.showGlobalParent
              ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
              : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
              filters.showGlobalParent
                ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-4.35-4.35"
            } />
          </svg>
          {filters.showGlobalParent ? 'Showing Global Parent Accounts' : 'Global Parent Accounts Hidden'}
        </button>
      </div>
    </div>
  );
}
