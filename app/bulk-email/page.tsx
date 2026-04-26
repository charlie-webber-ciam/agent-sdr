'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ProspectRow {
  id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  account_id: number;
  company_name?: string;
  role_type?: string;
  seniority_level?: string;
  relationship_status?: string;
  email_count?: number;
}

interface RecentJob {
  id: number;
  name: string;
  status: string;
  total_prospects: number;
  emails_generated: number;
  emails_failed: number;
  created_at: string;
}

export default function BulkEmailPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <BulkEmailPage />
    </Suspense>
  );
}

function BulkEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);

  // Config
  const [emailType, setEmailType] = useState<'cold' | 'warm'>('cold');
  const [researchContext, setResearchContext] = useState<'auth0' | 'okta'>('auth0');
  const [customInstructions, setCustomInstructions] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');

  const preselected = searchParams.get('prospects');

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/prospects?limit=500&hasResearch=true');
      const data = await res.json();
      if (data.prospects) {
        const prospectList = data.prospects as ProspectRow[];

        // Fetch email counts for these prospects
        const ids = prospectList.map((p: ProspectRow) => p.id);
        if (ids.length > 0) {
          try {
            const countsRes = await fetch('/api/bulk-email/email-counts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prospectIds: ids }),
            });
            if (countsRes.ok) {
              const countsData = await countsRes.json();
              const counts: Record<number, number> = countsData.counts || {};
              for (const p of prospectList) {
                p.email_count = counts[p.id] || 0;
              }
            }
          } catch {
            // Non-critical, continue without counts
          }
        }

        setProspects(prospectList);
        // Pre-select if query param provided
        if (preselected) {
          const preselectedIds = new Set(preselected.split(',').map(Number).filter(Boolean));
          setSelected(preselectedIds);
        }
      }
    } catch {
      setError('Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }, [preselected]);

  const fetchRecentJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/bulk-email/jobs?limit=5');
      const data = await res.json();
      if (data.jobs) setRecentJobs(data.jobs);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchProspects();
    fetchRecentJobs();
  }, [fetchProspects, fetchRecentJobs]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredProspects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredProspects.map((p) => p.id)));
    }
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setCreating(true);
    setError(null);

    try {
      // Create job
      const createRes = await fetch('/api/bulk-email/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectIds: Array.from(selected),
          emailType,
          researchContext,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create job');

      // Warn if some prospects will be skipped
      if (createData.willSkipExisting > 0) {
        const confirmed = window.confirm(
          `${createData.willSkipExisting} of ${createData.totalProspects} selected prospects already have ${researchContext} emails and will be skipped.\n\n` +
          `${createData.willGenerate} new emails will be generated.\n\nContinue?`
        );
        if (!confirmed) {
          setCreating(false);
          return;
        }
      }

      // Start job
      const startRes = await fetch('/api/bulk-email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: createData.jobId }),
      });
      if (!startRes.ok) throw new Error('Failed to start job');

      router.push(`/bulk-email/progress/${createData.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setCreating(false);
    }
  };

  const filteredProspects = prospects.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      const company = (p.company_name || '').toLowerCase();
      if (!name.includes(q) && !company.includes(q) && !(p.email || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    if (tierFilter && p.seniority_level !== tierFilter) return false;
    return true;
  });

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Bulk Email Generation</h1>
        <p className="text-gray-600">
          Select prospects and generate personalised emails at scale. Accounts without overviews will have them auto-generated.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Config */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center justify-between w-full"
        >
          <h2 className="text-lg font-bold">Generation Settings</h2>
          {showConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>

        {showConfig && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Type</label>
              <select
                value={emailType}
                onChange={(e) => setEmailType(e.target.value as 'cold' | 'warm')}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Research Context</label>
              <select
                value={researchContext}
                onChange={(e) => setResearchContext(e.target.value as 'auth0' | 'okta')}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="auth0">Auth0 CIAM</option>
                <option value="okta">Okta Workforce</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Instructions (optional)</label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Any additional context or instructions for email generation..."
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px] resize-y"
              />
            </div>
          </div>
        )}
      </div>

      {/* Selection summary + action */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex items-center justify-between sticky top-16 z-10 border">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            {selected.size} prospect{selected.size !== 1 ? 's' : ''} selected
          </span>
          {selected.size > 0 && (
            <>
              <span className="text-xs text-gray-500">
                across {new Set(filteredProspects.filter((p) => selected.has(p.id)).map((p) => p.account_id)).size} accounts
              </span>
              {(() => {
                const withEmails = filteredProspects.filter((p) => selected.has(p.id) && (p.email_count || 0) > 0).length;
                return withEmails > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    {withEmails} already have emails (will be skipped)
                  </span>
                ) : null;
              })()}
            </>
          )}
        </div>
        <button
          onClick={handleCreate}
          disabled={selected.size === 0 || creating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Generate {selected.size} Email{selected.size !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or email..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Seniority</option>
          <option value="c_suite">C-Suite</option>
          <option value="vp">VP</option>
          <option value="director">Director</option>
          <option value="manager">Manager</option>
          <option value="individual_contributor">IC</option>
        </select>
      </div>

      {/* Prospect table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === filteredProspects.length && filteredProspects.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Emails</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProspects.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`cursor-pointer hover:bg-gray-50 ${selected.has(p.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{p.first_name} {p.last_name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.title || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.company_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.email || '-'}</td>
                  <td className="px-4 py-3">
                    {(p.email_count || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700" title="Already has generated emails - will be skipped">
                        <AlertTriangle className="h-3 w-3" />
                        {p.email_count}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.relationship_status === 'engaged' ? 'bg-green-100 text-green-700' :
                      p.relationship_status === 'warm' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {p.relationship_status || 'new'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredProspects.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No prospects found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold mb-4">Recent Jobs</h2>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => {
                  if (job.status === 'completed') {
                    router.push(`/bulk-email/review/${job.id}`);
                  } else {
                    router.push(`/bulk-email/progress/${job.id}`);
                  }
                }}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium">{job.name}</p>
                  <p className="text-xs text-gray-500">{new Date(job.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {job.emails_generated}/{job.total_prospects} emails
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    job.status === 'completed' ? 'bg-green-100 text-green-700' :
                    job.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
