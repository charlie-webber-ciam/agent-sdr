'use client';

import { useState, useEffect } from 'react';

interface DataQualityStats {
  total: number;
  has_email: number;
  has_phone: number;
  has_mobile: number;
  has_linkedin: number;
  has_address: number;
  do_not_call: number;
  dial_ready: number;
  email_ready: number;
  social_ready: number;
  incomplete: number;
}

interface Props {
  onFilterClick: (filterKey: string, filterValue: string) => void;
}

export default function ProspectDataQualityBar({ onFilterClick }: Props) {
  const [stats, setStats] = useState<DataQualityStats | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/prospects/stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});
  }, []);

  if (!stats || stats.total === 0) return null;

  const chips = [
    { label: 'Email', count: stats.has_email, color: 'bg-blue-100 text-blue-700', filterKey: 'has_email', filterValue: 'true' },
    { label: 'Phone', count: stats.has_phone, color: 'bg-green-100 text-green-700', filterKey: 'has_phone', filterValue: 'true' },
    { label: 'Mobile', count: stats.has_mobile, color: 'bg-teal-100 text-teal-700', filterKey: 'has_mobile', filterValue: 'true' },
    { label: 'LinkedIn', count: stats.has_linkedin, color: 'bg-indigo-100 text-indigo-700', filterKey: 'has_linkedin', filterValue: 'true' },
    { label: 'DNC', count: stats.do_not_call, color: 'bg-red-100 text-red-700', filterKey: 'do_not_call', filterValue: 'true' },
  ];

  const readinessChips = [
    { label: 'Dial Ready', count: stats.dial_ready, color: 'bg-green-100 text-green-800', value: 'dial_ready' },
    { label: 'Email Ready', count: stats.email_ready, color: 'bg-blue-100 text-blue-800', value: 'email_ready' },
    { label: 'Social Only', count: stats.social_ready, color: 'bg-purple-100 text-purple-800', value: 'social_ready' },
    { label: 'Incomplete', count: stats.incomplete, color: 'bg-gray-100 text-gray-700', value: 'incomplete' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Quality</h4>
          <span className="text-xs text-gray-400">({stats.total} total)</span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => (
              <button
                key={chip.label}
                onClick={() => onFilterClick(chip.filterKey, chip.filterValue)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors hover:ring-1 hover:ring-gray-300 ${chip.color}`}
              >
                {chip.label}
                <span className="font-bold">{chip.count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {readinessChips.map(chip => (
              <button
                key={chip.value}
                onClick={() => onFilterClick('contactReadiness', chip.value)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors hover:ring-1 hover:ring-gray-300 ${chip.color}`}
              >
                {chip.label}
                <span className="font-bold">{chip.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
