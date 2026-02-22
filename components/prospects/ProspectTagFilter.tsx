'use client';

import { useState, useEffect } from 'react';

interface Props {
  filters: Record<string, string>;
  onChange: (filters: Record<string, string>) => void;
}

const VALUE_TIER_OPTIONS = [
  { value: 'HVT', label: 'HVT' },
  { value: 'MVT', label: 'MVT' },
  { value: 'LVT', label: 'LVT' },
  { value: 'no_longer_with_company', label: 'Left Company' },
  { value: 'recently_changed_roles', label: 'Role Change' },
  { value: 'gatekeeper', label: 'Gatekeeper' },
  { value: 'technical_evaluator', label: 'Tech Evaluator' },
];

const SENIORITY_OPTIONS = [
  { value: 'c_suite', label: 'C-Suite' },
  { value: 'vp', label: 'VP' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'individual_contributor', label: 'IC' },
  { value: 'unknown', label: 'Unknown' },
];

export default function ProspectTagFilter({ filters, onChange }: Props) {
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/prospects/tags')
      .then(res => res.ok ? res.json() : { departmentTags: [] })
      .then(data => setDepartments(data.departmentTags || []))
      .catch(() => {});
  }, []);

  const update = (key: string, value: string) => {
    const next = { ...filters };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Value Tier */}
      <select
        value={filters.valueTier || ''}
        onChange={e => update('valueTier', e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Value Tier</option>
        {VALUE_TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Seniority Level */}
      <select
        value={filters.seniorityLevel || ''}
        onChange={e => update('seniorityLevel', e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Seniority</option>
        {SENIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Department */}
      <select
        value={filters.departmentTag || ''}
        onChange={e => update('departmentTag', e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Department</option>
        {departments.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      {/* AI Processed */}
      <select
        value={filters.aiProcessed || ''}
        onChange={e => update('aiProcessed', e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">AI Status</option>
        <option value="yes">AI Processed</option>
        <option value="no">Not Processed</option>
      </select>
    </div>
  );
}
