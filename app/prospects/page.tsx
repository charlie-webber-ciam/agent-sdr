'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProspectReportFilters from '@/components/prospects/ProspectReportFilters';

interface ProspectRow {
  id: number;
  account_id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  role_type: string | null;
  relationship_status: string;
  source: string;
  company_name: string;
  domain: string;
  account_tier: string | null;
  account_okta_tier: string | null;
  account_industry: string;
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

export default function ProspectsPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
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

  const exportCsv = () => {
    const headers = ['First Name', 'Last Name', 'Title', 'Email', 'Phone', 'Company', 'Tier', 'Role', 'Status'];
    const rows = prospects.map(p => [
      p.first_name,
      p.last_name,
      p.title || '',
      p.email || '',
      p.phone || '',
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
            disabled={prospects.length === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => router.push('/prospects/import')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Import from Salesforce
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <ProspectReportFilters filters={filters} onChange={handleFiltersChange} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : prospects.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500">No prospects found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Title</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Company</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Tier</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Email</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Phone</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {prospects.map(p => {
                    const roleBadge = p.role_type ? ROLE_BADGES[p.role_type] : null;
                    const statusBadge = STATUS_BADGES[p.relationship_status] || STATUS_BADGES.new;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/accounts/${p.account_id}?tab=prospects`)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                          {p.first_name} {p.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                          {p.title || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {p.company_name}
                        </td>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                          {p.email || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {p.phone || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          {roleBadge ? (
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleBadge.bg} ${roleBadge.text}`}>
                              {roleBadge.label}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
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
    </main>
  );
}
