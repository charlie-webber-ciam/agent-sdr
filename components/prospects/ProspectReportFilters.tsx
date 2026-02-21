'use client';

interface Props {
  filters: Record<string, string>;
  onChange: (filters: Record<string, string>) => void;
}

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

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'salesforce_import', label: 'Salesforce Import' },
  { value: 'ai_research', label: 'AI Research' },
];

const TIER_OPTIONS = [
  { value: 'A', label: 'Tier A' },
  { value: 'B', label: 'Tier B' },
  { value: 'C', label: 'Tier C' },
];

export default function ProspectReportFilters({ filters, onChange }: Props) {
  const update = (key: string, value: string) => {
    const next = { ...filters };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    onChange(next);
  };

  const activeFilters = Object.entries(filters).filter(([k]) => k !== 'search');

  const filterLabel = (key: string, value: string): string => {
    const labels: Record<string, Record<string, string>> = {
      tier: { A: 'Tier A', B: 'Tier B', C: 'Tier C' },
      oktaTier: { A: 'Okta A', B: 'Okta B', C: 'Okta C' },
      roleType: Object.fromEntries(ROLE_OPTIONS.map(o => [o.value, o.label])),
      relationshipStatus: Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o.label])),
      source: Object.fromEntries(SOURCE_OPTIONS.map(o => [o.value, o.label])),
    };
    return labels[key]?.[value] || `${key}: ${value}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by name, email, title..."
          value={filters.search || ''}
          onChange={e => update('search', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
        />

        {/* Tier */}
        <select
          value={filters.tier || ''}
          onChange={e => update('tier', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Auth0 Tier</option>
          {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Okta Tier */}
        <select
          value={filters.oktaTier || ''}
          onChange={e => update('oktaTier', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Okta Tier</option>
          {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Role Type */}
        <select
          value={filters.roleType || ''}
          onChange={e => update('roleType', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Role Type</option>
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Relationship Status */}
        <select
          value={filters.relationshipStatus || ''}
          onChange={e => update('relationshipStatus', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Status</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Source */}
        <select
          value={filters.source || ''}
          onChange={e => update('source', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Source</option>
          {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
            >
              {filterLabel(key, value)}
              <button
                onClick={() => update(key, '')}
                className="text-blue-400 hover:text-blue-600"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          <button
            onClick={() => onChange({})}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
