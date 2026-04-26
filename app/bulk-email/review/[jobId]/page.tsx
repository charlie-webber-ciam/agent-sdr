'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, ChevronDown, ChevronUp, RefreshCw, Copy, Check, Pencil, X, Save } from 'lucide-react';

interface EmailRow {
  id: number;
  prospect_id: number;
  account_id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  prospect_email: string | null;
  company_name: string;
  domain: string | null;
  subject: string;
  body: string;
  reasoning: string | null;
  key_insights: string | null;
  email_type: string;
  research_context: string;
  export_status?: string;
}

interface JobInfo {
  id: number;
  name: string;
  status: string;
  total_prospects: number;
  emails_generated: number;
  emails_failed: number;
  created_at: string;
}

export default function BulkEmailReviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<JobInfo | null>(null);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedForExport, setSelectedForExport] = useState<Set<number>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bulk-email/jobs/${jobId}?emails=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load job');
      setJob(data.job);
      setEmails(data.emails || []);
      setSelectedForExport(new Set((data.emails || []).map((e: EmailRow) => e.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/bulk-email/jobs/${jobId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailIds: selectedForExport.size < emails.length ? Array.from(selectedForExport) : undefined,
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk-emails-job-${jobId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const toggleExport = (id: number) => {
    setSelectedForExport((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllExport = () => {
    if (selectedForExport.size === emails.length) {
      setSelectedForExport(new Set());
    } else {
      setSelectedForExport(new Set(emails.map((e) => e.id)));
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const startEditing = (email: EmailRow) => {
    setEditingId(email.id);
    setEditSubject(email.subject);
    setEditBody(email.body);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditSubject('');
    setEditBody('');
  };

  const saveEdit = async (emailId: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/bulk-email/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEmails((prev) =>
        prev.map((e) =>
          e.id === emailId ? { ...e, subject: editSubject.trim(), body: editBody.trim() } : e
        )
      );
      setEditingId(null);
    } catch {
      setError('Failed to save email edit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error || 'Job not found'}</p>
          <button
            onClick={() => router.push('/bulk-email')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Bulk Email
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/bulk-email')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Bulk Email
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Review Emails</h1>
            <p className="text-gray-600">
              Job #{job.id} &middot; {job.emails_generated} emails generated &middot; {job.emails_failed} failed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || selectedForExport.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export {selectedForExport.size} to CSV
            </button>
          </div>
        </div>
      </div>

      {/* Email table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedForExport.size === emails.length && emails.length > 0}
                  onChange={toggleAllExport}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Prospect</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Subject</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Preview</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {emails.map((email) => {
              const isExpanded = expandedId === email.id;
              return (
                <tbody key={email.id}>
                  <tr
                    className={`cursor-pointer hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : email.id)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedForExport.has(email.id)}
                        onChange={() => toggleExport(email.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{email.first_name} {email.last_name}</p>
                      <p className="text-xs text-gray-500">{email.title || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{email.company_name}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{email.subject}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{email.body.slice(0, 80)}...</td>
                    <td className="px-4 py-3">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 bg-gray-50">
                        <div className="max-w-3xl space-y-4">
                          {editingId === email.id ? (
                            <>
                              {/* Editing mode */}
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Subject</label>
                                <input
                                  type="text"
                                  value={editSubject}
                                  onChange={(e) => setEditSubject(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Body</label>
                                <textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  rows={8}
                                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => saveEdit(email.id)}
                                  disabled={saving || !editSubject.trim() || !editBody.trim()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                                >
                                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg hover:bg-gray-100 text-sm text-gray-600"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* View mode */}
                              {/* Subject */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-500 uppercase">Subject</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => startEditing(email)}
                                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                                    >
                                      <Pencil className="h-3 w-3" />
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => copyToClipboard(email.subject, `subject-${email.id}`)}
                                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                    >
                                      {copiedField === `subject-${email.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                      {copiedField === `subject-${email.id}` ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                </div>
                                <p className="font-medium text-gray-900">{email.subject}</p>
                              </div>

                              {/* Body */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-500 uppercase">Body</span>
                                  <button
                                    onClick={() => copyToClipboard(email.body, `body-${email.id}`)}
                                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                  >
                                    {copiedField === `body-${email.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    {copiedField === `body-${email.id}` ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                                <div className="bg-white rounded-lg border p-4 whitespace-pre-wrap text-sm">
                                  {email.body}
                                </div>
                              </div>

                              {/* Copy All */}
                              <button
                                onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`, `all-${email.id}`)}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              >
                                {copiedField === `all-${email.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copiedField === `all-${email.id}` ? 'Copied' : 'Copy full email'}
                              </button>

                              {/* Reasoning */}
                              {email.reasoning && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500 uppercase">Reasoning</span>
                                  <p className="text-sm text-gray-600 mt-1">{email.reasoning}</p>
                                </div>
                              )}

                              {/* Key Insights */}
                              {email.key_insights && (
                                <div>
                                  <span className="text-xs font-medium text-gray-500 uppercase">Key Insights</span>
                                  <ul className="mt-1 space-y-1">
                                    {(() => {
                                      try {
                                        const insights = JSON.parse(email.key_insights);
                                        return Array.isArray(insights)
                                          ? insights.map((insight: string, i: number) => (
                                              <li key={i} className="text-sm text-gray-600">- {insight}</li>
                                            ))
                                          : null;
                                      } catch {
                                        return <li className="text-sm text-gray-600">{email.key_insights}</li>;
                                      }
                                    })()}
                                  </ul>
                                </div>
                              )}

                              {/* Meta */}
                              <div className="flex gap-4 text-xs text-gray-400 pt-2 border-t">
                                {email.prospect_email && <span>Email: {email.prospect_email}</span>}
                                <span>Type: {email.email_type}</span>
                                <span>Context: {email.research_context}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
            {emails.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No emails generated yet. Check the progress page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
