'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, ChevronDown, ChevronRight, Loader2, AlertTriangle, Sparkles } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MappedProspect {
  prospect_id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  department: string;
  seniority: string;
  icp_fit: boolean;
  icp_reason: string | null;
}

interface Props {
  accountId: number;
  refreshKey?: number;
}

// ─── Department Colors ──────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-800',
  Product: 'bg-purple-100 text-purple-800',
  Sales: 'bg-green-100 text-green-800',
  Marketing: 'bg-pink-100 text-pink-800',
  HR: 'bg-orange-100 text-orange-800',
  Finance: 'bg-yellow-100 text-yellow-800',
  Legal: 'bg-gray-200 text-gray-800',
  Operations: 'bg-teal-100 text-teal-800',
  'IT/Security': 'bg-red-100 text-red-800',
  Executive: 'bg-amber-100 text-amber-900',
  'Customer Success': 'bg-cyan-100 text-cyan-800',
  Design: 'bg-indigo-100 text-indigo-800',
  Unknown: 'bg-slate-100 text-slate-600',
};

const SENIORITY_ORDER = [
  'C-Level',
  'VP',
  'Director',
  'Head of',
  'Senior Manager',
  'Manager',
  'Senior IC',
  'IC',
  'Unknown',
];

const SENIORITY_COLORS: Record<string, string> = {
  'C-Level': 'bg-amber-100 text-amber-900 border-amber-300',
  VP: 'bg-orange-50 text-orange-800 border-orange-200',
  Director: 'bg-blue-50 text-blue-800 border-blue-200',
  'Head of': 'bg-indigo-50 text-indigo-800 border-indigo-200',
  'Senior Manager': 'bg-purple-50 text-purple-800 border-purple-200',
  Manager: 'bg-violet-50 text-violet-700 border-violet-200',
  'Senior IC': 'bg-slate-100 text-slate-700 border-slate-200',
  IC: 'bg-gray-50 text-gray-700 border-gray-200',
  Unknown: 'bg-gray-50 text-gray-500 border-gray-200',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProspectOrgMap({ accountId, refreshKey }: Props) {
  const [results, setResults] = useState<MappedProspect[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDept, setShowDept] = useState(true);
  const [showSeniority, setShowSeniority] = useState(true);
  const [showNotIcp, setShowNotIcp] = useState(true);
  const [hasExistingData, setHasExistingData] = useState(false);

  // Load existing mapping data from prospects
  const loadExistingData = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/prospects`);
      if (!res.ok) return;
      const data = await res.json();
      const mapped: MappedProspect[] = [];
      for (const p of (data.prospects || [])) {
        if (p.department_tag || p.seniority_level) {
          mapped.push({
            prospect_id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            title: p.title,
            department: p.department_tag || 'Unknown',
            seniority: p.seniority_level || 'Unknown',
            icp_fit: p.icp_fit === 1 || p.icp_fit === true,
            icp_reason: p.icp_reason || null,
          });
        }
      }
      if (mapped.length > 0) {
        setResults(mapped);
        setHasExistingData(true);
      }
    } catch {
      // silently fail - will just show empty state
    }
  }, [accountId]);

  useEffect(() => {
    setResults([]);
    setSummary(null);
    setHasExistingData(false);
    loadExistingData();
  }, [accountId, refreshKey, loadExistingData]);

  const handleMap = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/map-prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to map prospects');
      setResults(data.results);
      setSummary(data.summary);
      setHasExistingData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to map prospects');
    } finally {
      setLoading(false);
    }
  };

  // Group by department
  const byDept = new Map<string, MappedProspect[]>();
  for (const r of results) {
    const list = byDept.get(r.department) || [];
    list.push(r);
    byDept.set(r.department, list);
  }
  // Sort departments by count descending
  const deptEntries = [...byDept.entries()].sort((a, b) => b[1].length - a[1].length);

  // Group by seniority
  const bySeniority = new Map<string, MappedProspect[]>();
  for (const r of results) {
    const list = bySeniority.get(r.seniority) || [];
    list.push(r);
    bySeniority.set(r.seniority, list);
  }
  const seniorityEntries = SENIORITY_ORDER
    .filter(s => bySeniority.has(s))
    .map(s => [s, bySeniority.get(s)!] as [string, MappedProspect[]]);

  // Not ICP
  const notIcp = results.filter(r => !r.icp_fit);
  const icpCount = results.filter(r => r.icp_fit).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Users className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Org Map</h3>
          {results.length > 0 && (
            <span className="text-xs text-gray-400">
              {results.length} prospect{results.length !== 1 ? 's' : ''} mapped
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleMap}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Mapping...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              {hasExistingData ? 'Re-map Prospects' : 'Map Prospects'}
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="mx-5 mt-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          {summary}
        </div>
      )}

      {/* Results */}
      {results.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {/* By Department */}
          <CollapsibleSection
            title="By Department"
            count={deptEntries.length}
            open={showDept}
            onToggle={() => setShowDept(!showDept)}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {deptEntries.map(([dept, prospects]) => (
                <DeptCard key={dept} department={dept} prospects={prospects} />
              ))}
            </div>
          </CollapsibleSection>

          {/* By Seniority */}
          <CollapsibleSection
            title="By Seniority"
            count={seniorityEntries.length}
            open={showSeniority}
            onToggle={() => setShowSeniority(!showSeniority)}
          >
            <div className="space-y-2">
              {seniorityEntries.map(([level, prospects]) => (
                <SeniorityRow key={level} level={level} prospects={prospects} />
              ))}
            </div>
          </CollapsibleSection>

          {/* Not ICP */}
          <CollapsibleSection
            title="Not ICP"
            count={notIcp.length}
            subtitle={`${icpCount} ICP / ${notIcp.length} not ICP`}
            open={showNotIcp}
            onToggle={() => setShowNotIcp(!showNotIcp)}
            variant={notIcp.length > 0 ? 'warning' : 'default'}
          >
            {notIcp.length > 0 ? (
              <div className="space-y-1.5">
                {notIcp.map(p => (
                  <div
                    key={p.prospect_id}
                    className="flex items-start gap-3 rounded-lg border border-gray-150 bg-gray-50 px-3.5 py-2.5"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {p.first_name} {p.last_name}
                        </span>
                        {p.title && (
                          <span className="truncate text-xs text-gray-500">{p.title}</span>
                        )}
                      </div>
                      {p.icp_reason && (
                        <p className="mt-0.5 text-xs text-gray-500">{p.icp_reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-2 text-sm text-gray-500">All prospects match ICP.</p>
            )}
          </CollapsibleSection>
        </div>
      ) : !loading && !error ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          Click &quot;Map Prospects&quot; to classify contacts by department, seniority, and ICP fit.
        </div>
      ) : null}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  count,
  subtitle,
  open,
  onToggle,
  variant = 'default',
  children,
}: {
  title: string;
  count: number;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  variant?: 'default' | 'warning';
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        )}
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <Badge variant="outline" className={`text-xs ${variant === 'warning' && count > 0 ? 'border-amber-300 text-amber-700' : ''}`}>
          {subtitle || count}
        </Badge>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function DeptCard({ department, prospects }: { department: string; prospects: MappedProspect[] }) {
  const color = DEPT_COLORS[department] || DEPT_COLORS.Unknown;
  return (
    <div className="rounded-lg border border-gray-150 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <Badge className={`${color} border-0 text-xs`}>{department}</Badge>
        <span className="text-xs text-gray-400">{prospects.length}</span>
      </div>
      <div className="space-y-1.5">
        {prospects.map(p => (
          <div key={p.prospect_id} className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-sm text-gray-900">
                {p.first_name} {p.last_name}
              </span>
              {p.title && (
                <span className="ml-1.5 text-xs text-gray-400">{p.title}</span>
              )}
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 text-[10px] ${SENIORITY_COLORS[p.seniority] || SENIORITY_COLORS.Unknown}`}
            >
              {p.seniority}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeniorityRow({ level, prospects }: { level: string; prospects: MappedProspect[] }) {
  const color = SENIORITY_COLORS[level] || SENIORITY_COLORS.Unknown;
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 ${color}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold">{level}</span>
        <span className="text-xs opacity-70">{prospects.length}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {prospects.map(p => (
          <div key={p.prospect_id} className="flex items-center gap-1.5">
            <span className="text-sm">{p.first_name} {p.last_name}</span>
            <Badge className={`${DEPT_COLORS[p.department] || DEPT_COLORS.Unknown} border-0 text-[10px]`}>
              {p.department}
            </Badge>
            {!p.icp_fit && (
              <AlertTriangle className="h-3 w-3 text-amber-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
