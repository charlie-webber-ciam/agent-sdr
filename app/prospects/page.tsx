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
import { cn, downloadFile } from '@/lib/utils';
import { usePageChatContext } from '@/lib/page-chat-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  sfdc_id?: string | null;
}

const ROLE_BADGES: Record<string, { className: string; label: string }> = {
  decision_maker: { className: 'border-emerald-200 bg-emerald-100 text-emerald-800', label: 'Decision Maker' },
  champion: { className: 'border-blue-200 bg-blue-100 text-blue-800', label: 'Champion' },
  influencer: { className: 'border-violet-200 bg-violet-100 text-violet-800', label: 'Influencer' },
  blocker: { className: 'border-red-200 bg-red-100 text-red-800', label: 'Blocker' },
  end_user: { className: 'border-slate-200 bg-slate-100 text-slate-700', label: 'End User' },
  unknown: { className: 'border-slate-200 bg-slate-100 text-slate-500', label: 'Unknown' },
};

const STATUS_BADGES: Record<string, string> = {
  new: 'border-slate-200 bg-slate-100 text-slate-700',
  engaged: 'border-blue-200 bg-blue-100 text-blue-800',
  warm: 'border-orange-200 bg-orange-100 text-orange-800',
  cold: 'border-cyan-200 bg-cyan-100 text-cyan-800',
};

type PageTab = 'table' | 'lists' | 'build';

export default function ProspectsPage() {
  const router = useRouter();
  const { setActiveProspect, clearActiveProspect } = usePageChatContext();
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

  useEffect(() => {
    if (!selectedProspectId) {
      clearActiveProspect();
      return;
    }

    const selectedProspect = prospects.find((prospect) => prospect.id === selectedProspectId);
    if (!selectedProspect) {
      clearActiveProspect();
      return;
    }

    setActiveProspect(selectedProspect.id, selectedProspect.account_id);
  }, [selectedProspectId, prospects, setActiveProspect, clearActiveProspect]);

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
      downloadFile(blob, `prospects-export-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const allSelected = prospects.length > 0 && prospects.every(p => selectedIds.has(p.id));
  const someSelected = prospects.some(p => selectedIds.has(p.id)) && !allSelected;
  const selectAllState = allSelected ? true : someSelected ? 'indeterminate' : false;

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
    <main className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Prospects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} prospect{total !== 1 ? 's' : ''} across all accounts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={exportCsv}
            disabled={total === 0}
            variant="outline"
          >
            Export CSV
          </Button>
          <Button
            onClick={() => router.push('/prospects/process')}
            variant="outline"
          >
            AI Process
          </Button>
          <Button
            onClick={() => router.push('/prospects/import')}
          >
            Import from Salesforce
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PageTab)}
        className="mb-6 w-fit"
      >
        <TabsList>
          <TabsTrigger value="table">All Prospects</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
          <TabsTrigger value="build">Build List</TabsTrigger>
        </TabsList>
      </Tabs>

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
      <Card>
        <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : prospects.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-semibold">No prospects found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {Object.keys(filters).length > 0 ? 'Try adjusting your filters' : 'Import prospects from Salesforce to get started'}
            </p>
            {Object.keys(filters).length > 0 && (
              <Button variant="link" onClick={clearAllFilters} className="mt-3 h-auto p-0 text-sm">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={selectAllState}
                      onCheckedChange={() => handleSelectAll()}
                      aria-label="Select all prospects"
                    />
                  </TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Name</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Title</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Company</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Acct Tier</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Value Tier</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Seniority</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Calls</TableHead>
                  <TableHead className="px-3 text-[11px] uppercase tracking-wide">Data</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Role</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">Status</TableHead>
                  <TableHead className="px-4 text-[11px] uppercase tracking-wide">SFDC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prospects.map((p, idx) => {
                  const roleBadge = p.role_type ? ROLE_BADGES[p.role_type] : null;
                  const statusBadgeClass = STATUS_BADGES[p.relationship_status] || STATUS_BADGES.new;
                  const isSelected = selectedIds.has(p.id);
                  const isActive = selectedProspectId === p.id;
                  return (
                    <TableRow
                      key={p.id}
                      onClick={() => setSelectedProspectId(p.id)}
                      className={cn(
                        'cursor-pointer',
                        isActive && 'bg-primary/10 ring-1 ring-inset ring-primary/30 hover:bg-primary/10',
                        !isActive && isSelected && 'bg-primary/5 hover:bg-primary/10'
                      )}
                    >
                      <TableCell
                        className="px-3 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowSelect(p.id, idx, e.shiftKey);
                        }}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => {}} aria-label={`Select ${p.first_name} ${p.last_name}`} />
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap font-medium">
                        {p.first_name} {p.last_name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                        {p.title || <span className="text-muted-foreground/50">-</span>}
                      </TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {p.company_name}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {p.account_tier ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-semibold',
                              p.account_tier === 'A' && 'border-emerald-200 bg-emerald-100 text-emerald-800',
                              p.account_tier === 'B' && 'border-blue-200 bg-blue-100 text-blue-800',
                              p.account_tier === 'C' && 'border-slate-200 bg-slate-100 text-slate-700'
                            )}
                          >
                            {p.account_tier}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <ProspectTierBadge tier={p.value_tier} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs capitalize text-muted-foreground whitespace-nowrap">
                        {p.seniority_level ? p.seniority_level.replace(/_/g, ' ') : <span className="text-muted-foreground/50">-</span>}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {p.call_count > 0 ? (
                          <span className="text-xs">
                            {p.call_count}
                            {p.connect_count > 0 && <span className="ml-1 text-emerald-700">({p.connect_count}c)</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex gap-1">
                          <div className={cn('h-2 w-2 rounded-full', p.email ? 'bg-blue-500' : 'bg-muted')} title="Email" />
                          <div className={cn('h-2 w-2 rounded-full', p.phone ? 'bg-emerald-500' : 'bg-muted')} title="Phone" />
                          <div className={cn('h-2 w-2 rounded-full', p.mobile ? 'bg-teal-500' : 'bg-muted')} title="Mobile" />
                          <div className={cn('h-2 w-2 rounded-full', p.linkedin_url ? 'bg-indigo-500' : 'bg-muted')} title="LinkedIn" />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {roleBadge ? (
                          <Badge variant="outline" className={roleBadge.className}>
                            {roleBadge.label}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline" className={cn('capitalize', statusBadgeClass)}>
                          {p.relationship_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {p.sfdc_id ? (
                          <a
                            href={`https://okta.lightning.force.com/lightning/r/${p.sfdc_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
                          >
                            SF
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {startIdx}-{endIdx} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
        </CardContent>
      </Card>
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
