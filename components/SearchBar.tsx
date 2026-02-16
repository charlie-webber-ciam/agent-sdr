'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePerspective } from '@/lib/perspective-context';

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

const OKTA_USE_CASES = [
  'SSO',
  'MFA / Adaptive MFA',
  'Lifecycle Management',
  'Directory Integration',
  'API Access Management',
  'Privileged Access Management',
  'Identity Governance',
  'Zero Trust',
  'Device Trust',
  'SCIM Provisioning',
  'Compliance & Audit',
  'AI Agent Identity',
];

const OKTA_SKUS = [
  'Workforce Identity Cloud',
  'Identity Governance',
  'Privileged Access',
  'Identity Threat Protection',
  'Okta for AI Agents',
];

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
  freshness: string;
  // Okta-specific filter keys (used when in Okta perspective)
  oktaTier?: string;
  oktaSku?: string;
  oktaUseCase?: string;
  oktaMinPriority?: number | null;
  oktaAccountOwner?: string;
  // Triage tier filters
  triageAuth0Tier?: string;
  triageOktaTier?: string;
}

interface SearchBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  industries?: string[];
  accountOwners?: string[];
  oktaAccountOwners?: string[];
}

const selectClass = "w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50";
const inputClass = "w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400";

export default function SearchBar({ filters, onFiltersChange, industries = [], accountOwners = [], oktaAccountOwners = [] }: SearchBarProps) {
  const { perspective } = usePerspective();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Perspective-aware filter keys and values
  const isOkta = perspective === 'okta';
  const tierValue = isOkta ? (filters.oktaTier || '') : filters.tier;
  const skuValue = isOkta ? (filters.oktaSku || '') : filters.sku;
  const useCaseValue = isOkta ? (filters.oktaUseCase || '') : filters.useCase;
  const minPriorityValue = isOkta ? (filters.oktaMinPriority ?? null) : filters.minPriority;
  const ownerValue = isOkta ? (filters.oktaAccountOwner || '') : filters.accountOwner;
  const ownersList = isOkta ? oktaAccountOwners : accountOwners;
  const skuOptions = isOkta ? OKTA_SKUS : SKUS;
  const useCaseOptions = isOkta ? OKTA_USE_CASES : USE_CASES;

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

  // Perspective-aware filter change: maps generic filter concept to the correct key
  const handlePerspectiveFilterChange = (concept: 'tier' | 'sku' | 'useCase' | 'minPriority' | 'accountOwner', value: string | number | null) => {
    if (isOkta) {
      const keyMap: Record<string, keyof FilterState> = {
        tier: 'oktaTier',
        sku: 'oktaSku',
        useCase: 'oktaUseCase',
        minPriority: 'oktaMinPriority',
        accountOwner: 'oktaAccountOwner',
      };
      onFiltersChange({ ...filters, [keyMap[concept]]: value });
    } else {
      onFiltersChange({ ...filters, [concept]: value });
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (revenueTimerRef.current) clearTimeout(revenueTimerRef.current);
    };
  }, []);

  const defaultSort = isOkta ? 'okta_priority_score' : 'priority_score';
  const advancedFilterCount = [
    tierValue,
    skuValue,
    useCaseValue,
    minPriorityValue !== null && (minPriorityValue as number) > 1,
    filters.revenue,
    ownerValue,
    filters.triageAuth0Tier,
    filters.triageOktaTier,
    filters.freshness,
    filters.sortBy && filters.sortBy !== defaultSort,
  ].filter(Boolean).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
      {/* Basic Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="search" className="block text-sm font-medium text-gray-600 mb-2">
            Search
          </label>
          <input
            id="search"
            type="text"
            defaultValue={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Company name or domain..."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-gray-600 mb-2">
            Industry
          </label>
          <select
            id="industry"
            value={filters.industry}
            onChange={(e) => handleFilterChange('industry', e.target.value)}
            className={selectClass}
          >
            <option value="">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>

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
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium"
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
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-300">
              {advancedFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filters Section */}
      <AnimatePresence>
        {isAdvancedOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' as const }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="accountOwner" className="block text-sm font-medium text-gray-600 mb-2">
                    {isOkta ? 'Okta Account Owner' : 'Auth0 Account Owner'}
                  </label>
                  <select
                    id="accountOwner"
                    value={ownerValue}
                    onChange={(e) => handlePerspectiveFilterChange('accountOwner', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All Owners</option>
                    <option value="unassigned">No Owner (Unassigned)</option>
                    {ownersList.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="tier" className="block text-sm font-medium text-gray-600 mb-2">
                    {isOkta ? 'Okta Tier' : 'Tier'}
                  </label>
                  <select
                    id="tier"
                    value={tierValue}
                    onChange={(e) => handlePerspectiveFilterChange('tier', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All Tiers</option>
                    {TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier === 'unassigned' ? 'Unassigned' : `Tier ${tier}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sku" className="block text-sm font-medium text-gray-600 mb-2">
                    {isOkta ? 'Okta SKU' : 'Auth0 SKU'}
                  </label>
                  <select
                    id="sku"
                    value={skuValue}
                    onChange={(e) => handlePerspectiveFilterChange('sku', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All SKUs</option>
                    {skuOptions.map((sku) => (
                      <option key={sku} value={sku}>
                        {sku}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="useCase" className="block text-sm font-medium text-gray-600 mb-2">
                    Use Case
                  </label>
                  <select
                    id="useCase"
                    value={useCaseValue}
                    onChange={(e) => handlePerspectiveFilterChange('useCase', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All Use Cases</option>
                    {useCaseOptions.map((uc) => (
                      <option key={uc} value={uc}>
                        {uc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="minPriority" className="block text-sm font-medium text-gray-600 mb-2">
                    Min Priority Score
                  </label>
                  <input
                    id="minPriority"
                    type="number"
                    min="1"
                    max="10"
                    value={minPriorityValue || ''}
                    onChange={(e) => handlePerspectiveFilterChange('minPriority', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="1-10"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="revenue" className="block text-sm font-medium text-gray-600 mb-2">
                    Revenue
                  </label>
                  <input
                    id="revenue"
                    type="text"
                    defaultValue={filters.revenue}
                    onChange={(e) => handleRevenueChange(e.target.value)}
                    placeholder="e.g., $10M-$50M"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="triageAuth0Tier" className="block text-sm font-medium text-gray-600 mb-2">
                    Triage Auth0 Tier
                  </label>
                  <select
                    id="triageAuth0Tier"
                    value={filters.triageAuth0Tier || ''}
                    onChange={(e) => handleFilterChange('triageAuth0Tier', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All</option>
                    <option value="A">Tier A</option>
                    <option value="B">Tier B</option>
                    <option value="C">Tier C</option>
                    <option value="unassigned">Not Triaged</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="triageOktaTier" className="block text-sm font-medium text-gray-600 mb-2">
                    Triage Okta Tier
                  </label>
                  <select
                    id="triageOktaTier"
                    value={filters.triageOktaTier || ''}
                    onChange={(e) => handleFilterChange('triageOktaTier', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All</option>
                    <option value="A">Tier A</option>
                    <option value="B">Tier B</option>
                    <option value="C">Tier C</option>
                    <option value="unassigned">Not Triaged</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="freshness" className="block text-sm font-medium text-gray-600 mb-2">
                    Research Freshness
                  </label>
                  <select
                    id="freshness"
                    value={filters.freshness}
                    onChange={(e) => handleFilterChange('freshness', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All</option>
                    <option value="fresh">Fresh (&lt;30 days)</option>
                    <option value="aging">Aging (30-60 days)</option>
                    <option value="stale">Stale (&gt;60 days)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="sortBy" className="block text-sm font-medium text-gray-600 mb-2">
                    Sort By
                  </label>
                  <select
                    id="sortBy"
                    value={filters.sortBy}
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    className={selectClass}
                  >
                    <option value={isOkta ? 'okta_priority_score' : 'priority_score'}>Priority Score</option>
                    <option value="processed_at">Recently Processed</option>
                    <option value="created_at">Recently Added</option>
                    <option value={isOkta ? 'okta_tier' : 'tier'}>{isOkta ? 'Okta Tier' : 'Tier'}</option>
                    <option value="company_name">Company Name</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
