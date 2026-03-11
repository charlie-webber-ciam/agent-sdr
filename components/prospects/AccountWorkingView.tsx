'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Prospect } from './ProspectTab';

interface ProspectEmailData {
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
  first_name: string;
  last_name: string;
  title: string | null;
}

interface Props {
  accountId: number;
  prospects: Prospect[];
  researchContext: 'auth0' | 'okta';
  onSelectProspect: (p: Prospect) => void;
  onWriteEmail: (p: Prospect) => void;
  onRerunMapping: () => void;
  onEmailSaved: () => void;
  emailRefreshKey?: number;
}

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-700',
  Security: 'bg-red-100 text-red-700',
  IT: 'bg-amber-100 text-amber-700',
  Product: 'bg-purple-100 text-purple-700',
  Executive: 'bg-gray-800 text-white',
  Other: 'bg-gray-100 text-gray-700',
};

const SENIORITY_LABELS: Record<string, string> = {
  c_suite: 'C-Suite',
  vp: 'VP',
  director: 'Director',
  manager: 'Manager',
  individual_contributor: 'IC',
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  ai_research: { label: 'AI Mapped', color: 'bg-purple-100 text-purple-700' },
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-600' },
  salesforce_import: { label: 'Salesforce', color: 'bg-blue-100 text-blue-700' },
};

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

export default function AccountWorkingView({
  accountId, prospects, researchContext, onSelectProspect, onWriteEmail, onRerunMapping, onEmailSaved, emailRefreshKey,
}: Props) {
  const [emails, setEmails] = useState<ProspectEmailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProspect, setExpandedProspect] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [seniorityFilter, setSeniorityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; currentName: string } | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/prospect-emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    if (emailRefreshKey && emailRefreshKey > 0) {
      fetchEmails();
    }
  }, [emailRefreshKey, fetchEmails]);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMarkSent = async (prospectId: number, emailId: number) => {
    try {
      await fetch(`/api/prospects/${prospectId}/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      });
      fetchEmails();
    } catch {
      // ignore
    }
  };

  const handleArchive = async (prospectId: number, emailId: number) => {
    try {
      await fetch(`/api/prospects/${prospectId}/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      fetchEmails();
    } catch {
      // ignore
    }
  };

  const emailsByProspect = new Map<number, ProspectEmailData[]>();
  for (const email of emails) {
    const list = emailsByProspect.get(email.prospect_id) || [];
    list.push(email);
    emailsByProspect.set(email.prospect_id, list);
  }

  const filteredProspects = prospects.filter(p => {
    if (deptFilter !== 'all' && p.department !== deptFilter) return false;
    if (seniorityFilter !== 'all' && p.seniority_level !== seniorityFilter) return false;
    if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
    return true;
  });

  const prospectsWithoutEmails = filteredProspects.filter(p => {
    const pe = emailsByProspect.get(p.id) || [];
    return pe.length === 0;
  });

  const departments = [...new Set(prospects.map(p => p.department).filter(Boolean))];
  const seniorityLevels = [...new Set(prospects.map(p => p.seniority_level).filter(Boolean))];
  const sources = [...new Set(prospects.map(p => p.source).filter(Boolean))];

  const allEmailTexts = filteredProspects.flatMap(p => {
    const prospectEmails = emailsByProspect.get(p.id) || [];
    return prospectEmails.map(e => `To: ${p.first_name} ${p.last_name} (${p.title || 'N/A'})\nSubject: ${e.subject}\n\n${e.body}`);
  });

  const handleBulkGenerate = async () => {
    if (prospectsWithoutEmails.length === 0) return;
    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: prospectsWithoutEmails.length, currentName: '' });

    for (let i = 0; i < prospectsWithoutEmails.length; i++) {
      const prospect = prospectsWithoutEmails[i];
      const name = `${prospect.first_name} ${prospect.last_name}`;
      const persona = prospect.title || (prospect.role_type ? prospect.role_type.replace(/_/g, ' ') : 'Contact');

      setBulkProgress({ current: i, total: prospectsWithoutEmails.length, currentName: name });

      try {
        // Generate
        const genRes = await fetch(`/api/accounts/${accountId}/generate-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: name,
            recipientPersona: persona,
            emailType: 'cold',
            researchContext,
          }),
        });

        if (!genRes.ok) continue;
        const genData = await genRes.json();
        if (!genData.success || !genData.email) continue;

        // Save
        await fetch(`/api/prospects/${prospect.id}/emails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: genData.email.subject,
            body: genData.email.body,
            reasoning: genData.email.reasoning,
            key_insights: JSON.stringify(genData.email.keyInsights),
            email_type: 'cold',
            research_context: researchContext,
          }),
        });
      } catch {
        // continue on error
      }
    }

    setBulkGenerating(false);
    setBulkProgress(null);
    fetchEmails();
    onEmailSaved();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (prospects.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-gray-500 text-sm">No prospects yet</p>
        <button
          onClick={onRerunMapping}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Map Prospects
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Top Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {departments.length > 1 && (
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d!}>{d}</option>
              ))}
            </select>
          )}
          {seniorityLevels.length > 1 && (
            <select
              value={seniorityFilter}
              onChange={e => setSeniorityFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
            >
              <option value="all">All Seniority</option>
              {seniorityLevels.map(s => (
                <option key={s} value={s!}>{SENIORITY_LABELS[s!] || s}</option>
              ))}
            </select>
          )}
          {sources.length > 1 && (
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
            >
              <option value="all">All Sources</option>
              {sources.map(s => (
                <option key={s} value={s}>{SOURCE_LABELS[s]?.label || s}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          {allEmailTexts.length > 0 && (
            <button
              onClick={() => copyToClipboard(allEmailTexts.join('\n\n---\n\n'), 'all')}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copiedId === 'all' ? 'Copied!' : 'Copy All Emails'}
            </button>
          )}
          <button
            onClick={onRerunMapping}
            className="px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Map Prospects
          </button>
        </div>
      </div>

      {/* Bulk Generate Banner */}
      {prospectsWithoutEmails.length > 0 && !bulkGenerating && (
        <div className="mb-4 flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
          <div className="text-sm text-purple-800">
            <span className="font-medium">{prospectsWithoutEmails.length}</span> prospect{prospectsWithoutEmails.length !== 1 ? 's' : ''} without emails
          </div>
          <button
            onClick={handleBulkGenerate}
            className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Generate Emails for All
          </button>
        </div>
      )}

      {/* Bulk Progress */}
      {bulkGenerating && bulkProgress && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
            <span className="text-sm font-medium text-purple-800">
              Generating emails... ({bulkProgress.current}/{bulkProgress.total})
            </span>
          </div>
          {bulkProgress.currentName && (
            <p className="text-xs text-purple-600">Writing email for {bulkProgress.currentName}...</p>
          )}
          <div className="w-full bg-purple-200 rounded-full h-1.5">
            <div
              className="bg-purple-600 h-1.5 rounded-full transition-all"
              style={{ width: `${bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Prospect Cards */}
      <div className="space-y-3">
        {filteredProspects.map(prospect => {
          const prospectEmails = emailsByProspect.get(prospect.id) || [];
          const isExpanded = expandedProspect === prospect.id;
          const deptColor = DEPT_COLORS[prospect.department || 'Other'] || DEPT_COLORS.Other;
          const sourceInfo = SOURCE_LABELS[prospect.source] || { label: prospect.source, color: 'bg-gray-100 text-gray-600' };
          const hasEmails = prospectEmails.length > 0;

          return (
            <div key={prospect.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Prospect Header */}
              <div
                className="px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                onClick={() => setExpandedProspect(isExpanded ? null : prospect.id)}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); onSelectProspect(prospect); }}
                        className="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors"
                      >
                        {prospect.first_name} {prospect.last_name}
                      </button>
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${deptColor}`}>
                        {prospect.department || 'Other'}
                      </span>
                      {prospect.seniority_level && (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                          {SENIORITY_LABELS[prospect.seniority_level] || prospect.seniority_level}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 text-xs rounded ${sourceInfo.color}`}>
                        {sourceInfo.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{prospect.title || 'No title'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={e => { e.stopPropagation(); onWriteEmail(prospect); }}
                    className="px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded border border-purple-200 transition-colors"
                  >
                    Write Email
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onSelectProspect(prospect); }}
                    className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                  >
                    Edit
                  </button>
                  {prospect.linkedin_url && (
                    <a
                      href={prospect.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </a>
                  )}
                  {prospect.sfdc_id && (
                    <a
                      href={`https://okta.lightning.force.com/lightning/r/${prospect.sfdc_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-orange-600 hover:text-orange-700 text-xs font-semibold"
                    >
                      SFDC
                    </a>
                  )}
                  {hasEmails ? (
                    <span className="text-xs text-gray-400">{prospectEmails.length} email{prospectEmails.length !== 1 ? 's' : ''}</span>
                  ) : (
                    <span className="text-xs text-amber-500">No emails</span>
                  )}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Relevance Reason */}
              {prospect.description && (
                <div className="px-4 pb-2 bg-white">
                  <p className="text-xs text-gray-500">{prospect.description}</p>
                </div>
              )}

              {/* Expanded Emails */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                  {prospectEmails.length === 0 ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-400">No emails generated yet</p>
                      <button
                        onClick={() => onWriteEmail(prospect)}
                        className="px-3 py-1.5 text-xs font-medium text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        Write Email
                      </button>
                    </div>
                  ) : (
                    prospectEmails.map(email => {
                      const keyInsights = parseKeyInsights(email.key_insights);
                      return (
                      <div key={email.id} className="bg-white rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                              email.status === 'sent' ? 'bg-green-100 text-green-700' :
                              email.status === 'archived' ? 'bg-gray-100 text-gray-500' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {email.status}
                            </span>
                            <span className="text-xs text-gray-400">{email.email_type}</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => copyToClipboard(email.subject, `subj-${email.id}`)}
                              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            >
                              {copiedId === `subj-${email.id}` ? 'Copied!' : 'Copy Subject'}
                            </button>
                            <button
                              onClick={() => copyToClipboard(email.body, `body-${email.id}`)}
                              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                            >
                              {copiedId === `body-${email.id}` ? 'Copied!' : 'Copy Body'}
                            </button>
                            <button
                              onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`, `all-${email.id}`)}
                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded font-medium"
                            >
                              {copiedId === `all-${email.id}` ? 'Copied!' : 'Copy All'}
                            </button>
                          </div>
                        </div>

                        <div className="mb-2">
                          <span className="text-xs text-gray-500">Subject: </span>
                          <span className="text-sm font-medium text-gray-900">{email.subject}</span>
                        </div>

                        <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap mb-2">
                          {email.body}
                        </div>
                        {keyInsights.length > 0 && (
                          <details className="mb-2">
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

                        {email.status === 'draft' && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleMarkSent(prospect.id, email.id)}
                              className="px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 rounded border border-green-200"
                            >
                              Mark as Sent
                            </button>
                            <button
                              onClick={() => handleArchive(prospect.id, email.id)}
                              className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded border border-gray-200"
                            >
                              Archive
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
