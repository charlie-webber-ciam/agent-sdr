'use client';

import { useState, useEffect } from 'react';

interface Props {
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearAll: () => void;
  onApplyPreset: (filters: Record<string, string>) => void;
}

const TIER_OPTIONS = [
  { value: 'A', label: 'Tier A' },
  { value: 'B', label: 'Tier B' },
  { value: 'C', label: 'Tier C' },
];

const VALUE_TIER_OPTIONS = [
  { value: 'HVT', label: 'HVT' },
  { value: 'MVT', label: 'MVT' },
  { value: 'LVT', label: 'LVT' },
];

const ROLE_OPTIONS = [
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'champion', label: 'Champion' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'end_user', label: 'End User' },
  { value: 'unknown', label: 'Unknown' },
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

const SENIORITY_OPTIONS = [
  { value: 'c_suite', label: 'C-Suite' },
  { value: 'vp', label: 'VP' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'individual_contributor', label: 'IC' },
  { value: 'unknown', label: 'Unknown' },
];

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'salesforce_import', label: 'Salesforce Import' },
  { value: 'ai_research', label: 'AI Research' },
];

const PHONE_COUNTRY_OPTIONS = [
  { value: '+61', label: '+61 AU' },
  { value: '+1', label: '+1 US' },
  { value: '+44', label: '+44 UK' },
  { value: '+64', label: '+64 NZ' },
];

const CONTACT_READINESS_OPTIONS = [
  { value: 'dial_ready', label: 'Dial Ready' },
  { value: 'email_ready', label: 'Email Ready' },
  { value: 'social_ready', label: 'Social Ready' },
  { value: 'incomplete', label: 'Incomplete' },
];

const PILL_TOGGLES = [
  { key: 'has_email', label: 'Has Email' },
  { key: 'has_phone', label: 'Has Phone' },
  { key: 'has_mobile', label: 'Has Mobile' },
  { key: 'has_linkedin', label: 'Has LinkedIn' },
  { key: 'exclude_dnc', label: 'Exclude DNC' },
];

const PRESETS: { label: string; filters: Record<string, string> }[] = [
  {
    label: 'Dial-ready HVTs',
    filters: { valueTier: 'HVT', contactReadiness: 'dial_ready' },
  },
  {
    label: 'Email-ready MVTs',
    filters: { valueTier: 'MVT', contactReadiness: 'email_ready' },
  },
  {
    label: 'AU Mobile HVTs',
    filters: { valueTier: 'HVT', phoneCountry: '+61', has_mobile: 'true' },
  },
  {
    label: 'Needs Enrichment',
    filters: { aiProcessed: 'no' },
  },
];

const FILTER_LABEL_MAP: Record<string, Record<string, string>> = {
  tier: { A: 'Auth0: A', B: 'Auth0: B', C: 'Auth0: C' },
  valueTier: { HVT: 'HVT', MVT: 'MVT', LVT: 'LVT' },
  oktaTier: { A: 'Okta: A', B: 'Okta: B', C: 'Okta: C' },
  roleType: Object.fromEntries(ROLE_OPTIONS.map(o => [o.value, o.label])),
  relationshipStatus: Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o.label])),
  seniorityLevel: Object.fromEntries(SENIORITY_OPTIONS.map(o => [o.value, o.label])),
  source: Object.fromEntries(SOURCE_OPTIONS.map(o => [o.value, o.label])),
  aiProcessed: { yes: 'AI: Processed', no: 'AI: Not Processed' },
  phoneCountry: Object.fromEntries(PHONE_COUNTRY_OPTIONS.map(o => [o.value, `Phone: ${o.label}`])),
  contactReadiness: Object.fromEntries(CONTACT_READINESS_OPTIONS.map(o => [o.value, o.label])),
  has_email: { true: 'Has Email' },
  has_phone: { true: 'Has Phone' },
  has_mobile: { true: 'Has Mobile' },
  has_linkedin: { true: 'Has LinkedIn' },
  exclude_dnc: { true: 'Exclude DNC' },
};

function getFilterLabel(key: string, value: string): string {
  return FILTER_LABEL_MAP[key]?.[value] || `${key}: ${value}`;
}

export default function ProspectReportFilters({
  filters,
  onFilterChange,
  onClearAll,
  onApplyPreset,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/prospects/tags')
      .then(res => (res.ok ? res.json() : { departmentTags: [] }))
      .then(data => setDepartments(data.departmentTags || []))
      .catch(() => {});
  }, []);

  const handleTogglePill = (key: string) => {
    if (filters[key] === 'true') {
      onFilterChange(key, '');
    } else {
      onFilterChange(key, 'true');
    }
  };

  const activeFilters = Object.entries(filters).filter(
    ([k, v]) => k !== 'search' && v !== ''
  );

  const moreFiltersActive = [
    'oktaTier',
    'seniorityLevel',
    'departmentTag',
    'source',
    'aiProcessed',
    'phoneCountry',
    'contactReadiness',
    'has_email',
    'has_phone',
    'has_mobile',
    'has_linkedin',
    'exclude_dnc',
  ].some(k => filters[k] && filters[k] !== '');

  return (
    <div className="space-y-2">
      {/* Row 1: Always visible */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search name, email, title..."
            value={filters.search || ''}
            onChange={e => onFilterChange('search', e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56"
          />
        </div>

        {/* Auth0 Tier */}
        <select
          value={filters.tier || ''}
          onChange={e => onFilterChange('tier', e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Auth0 Tier</option>
          {TIER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Value Tier */}
        <select
          value={filters.valueTier || ''}
          onChange={e => onFilterChange('valueTier', e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Value Tier</option>
          {VALUE_TIER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Role Type */}
        <select
          value={filters.roleType || ''}
          onChange={e => onFilterChange('roleType', e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Role Type</option>
          {ROLE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.relationshipStatus || ''}
          onChange={e => onFilterChange('relationshipStatus', e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Status</option>
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* More Filters toggle */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            expanded || moreFiltersActive
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h18M7 8h10M11 12h2"
            />
          </svg>
          More Filters
          {moreFiltersActive && (
            <span className="ml-0.5 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center leading-none">
              {
                [
                  'oktaTier',
                  'seniorityLevel',
                  'departmentTag',
                  'source',
                  'aiProcessed',
                  'phoneCountry',
                  'contactReadiness',
                  'has_email',
                  'has_phone',
                  'has_mobile',
                  'has_linkedin',
                  'exclude_dnc',
                ].filter(k => filters[k] && filters[k] !== '').length
              }
            </span>
          )}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Row 2: Expandable */}
      {expanded && (
        <div className="space-y-2 pt-1 border-t border-gray-100">
          {/* Selects row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Okta Tier */}
            <select
              value={filters.oktaTier || ''}
              onChange={e => onFilterChange('oktaTier', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Okta Tier</option>
              {TIER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Seniority */}
            <select
              value={filters.seniorityLevel || ''}
              onChange={e => onFilterChange('seniorityLevel', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seniority</option>
              {SENIORITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Department */}
            <select
              value={filters.departmentTag || ''}
              onChange={e => onFilterChange('departmentTag', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Department</option>
              {departments.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {/* Source */}
            <select
              value={filters.source || ''}
              onChange={e => onFilterChange('source', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Source</option>
              {SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* AI Status */}
            <select
              value={filters.aiProcessed || ''}
              onChange={e => onFilterChange('aiProcessed', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">AI Status</option>
              <option value="yes">AI Processed</option>
              <option value="no">Not Processed</option>
            </select>

            {/* Phone Country */}
            <select
              value={filters.phoneCountry || ''}
              onChange={e => onFilterChange('phoneCountry', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Phone Country</option>
              {PHONE_COUNTRY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Contact Readiness */}
            <select
              value={filters.contactReadiness || ''}
              onChange={e => onFilterChange('contactReadiness', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Contact Readiness</option>
              {CONTACT_READINESS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Data availability pill toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PILL_TOGGLES.map(pill => {
              const active = filters[pill.key] === 'true';
              return (
                <button
                  key={pill.key}
                  onClick={() => handleTogglePill(pill.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-xs text-gray-400 font-medium mr-1">Presets:</span>
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => onApplyPreset(preset.filters)}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {activeFilters.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100"
            >
              {getFilterLabel(key, value)}
              <button
                onClick={() => onFilterChange(key, '')}
                className="text-blue-400 hover:text-blue-600 ml-0.5"
                aria-label={`Remove ${key} filter`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </span>
          ))}
          <button
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium ml-1"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
