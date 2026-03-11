'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import ProspectEmailModal from '@/components/prospects/ProspectEmailModal';

interface QlImportJob {
  id: number;
  total_leads: number;
  processed_count: number;
  accounts_matched: number;
  accounts_created: number;
  prospects_created: number;
  prospects_skipped: number;
  emails_generated: number;
  emails_skipped: number;
  emails_held_customer: number;
  emails_held_opp: number;
  status: string;
  current_step: string | null;
  error_log: string | null;
  prospect_ids: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ProspectResult {
  id: number;
  account_id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  sfdc_id: string | null;
  campaign_name: string | null;
  member_status: string | null;
  account_status_sfdc: string | null;
  company_name: string;
  domain: string | null;
  account_industry: string | null;
  email_gen_status: string;
  role_type: string | null;
}

interface ProspectEmail {
  id: number;
  prospect_id: number;
  account_id: number;
  subject: string;
  body: string;
  reasoning: string | null;
  key_insights: string | null;
  email_type: string;
  research_context: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UnresolvedAccountItem {
  companyKey: string;
  companyName: string;
  leadCount: number;
  sampleProspects: string[];
  candidates: Array<{
    id: number;
    companyName: string;
    domain: string | null;
    industry: string;
  }>;
}

function countNonEmptyLines(text: string): number {
  const lines = text.split('\n');
  let count = 0;
  for (const line of lines) {
    if (line.trim()) count++;
  }
  return count;
}

function parseKeyInsights(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean);
    }
  } catch {
    // Fall through to legacy plain-text format.
  }
  const trimmed = raw.trim();
  return trimmed ? [trimmed] : [];
}

function getClassificationBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'emailed':
      return { label: 'Auto-emailed', cls: 'bg-green-100 text-green-700' };
    case 'customer':
      return { label: 'Customer', cls: 'bg-amber-100 text-amber-700' };
    case 'active_opp':
      return { label: 'Active Opp', cls: 'bg-orange-100 text-orange-700' };
    case 'no_research':
      return { label: 'No Research', cls: 'bg-gray-100 text-gray-600' };
    case 'skipped_dedup':
      return { label: 'Duplicate', cls: 'bg-gray-100 text-gray-500' };
    default:
      return { label: 'Unknown', cls: 'bg-gray-100 text-gray-500' };
  }
}

export default function QlImportPage() {
  const [rawText, setRawText] = useState('');
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parserMode, setParserMode] = useState<'deterministic' | 'llm' | null>(null);
  const [resolutionPrompt, setResolutionPrompt] = useState<UnresolvedAccountItem[] | null>(null);
  const [resolutionSelections, setResolutionSelections] = useState<Record<string, string>>({});
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [job, setJob] = useState<QlImportJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<QlImportJob[]>([]);

  // Results state
  const [results, setResults] = useState<ProspectResult[]>([]);
  const [prospectEmails, setProspectEmails] = useState<Record<number, ProspectEmail[]>>({});
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [emailModalProspect, setEmailModalProspect] = useState<ProspectResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewCount = rawText.trim() ? countNonEmptyLines(rawText) : 0;

  const selectedProspect = results.find(p => p.id === selectedProspectId) || null;
  const selectedIndex = selectedProspect ? results.indexOf(selectedProspect) : -1;
  const selectedEmails = selectedProspectId ? (prospectEmails[selectedProspectId] || []) : [];

  // Fetch recent jobs
  const fetchRecentJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/ql-import');
      if (res.ok) {
        const data = await res.json();
        setRecentJobs(data.jobs || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRecentJobs();
  }, [fetchRecentJobs]);

  // Fetch results for a completed job
  const fetchResults = useCallback(async (jobId: number) => {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/ql-import/${jobId}/prospects`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.prospects || []);
        setProspectEmails(data.emails || {});
      }
    } catch {
      // ignore
    } finally {
      setLoadingResults(false);
    }
  }, []);

  // Poll active job
  useEffect(() => {
    if (!activeJobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/ql-import/${activeJobId}`);
        if (res.ok) {
          const data = await res.json();
          setJob(data.job);
          if (data.job.status === 'completed' || data.job.status === 'failed') {
            fetchRecentJobs();
            if (data.job.status === 'completed' && data.job.prospect_ids) {
              fetchResults(activeJobId);
            }
          }
        }
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [activeJobId, fetchRecentJobs, fetchResults]);

  const startImport = async (
    resolutions?: Array<{
      companyKey: string;
      action: 'link' | 'create';
      accountId?: number;
    }>
  ) => {
    if (!rawText.trim()) return;
    setSubmitting(true);
    setError(null);
    setParseErrors([]);
    setResults([]);
    setProspectEmails({});
    setSelectedProspectId(null);

    try {
      const res = await fetch('/api/ql-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, resolutions }),
      });

      const data = await res.json();

      if (res.status === 409 && data?.needsResolution) {
        const unresolved = (data.unresolvedAccounts || []) as UnresolvedAccountItem[];
        const defaults: Record<string, string> = {};
        for (const item of unresolved) {
          if (item.candidates.length > 0) {
            defaults[item.companyKey] = `link:${item.candidates[0].id}`;
          } else {
            defaults[item.companyKey] = 'create';
          }
        }
        setResolutionPrompt(unresolved);
        setResolutionSelections(defaults);
        setParserMode(data.parserMode === 'llm' ? 'llm' : 'deterministic');
        if (data.parseErrors) setParseErrors(data.parseErrors);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Failed to start import');
        if (data.parseErrors) setParseErrors(data.parseErrors);
        return;
      }

      if (data.parseErrors?.length > 0) {
        setParseErrors(data.parseErrors);
      }
      setParserMode(data.parserMode === 'llm' ? 'llm' : 'deterministic');

      setActiveJobId(data.jobId);
      setResolutionPrompt(null);
      setResolutionSelections({});
      setRawText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    await startImport();
  };

  const handleConfirmResolutions = async () => {
    if (!resolutionPrompt || resolutionPrompt.length === 0) return;

    const resolutions: Array<{
      companyKey: string;
      action: 'link' | 'create';
      accountId?: number;
    }> = [];

    for (const item of resolutionPrompt) {
      const selection = resolutionSelections[item.companyKey];
      if (!selection) {
        setError(`Please choose an account action for ${item.companyName}`);
        return;
      }
      if (selection === 'create') {
        resolutions.push({
          companyKey: item.companyKey,
          action: 'create',
        });
        continue;
      }
      if (!selection.startsWith('link:')) {
        setError(`Invalid account selection for ${item.companyName}`);
        return;
      }
      const accountId = parseInt(selection.replace('link:', ''), 10);
      if (isNaN(accountId)) {
        setError(`Invalid linked account for ${item.companyName}`);
        return;
      }
      resolutions.push({
        companyKey: item.companyKey,
        action: 'link',
        accountId,
      });
    }

    await startImport(resolutions);
  };

  const handleReportFile = async (file: File) => {
    try {
      const text = await file.text();
      setRawText(text);
      setUploadedFileName(file.name);
      setInputMode('upload');
      setError(null);
      setParserMode(null);
      setParseErrors([]);
      setResolutionPrompt(null);
      setResolutionSelections({});
    } catch {
      setError('Failed to read uploaded file');
    }
  };

  const handleLoadJob = (j: QlImportJob) => {
    setActiveJobId(j.id);
    setJob(j);
    setParserMode(null);
    setResolutionPrompt(null);
    setResolutionSelections({});
    setResults([]);
    setProspectEmails({});
    setSelectedProspectId(null);
    if (j.status === 'completed' && j.prospect_ids) {
      fetchResults(j.id);
    }
  };

  // Email actions
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const updateEmailStatus = async (email: ProspectEmail, newStatus: string) => {
    try {
      const res = await fetch(`/api/prospects/${email.prospect_id}/emails/${email.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setProspectEmails(prev => {
          const updated = { ...prev };
          updated[email.prospect_id] = (updated[email.prospect_id] || []).map(e =>
            e.id === email.id ? { ...e, status: newStatus, sent_at: newStatus === 'sent' ? new Date().toISOString() : e.sent_at } : e
          );
          return updated;
        });
      }
    } catch {
      // ignore
    }
  };

  // Slide-over navigation
  const goToPrev = () => {
    if (selectedIndex > 0) {
      setSelectedProspectId(results[selectedIndex - 1].id);
    }
  };

  const goToNext = () => {
    if (selectedIndex < results.length - 1) {
      setSelectedProspectId(results[selectedIndex + 1].id);
    }
  };

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProspectId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const isProcessing = job && (job.status === 'pending' || job.status === 'processing');
  const isComplete = job && job.status === 'completed';
  const isFailed = job && job.status === 'failed';
  const progressPct = job && job.total_leads > 0
    ? Math.round((job.processed_count / job.total_leads) * 100)
    : 0;

  const getEmailStatusBadge = (prospect: ProspectResult) => {
    const emails = prospectEmails[prospect.id];
    if (!emails || emails.length === 0) return { label: 'None', cls: 'bg-gray-100 text-gray-600' };
    const hasSent = emails.some(e => e.status === 'sent');
    const hasDraft = emails.some(e => e.status === 'draft');
    if (hasSent) return { label: 'Sent', cls: 'bg-green-100 text-green-700' };
    if (hasDraft) return { label: 'Draft', cls: 'bg-blue-100 text-blue-700' };
    return { label: 'Archived', cls: 'bg-gray-100 text-gray-600' };
  };

  const isHeldProspect = (p: ProspectResult) =>
    p.email_gen_status === 'customer' || p.email_gen_status === 'active_opp';

  const heldHasNoEmails = (p: ProspectResult) =>
    isHeldProspect(p) && (!prospectEmails[p.id] || prospectEmails[p.id].length === 0);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Bulk HVT Writing</h1>
        <p className="text-gray-500 text-sm mt-1">
          Paste unstructured prospect text, auto-link accounts, and generate one cold email per prospect
        </p>
      </div>

      {/* Active job progress */}
      {activeJobId && job && (
        <div className={`mb-8 rounded-xl border p-6 ${
          isFailed ? 'bg-red-50 border-red-200' :
          isComplete ? 'bg-green-50 border-green-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {isProcessing ? 'Processing...' : isComplete ? 'Import Complete' : 'Import Failed'}
            </h2>
            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
              isFailed ? 'bg-red-100 text-red-700' :
              isComplete ? 'bg-green-100 text-green-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {job.status}
            </span>
          </div>

          {/* Progress bar */}
          {isProcessing && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{job.current_step || 'Processing...'}</span>
                <span>{job.processed_count}/{job.total_leads} ({progressPct}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Accounts Matched</p>
              <p className="text-lg font-semibold text-gray-900">{job.accounts_matched}</p>
            </div>
            <div>
              <p className="text-gray-500">Accounts Created</p>
              <p className="text-lg font-semibold text-gray-900">{job.accounts_created}</p>
            </div>
            <div>
              <p className="text-gray-500">Prospects Created</p>
              <p className="text-lg font-semibold text-gray-900">{job.prospects_created}</p>
            </div>
            <div>
              <p className="text-gray-500">Prospects Skipped</p>
              <p className="text-lg font-semibold text-gray-900">{job.prospects_skipped}</p>
            </div>
            <div>
              <p className="text-gray-500">Emails Generated</p>
              <p className="text-lg font-semibold text-gray-900">{job.emails_generated}</p>
            </div>
            <div>
              <p className="text-gray-500">Emails Skipped</p>
              <p className="text-lg font-semibold text-gray-900">{job.emails_skipped}</p>
            </div>
            <div>
              <p className="text-gray-500">Held (Customer)</p>
              <p className="text-lg font-semibold text-amber-700">{job.emails_held_customer || 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Held (Active Opp)</p>
              <p className="text-lg font-semibold text-orange-700">{job.emails_held_opp || 0}</p>
            </div>
          </div>

          {/* Error log */}
          {job.error_log && (
            <details className="mt-4">
              <summary className="text-sm text-red-600 cursor-pointer font-medium">
                View errors
              </summary>
              <pre className="mt-2 text-xs text-red-700 bg-red-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                {job.error_log}
              </pre>
            </details>
          )}

          {/* Complete actions */}
          {isComplete && (
            <div className="mt-4 flex gap-3">
              <Link
                href="/prospects"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Prospects
              </Link>
              <button
                onClick={() => {
                  setActiveJobId(null);
                  setJob(null);
                  setResults([]);
                  setProspectEmails({});
                  setSelectedProspectId(null);
                  setParserMode(null);
                  setResolutionPrompt(null);
                  setResolutionSelections({});
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Import More
              </button>
            </div>
          )}

          {isFailed && (
            <button
              onClick={() => {
                setActiveJobId(null);
                setJob(null);
                setParserMode(null);
                setResolutionPrompt(null);
                setResolutionSelections({});
              }}
              className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Results table */}
      {isComplete && results.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Bulk Writing Results ({results.length} prospect{results.length !== 1 ? 's' : ''})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Company</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Title</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Classification</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Campaign</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Member Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">SFDC</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Email Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map(p => {
                    const badge = getEmailStatusBadge(p);
                    const classBadge = getClassificationBadge(p.email_gen_status);
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedProspectId === p.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedProspectId(p.id)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                          {p.first_name} {p.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{p.company_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{p.title || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${classBadge.cls}`}>
                            {classBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{p.campaign_name || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {p.member_status ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                              {p.member_status}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {p.sfdc_id ? (
                            <span className="text-xs font-mono text-gray-500" title={p.sfdc_id}>
                              {p.sfdc_id.slice(0, 10)}...
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isComplete && loadingResults && (
        <div className="mb-8 text-center py-8 text-gray-500 text-sm">
          Loading results...
        </div>
      )}

      {/* Input form (hidden when job is active) */}
      {!activeJobId && (
        <div className="mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setInputMode('paste')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    inputMode === 'paste'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Paste Text
                </button>
                <button
                  onClick={() => setInputMode('upload')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${
                    inputMode === 'upload'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Upload Report
                </button>
              </div>
              {previewCount > 0 && (
                <span className="text-sm text-blue-600 font-medium">
                  {previewCount} non-empty line{previewCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {inputMode === 'upload' && (
              <div className="mb-3 rounded-lg border border-dashed border-gray-300 p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">Upload lead report (.csv or .txt)</p>
                    <p className="text-xs text-gray-500 truncate">
                      {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Expected columns: First Name, Last Name, Title, Company / Account, Email, Lead Source, Lead Status, Lead Owner'}
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Choose File
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleReportFile(file);
                  }}
                />
              </div>
            )}
            <label className="text-sm font-medium text-gray-700 block mb-2">
              {inputMode === 'upload'
                ? 'Review or edit uploaded report text'
                : 'Paste bulk prospect text (any report format)'}
            </label>
            <textarea
              value={rawText}
              onChange={e => {
                setRawText(e.target.value);
                if (inputMode === 'upload' && !uploadedFileName) {
                  setInputMode('paste');
                }
                setParserMode(null);
                setResolutionPrompt(null);
                setResolutionSelections({});
              }}
              rows={16}
              placeholder={`Paste your data here...\n\nAccepted examples:\n- Tabular exports with variable columns\n- Raw plain text prospect lists\n- Mixed fields like names, titles, campaign codes, account status, owners\n\nThe system will normalize with an LLM when needed, then parse/link prospects and write emails.`}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
            <p className="mt-2 text-xs text-gray-500">
              The common Salesforce Lead Owner grouped export and CSV lead report are parsed deterministically first. LLM fallback only runs when deterministic parsing fails.
            </p>

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            {parserMode && (
              <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                parserMode === 'llm'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200'
              }`}>
                Parser used: {parserMode === 'llm' ? 'LLM normalization' : 'Deterministic QL parser'}
              </div>
            )}

            {resolutionPrompt && resolutionPrompt.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-900">
                  Link Accounts Before Starting
                </h3>
                <p className="text-xs text-amber-700 mt-1">
                  Some companies were not auto-linked. Choose an existing account or create a new one for each.
                </p>
                <div className="mt-3 space-y-3">
                  {resolutionPrompt.map(item => (
                    <div key={item.companyKey} className="rounded-md border border-amber-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{item.companyName}</p>
                        <span className="text-xs text-gray-500">
                          {item.leadCount} prospect{item.leadCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {item.sampleProspects.length > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          {item.sampleProspects.join(', ')}
                        </p>
                      )}
                      <div className="mt-2">
                        <select
                          value={resolutionSelections[item.companyKey] || 'create'}
                          onChange={e =>
                            setResolutionSelections(prev => ({
                              ...prev,
                              [item.companyKey]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {item.candidates.map(candidate => (
                            <option key={candidate.id} value={`link:${candidate.id}`}>
                              Link: {candidate.companyName} ({candidate.domain || 'no domain'})
                            </option>
                          ))}
                          <option value="create">Create new account: {item.companyName}</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parseErrors.length > 0 && (
              <details className="mt-3">
                <summary className="text-sm text-amber-600 cursor-pointer font-medium">
                  {parseErrors.length} parse warning{parseErrors.length !== 1 ? 's' : ''}
                </summary>
                <ul className="mt-1 text-xs text-amber-700 bg-amber-50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  {parseErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={resolutionPrompt ? handleConfirmResolutions : handleSubmit}
                disabled={submitting || !rawText.trim()}
                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting
                  ? 'Submitting...'
                  : resolutionPrompt
                    ? 'Confirm Links & Start Bulk Writing'
                    : 'Parse, Link & Write Emails'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent imports */}
      {recentJobs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Bulk Writing Jobs</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">ID</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Leads</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Prospects</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Emails</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentJobs.map(j => (
                  <tr
                    key={j.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${activeJobId === j.id ? 'bg-blue-50' : ''}`}
                    onClick={() => handleLoadJob(j)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">#{j.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {j.processed_count}/{j.total_leads}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {j.prospects_created} created, {j.prospects_skipped} skipped
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {j.emails_generated} gen, {j.emails_skipped} skip
                      {((j.emails_held_customer || 0) + (j.emails_held_opp || 0)) > 0 && (
                        <span className="text-amber-600 ml-1">
                          , {(j.emails_held_customer || 0) + (j.emails_held_opp || 0)} held
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        j.status === 'completed' ? 'bg-green-100 text-green-700' :
                        j.status === 'failed' ? 'bg-red-100 text-red-700' :
                        j.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(j.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over panel */}
      {selectedProspect && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSelectedProspectId(null)}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">
                    {selectedProspect.first_name[0]}{selectedProspect.last_name[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {selectedProspect.first_name} {selectedProspect.last_name}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {selectedProspect.title || 'No title'} at {selectedProspect.company_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Prev/Next */}
                <div className="flex items-center gap-1 mr-2">
                  <button
                    onClick={goToPrev}
                    disabled={selectedIndex <= 0}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous prospect"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-400 tabular-nums">{selectedIndex + 1}/{results.length}</span>
                  <button
                    onClick={goToNext}
                    disabled={selectedIndex >= results.length - 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next prospect"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => setSelectedProspectId(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Contact Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Email</p>
                    <p className="text-gray-900">{selectedProspect.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Phone</p>
                    <p className="text-gray-900">{selectedProspect.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Company</p>
                    <p className="text-gray-900">{selectedProspect.company_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Industry</p>
                    <p className="text-gray-900">{selectedProspect.account_industry || '-'}</p>
                  </div>
                  {selectedProspect.sfdc_id && (
                    <div className="col-span-2">
                      <p className="text-gray-500 text-xs">Salesforce</p>
                      <a
                        href={`https://okta.lightning.force.com/lightning/r/${selectedProspect.sfdc_id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium"
                      >
                        <span>{selectedProspect.sfdc_id}</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Campaign Details */}
              {(selectedProspect.campaign_name || selectedProspect.member_status || selectedProspect.account_status_sfdc) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Campaign Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedProspect.campaign_name && (
                      <div className="col-span-2">
                        <p className="text-gray-500 text-xs">Campaign Name</p>
                        <p className="text-gray-900">{selectedProspect.campaign_name}</p>
                      </div>
                    )}
                    {selectedProspect.member_status && (
                      <div>
                        <p className="text-gray-500 text-xs">Member Status</p>
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                          {selectedProspect.member_status}
                        </span>
                      </div>
                    )}
                    {selectedProspect.account_status_sfdc && (
                      <div>
                        <p className="text-gray-500 text-xs">Account Status</p>
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                          {selectedProspect.account_status_sfdc}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Held prospect info banner */}
              {heldHasNoEmails(selectedProspect) && (
                <div className={`rounded-lg border p-4 ${
                  selectedProspect.email_gen_status === 'customer'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <p className={`text-sm font-medium ${
                    selectedProspect.email_gen_status === 'customer' ? 'text-amber-800' : 'text-orange-800'
                  }`}>
                    {selectedProspect.email_gen_status === 'customer'
                      ? 'Email held — this account is marked as a customer'
                      : 'Email held — this account has an active opportunity'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    selectedProspect.email_gen_status === 'customer' ? 'text-amber-600' : 'text-orange-600'
                  }`}>
                    {selectedProspect.email_gen_status === 'customer'
                      ? 'Auto-email was skipped because the SFDC account status indicates this is an existing customer. You can manually generate an email if appropriate.'
                      : 'Auto-email was skipped because there is a non-closed opportunity on this account. You can manually generate an email if appropriate.'}
                  </p>
                  <button
                    onClick={() => setEmailModalProspect(selectedProspect)}
                    className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Generate Email
                  </button>
                </div>
              )}

              {/* Emails */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Generated Emails ({selectedEmails.length})
                  </h4>
                  {selectedEmails.length === 0 && !heldHasNoEmails(selectedProspect) && (
                    <button
                      onClick={() => setEmailModalProspect(selectedProspect)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Generate Email
                    </button>
                  )}
                </div>
                {selectedEmails.length === 0 && !heldHasNoEmails(selectedProspect) ? (
                  <p className="text-sm text-gray-500">No emails generated for this prospect.</p>
                ) : selectedEmails.length === 0 ? null : (
                  <div className="space-y-4">
                    {selectedEmails.map(email => {
                      const keyInsights = parseKeyInsights(email.key_insights);
                      return (
                      <div key={email.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Email header */}
                        <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                              email.status === 'sent' ? 'bg-green-100 text-green-700' :
                              email.status === 'archived' ? 'bg-gray-100 text-gray-600' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {email.status}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {email.email_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`, `email-${email.id}`)}
                              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Copy email"
                            >
                              {copiedField === `email-${email.id}` ? 'Copied!' : 'Copy'}
                            </button>
                            {email.status === 'draft' && (
                              <button
                                onClick={() => updateEmailStatus(email, 'sent')}
                                className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Mark as sent"
                              >
                                Mark Sent
                              </button>
                            )}
                            {email.status !== 'archived' && (
                              <button
                                onClick={() => updateEmailStatus(email, 'archived')}
                                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                                title="Archive"
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Subject */}
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-xs text-gray-500">Subject</p>
                          <p className="text-sm font-medium text-gray-900">{email.subject}</p>
                        </div>

                        {/* Body */}
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{email.body}</p>
                        </div>
                        {keyInsights.length > 0 && (
                          <details className="px-4 pb-3">
                            <summary className="text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-800">
                              Key Insights ({keyInsights.length})
                            </summary>
                            <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-gray-700 bg-blue-50 border border-blue-100 rounded-md p-2.5">
                              {keyInsights.map((insight, index) => (
                                <li key={`${email.id}-insight-${index}`}>{insight}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Email generation modal */}
      {emailModalProspect && (
        <ProspectEmailModal
          prospect={emailModalProspect as any}
          accountId={emailModalProspect.account_id}
          researchContext="auth0"
          onClose={() => setEmailModalProspect(null)}
          onSave={() => {
            setEmailModalProspect(null);
            if (activeJobId) fetchResults(activeJobId);
          }}
        />
      )}
    </main>
  );
}
