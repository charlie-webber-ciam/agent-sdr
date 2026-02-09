'use client';

import { useState, useEffect, useRef } from 'react';

// Available filter options (from categorizer.ts)
const USE_CASES = [
  'SSO',
  'MFA',
  'Social Login',
  'B2C Authentication',
  'User Management',
  'Password Management',
  'B2B Multi-tenancy',
  'Role-Based Access Control',
  'Fine-Grained Permissions',
  'API Security',
  'LLM/AI Authentication',
  'AI Agent Security',
  'Chatbot Authentication',
  'Machine-to-Machine Auth',
  'Compliance & Audit',
];

const SKUS = ['Core', 'FGA', 'Auth for AI'];
const TIERS = ['A', 'B', 'C', 'unassigned'];

export interface FilterState {
  search: string;
  industry: string;
  status: string;
  tier: string;
  sku: string;
  useCase: string;
  minPriority: number | null;
  revenue: string;
  accountOwner: string;
  sortBy: string;
}

interface SearchBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  industries?: string[];
  accountOwners?: string[];
}

export default function SearchBar({ filters, onFiltersChange, industries = [], accountOwners = [] }: SearchBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Use refs to track debounce timers
  const searchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const revenueTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleSearchChange = (value: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, search: value });
    }, 300);
  };

  const handleRevenueChange = (value: string) => {
    if (revenueTimerRef.current) {
      clearTimeout(revenueTimerRef.current);
    }

    revenueTimerRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, revenue: value });
    }, 300);
  };

  const handleFilterChange = (key: keyof FilterState, value: string | number | null) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (revenueTimerRef.current) clearTimeout(revenueTimerRef.current);
    };
  }, []);

  // Count active advanced filters
  const advancedFilterCount = [
    filters.tier,
    filters.sku,
    filters.useCase,
    filters.minPriority !== null && filters.minPriority > 1,
    filters.revenue,
    filters.accountOwner,
    filters.sortBy && filters.sortBy !== 'priority_score',
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      {/* Basic Filters - Always Visible */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search Input */}
        <div className="md:col-span-2">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            id="search"
            type="text"
            defaultValue={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Company name or domain..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Industry Filter */}
        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
            Industry
          </label>
          <select
            id="industry"
            value={filters.industry}
            onChange={(e) => handleFilterChange('industry', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Advanced Filters
          {advancedFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              {advancedFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filters Section */}
      {isAdvancedOpen && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Auth0 Account Owner Filter */}
            <div>
              <label htmlFor="accountOwner" className="block text-sm font-medium text-gray-700 mb-2">
                Auth0 Account Owner
              </label>
              <select
                id="accountOwner"
                value={filters.accountOwner}
                onChange={(e) => handleFilterChange('accountOwner', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Owners</option>
                <option value="unassigned">No Owner (Unassigned)</option>
                {accountOwners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>

            {/* Tier Filter */}
            <div>
              <label htmlFor="tier" className="block text-sm font-medium text-gray-700 mb-2">
                Tier
              </label>
              <select
                id="tier"
                value={filters.tier}
                onChange={(e) => handleFilterChange('tier', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Tiers</option>
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier === 'unassigned' ? 'Unassigned' : `Tier ${tier}`}
                  </option>
                ))}
              </select>
            </div>

            {/* SKU Filter */}
            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-2">
                Auth0 SKU
              </label>
              <select
                id="sku"
                value={filters.sku}
                onChange={(e) => handleFilterChange('sku', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All SKUs</option>
                {SKUS.map((sku) => (
                  <option key={sku} value={sku}>
                    {sku}
                  </option>
                ))}
              </select>
            </div>

            {/* Use Case Filter */}
            <div>
              <label htmlFor="useCase" className="block text-sm font-medium text-gray-700 mb-2">
                Use Case
              </label>
              <select
                id="useCase"
                value={filters.useCase}
                onChange={(e) => handleFilterChange('useCase', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Use Cases</option>
                {USE_CASES.map((uc) => (
                  <option key={uc} value={uc}>
                    {uc}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label htmlFor="minPriority" className="block text-sm font-medium text-gray-700 mb-2">
                Min Priority Score
              </label>
              <input
                id="minPriority"
                type="number"
                min="1"
                max="10"
                value={filters.minPriority || ''}
                onChange={(e) => handleFilterChange('minPriority', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="1-10"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Revenue Filter */}
            <div>
              <label htmlFor="revenue" className="block text-sm font-medium text-gray-700 mb-2">
                Revenue
              </label>
              <input
                id="revenue"
                type="text"
                defaultValue={filters.revenue}
                onChange={(e) => handleRevenueChange(e.target.value)}
                placeholder="e.g., $10M-$50M"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Sort By */}
            <div>
              <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                id="sortBy"
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="priority_score">Priority Score</option>
                <option value="processed_at">Recently Processed</option>
                <option value="created_at">Recently Added</option>
                <option value="tier">Tier</option>
                <option value="company_name">Company Name</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
