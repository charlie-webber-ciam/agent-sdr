'use client';

import { useState, useEffect, useCallback } from 'react';
import ProspectTierBadge from './ProspectTierBadge';
import MarkdownBody from './MarkdownBody';
import TagList from './TagList';
import Toast from './Toast';

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

interface CallRecord {
  id: number;
  outcome: string;
  notes: string | null;
  duration_sec: number | null;
  called_at: string;
}

interface Props {
  prospectId: number;
  prospects: ProspectRow[];
  onClose: () => void;
  onNavigate: (id: number) => void;
  onDataChange: () => void;
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

export default function ProspectSlideOver({ prospectId, prospects, onClose, onNavigate, onDataChange }: Props) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [researching, setResearching] = useState(false);

  const prospect = prospects.find(p => p.id === prospectId);
  const currentIdx = prospects.findIndex(p => p.id === prospectId);
  const prevProspect = currentIdx > 0 ? prospects[currentIdx - 1] : null;
  const nextProspect = currentIdx < prospects.length - 1 ? prospects[currentIdx + 1] : null;

  const fetchCalls = useCallback(async () => {
    setLoadingCalls(true);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/calls`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
      }
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    } finally {
      setLoadingCalls(false);
    }
  }, [prospectId]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp' && prevProspect) { e.preventDefault(); onNavigate(prevProspect.id); }
      if (e.key === 'ArrowDown' && nextProspect) { e.preventDefault(); onNavigate(nextProspect.id); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, prevProspect, nextProspect]);

  const handleResearch = async () => {
    setResearching(true);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/research`, { method: 'POST' });
      if (res.ok) {
        onDataChange();
      }
    } catch (err) {
      setToast({ message: 'Research failed. Please try again.', type: 'error' });
    } finally {
      setResearching(false);
    }
  };

  const [toast, setToast] = useState<{message: string; type: 'success'|'error'|'info'}|null>(null);

  if (!prospect) return null;

  const roleBadge = prospect.role_type ? ROLE_BADGES[prospect.role_type] : null;
  const statusBadge = STATUS_BADGES[prospect.relationship_status] || STATUS_BADGES.new;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg z-50 bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevProspect && onNavigate(prevProspect.id)}
              disabled={!prevProspect}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous (Arrow Up)"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => nextProspect && onNavigate(nextProspect.id)}
              disabled={!nextProspect}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next (Arrow Down)"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className="text-xs text-gray-400 ml-1">
              {currentIdx + 1} of {prospects.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-200 transition-colors" title="Close (Esc)">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Identity */}
          <div className="px-5 py-5 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">
              {prospect.first_name} {prospect.last_name}
            </h2>
            {prospect.title && (
              <p className="text-sm text-gray-600 mt-0.5">{prospect.title}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-sm text-gray-500">{prospect.company_name}</span>
              {prospect.account_tier && (
                <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                  prospect.account_tier === 'A' ? 'bg-green-100 text-green-800' :
                  prospect.account_tier === 'B' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  Tier {prospect.account_tier}
                </span>
              )}
              <ProspectTierBadge tier={prospect.value_tier} />
              {roleBadge && (
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleBadge.bg} ${roleBadge.text}`}>
                  {roleBadge.label}
                </span>
              )}
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge.bg} ${statusBadge.text}`}>
                {prospect.relationship_status}
              </span>
            </div>
            {prospect.seniority_level && (
              <p className="text-xs text-gray-400 mt-1 capitalize">{prospect.seniority_level.replace(/_/g, ' ')}</p>
            )}
          </div>

          {/* Contact Info */}
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact</h3>
            <div className="space-y-2">
              {prospect.email && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${prospect.email}`} className="text-blue-600 hover:underline">{prospect.email}</a>
                </div>
              )}
              {prospect.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-gray-700">{prospect.phone}</span>
                  {prospect.do_not_call === 1 && (
                    <span className="text-xs text-red-500 font-medium">DNC</span>
                  )}
                </div>
              )}
              {prospect.mobile && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-700">{prospect.mobile}</span>
                </div>
              )}
              {prospect.linkedin_url && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                    LinkedIn Profile
                  </a>
                </div>
              )}
              {!prospect.email && !prospect.phone && !prospect.mobile && !prospect.linkedin_url && (
                <p className="text-sm text-gray-400 italic">No contact information available</p>
              )}
            </div>
          </div>

          {/* AI Summary */}
          {prospect.ai_summary && (
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Summary</h3>
              <div className="text-sm text-gray-700 leading-relaxed">
                <MarkdownBody>{prospect.ai_summary}</MarkdownBody>
              </div>
              {prospect.ai_processed_at && (
                <p className="text-xs text-gray-400 mt-2">
                  Processed {new Date(prospect.ai_processed_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {prospect.prospect_tags && (
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tags</h3>
              <TagList tagsJson={prospect.prospect_tags} />
            </div>
          )}

          {/* Activity Stats */}
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Activity</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">{prospect.call_count}</div>
                <div className="text-xs text-gray-500">Calls</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">{prospect.connect_count}</div>
                <div className="text-xs text-gray-500">Connects</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">
                  {prospect.call_count > 0 ? Math.round((prospect.connect_count / prospect.call_count) * 100) : 0}%
                </div>
                <div className="text-xs text-gray-500">Rate</div>
              </div>
            </div>
          </div>

          {/* Recent Calls */}
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Calls</h3>
            {loadingCalls ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : calls.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No call history</p>
            ) : (
              <div className="space-y-2">
                {calls.slice(0, 5).map(call => (
                  <div key={call.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${
                        call.outcome === 'connected' ? 'bg-green-100 text-green-700' :
                        call.outcome === 'voicemail' ? 'bg-yellow-100 text-yellow-700' :
                        call.outcome === 'no_answer' ? 'bg-gray-100 text-gray-600' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {call.outcome.replace(/_/g, ' ')}
                      </span>
                      {call.notes && <span className="text-gray-500 ml-2 truncate">{call.notes}</span>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">
                      {new Date(call.called_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account Context */}
          <div className="px-5 py-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Account</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Company</span>
                <span className="text-gray-900 font-medium">{prospect.company_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Domain</span>
                <span className="text-gray-700">{prospect.domain}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Industry</span>
                <span className="text-gray-700">{prospect.account_industry}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Source</span>
                <span className="text-gray-700 capitalize">{prospect.source.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex items-center justify-between">
          <button
            onClick={handleResearch}
            disabled={researching}
            className="px-3 py-1.5 text-sm font-medium text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {researching ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                </svg>
                Researching...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Research
              </>
            )}
          </button>
          <a
            href={`/accounts/${prospect.account_id}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            View Account
          </a>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
