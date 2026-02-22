'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ProspectReportFilters from '@/components/prospects/ProspectReportFilters';
import ProspectTierBadge from '@/components/prospects/ProspectTierBadge';
import ProspectListManager from '@/components/prospects/ProspectListManager';
import ProspectSlideOver from '@/components/prospects/ProspectSlideOver';
import ProspectDataQualityBar from '@/components/prospects/ProspectDataQualityBar';
import ProspectSmartListBuilder from '@/components/prospects/ProspectSmartListBuilder';
import BulkActionBar from '@/components/prospects/BulkActionBar';

interface ProspectRow {
  id: number;
  account_id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  linkedin_url: string | null;
  role_type: string | null;
  relationship_status: string;
  source: string;
  company_name: string;
  domain: string;
  account_tier: string | null;
  account_okta_tier: string | null;
  account_industry: string;
  value_tier: string | null;
  seniority_level: string | null;
  department_tag: string | null;
  call_count: number;
  connect_count: number;
  do_not_call?: number;
  ai_summary?: string | null;
  ai_processed_at?: string | null;
  contact_readiness?: string | null;
  prospect_tags?: string | null;
}

const ROLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  decision_maker: { bg: 'bg-green-100', text: 'text-green-800', label: 'Decision Maker' },
  champion: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Champion' },
  influencer: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Influencer' },
  blocker: { bg: 'bg-red-100', text: 'text-red-800', label: 'Blocker' },
  end_user: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'End User' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Unknown' },
};

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-gray-100', text: 'text-gray-700' },
  engaged: { bg: 'bg-blue-100', text: 'text-blue-800' },
  warm: { bg: 'bg-orange-100', text: 'text-orange-800' },
  cold: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
};

type PageTab = 'table' | 'lists' | 'build';

export default function ProspectsPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<PageTab>('table');
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const listManagerKeyRef = useRef(0);
  const pageSize = 50;

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));

      const res = await fetch(`/api/prospects?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProspects(data.prospects);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch prospects:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  const handleFiltersChange = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
    setPage(0);
  };

  const clearAllFilters = () => {
    setFilters({});
    setPage(0);
  };

  const handleFilterClick = (filterKey: string, filterValue: string) => {
    handleFiltersChange({ ...filters, [filterKey]: filterValue });
  };

  const handleRowSelect = (id: number, idx: number, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIdx !== null) {
        const start = Math.min(lastSelectedIdx, idx);
        const end = Math.max(lastSelectedIdx, idx);
        for (let i = start; i <= end; i++) {
          next.add(prospects[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setLastSelectedIdx(idx);
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      params.set('limit', '10000');
      params.set('offset', '0');

      const res = await fetch(`/api/prospects?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const allProspects: ProspectRow[] = data.prospects;

      const headers = ['First Name', 'Last Name', 'Title', 'Email', 'Phone', 'Mobile', 'LinkedIn', 'Company', 'Tier', 'Role', 'Status'];
      const rows = allProspects.map(p => [
        p.first_name,
        p.last_name,
        p.title || '',
        p.email || '',
        p.phone || '',
        p.mobile || '',
        p.linkedin_url || '',
        p.company_name,
        p.account_tier || '',
        p.role_type || '',
        p.relationship_status,
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const allSelected = prospects.length > 0 && prospects.every(p => selectedIds.has(p.id));
  const someSelected = prospects.some(p => selectedIds.has(p.id)) && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        prospects.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        prospects.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

  const startIdx = page * pageSize + 1;
  const endIdx = Math.min((page + 1) * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} prospect{total !== 1 ? 's' : ''} across all accounts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            disabled={total === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => router.push('/prospects/process')}
            className="px-4 py-2 text-sm font-medium text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
          >
            AI Process
          </button>
          <button
            onClick={() => router.push('/prospects/import')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Import from Salesforce
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-6 w-fit">
        {([
          { key: 'table', label: 'All Prospects' },
          { key: 'lists', label: 'Lists' },
          { key: 'build', label: 'Build List' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'lists' ? (
        <ProspectListManager key={listManagerKeyRef.current} />
      ) : activeTab === 'build' ? (
        <ProspectSmartListBuilder
          onListCreated={() => {
            listManagerKeyRef.current += 1;
            setActiveTab('lists');
          }}
        />
      ) : (
      <>
      {/* Data Quality Bar */}
      <ProspectDataQualityBar onFilterClick={handleFilterClick} />

      {/* Filters */}
      <div className="mb-6">
        <ProspectReportFilters
          filters={filters}
          onFilterChange={(key, value) => {
            if (value) {
              handleFiltersChange({ ...filters, [key]: value });
            } else {
              const next = { ...filters };
              delete next[key];
              handleFiltersChange(next);
            }
          }}
          onClearAll={clearAllFilters}
          onApplyPreset={(preset) => {
            setFilters(preset);
            setPage(0);
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : prospects.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No prospects found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {Object.keys(filters).length > 0 ? 'Try adjusting your filters' : 'Import prospects from Salesforce to get started'}
            </p>
            {Object.keys(filters).length > 0 && (
              <button onClick={clearAllFilters} className="mt-3 text-sm text-blue-600 hover:text-blue-800">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected; }}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Title</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Company</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Acct Tier</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Value Tier</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Seniority</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Calls</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Data</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {prospects.map((p, idx) => {
                    const roleBadge = p.role_type ? ROLE_BADGES[p.role_type] : null;
                    const statusBadge = STATUS_BADGES[p.relationship_status] || STATUS_BADGES.new;
                    const isSelected = selectedIds.has(p.id);
                    const isActive = selectedProspectId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={`cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                            : isSelected
                            ? 'bg-blue-50/50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td
                          className="px-3 py-2"
                          onClick={e => { e.stopPropagation(); handleRowSelect(p.id, idx, e.shiftKey); }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td
                          className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          {p.first_name} {p.last_name}
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          {p.title || <span className="text-gray-300">-</span>}
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          {p.company_name}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          {p.account_tier && (
                            <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                              p.account_tier === 'A' ? 'bg-green-100 text-green-800' :
                              p.account_tier === 'B' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {p.account_tier}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          <ProspectTierBadge tier={p.value_tier} />
                        </td>
                        <td
                          className="px-4 py-3 text-xs text-gray-500 capitalize whitespace-nowrap"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          {p.seniority_level ? p.seniority_level.replace(/_/g, ' ') : <span className="text-gray-300">-</span>}
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-gray-600"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          {p.call_count > 0 ? (
                            <span className="text-xs">
                              {p.call_count}
                              {p.connect_count > 0 && <span className="text-green-600 ml-1">({p.connect_count}c)</span>}
                            </span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td
                          className="px-3 py-2"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          <div className="flex gap-1">
                            <div className={`w-2 h-2 rounded-full ${p.email ? 'bg-blue-400' : 'bg-gray-200'}`} title="Email" />
                            <div className={`w-2 h-2 rounded-full ${p.phone ? 'bg-green-400' : 'bg-gray-200'}`} title="Phone" />
                            <div className={`w-2 h-2 rounded-full ${p.mobile ? 'bg-teal-400' : 'bg-gray-200'}`} title="Mobile" />
                            <div className={`w-2 h-2 rounded-full ${p.linkedin_url ? 'bg-indigo-400' : 'bg-gray-200'}`} title="LinkedIn" />
                          </div>
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          {roleBadge ? (
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleBadge.bg} ${roleBadge.text}`}>
                              {roleBadge.label}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">-</span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={() => setSelectedProspectId(p.id)}
                        >
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge.bg} ${statusBadge.text}`}>
                            {p.relationship_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-500">
                Showing {startIdx}-{endIdx} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      </>
      )}

      {/* Slide-Over Detail Panel */}
      {selectedProspectId && (
        <ProspectSlideOver
          prospectId={selectedProspectId}
          prospects={prospects}
          onClose={() => setSelectedProspectId(null)}
          onNavigate={(id) => setSelectedProspectId(id)}
          onDataChange={fetchProspects}
        />
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          selectedIds={Array.from(selectedIds)}
          onDeselectAll={() => setSelectedIds(new Set())}
          onActionComplete={() => { setSelectedIds(new Set()); fetchProspects(); }}
        />
      )}
    </main>
  );
}
