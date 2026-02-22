'use client';

import { useState, useEffect, useCallback } from 'react';
import ProspectTierBadge from './ProspectTierBadge';
import MarkdownBody from './MarkdownBody';
import TagList from './TagList';
import Toast from './Toast';

interface ListItem {
  id: number;
  list_id: number;
  prospect_id: number;
  sort_order: number;
  completed: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  linkedin_url: string | null;
  department: string | null;
  notes: string | null;
  role_type: string | null;
  relationship_status: string;
  value_tier: string | null;
  seniority_level: string | null;
  ai_summary: string | null;
  ai_processed_at: string | null;
  department_tag: string | null;
  call_count: number;
  connect_count: number;
  last_called_at: string | null;
  prospect_tags: string | null;
  company_name: string;
  domain: string;
  account_industry: string;
  account_id: number;
}

interface CallRecord {
  id: number;
  outcome: string;
  notes: string | null;
  duration_sec: number | null;
  called_at: string;
}

interface Props {
  listId: number;
  onClose: () => void;
}

export default function ProspectWorkflowModal({ listId, onClose }: Props) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [listName, setListName] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  const [toast, setToast] = useState<{message: string; type: 'success'|'error'|'info'}|null>(null);

  // Call logging state
  const [showLogCall, setShowLogCall] = useState(false);
  const [callOutcome, setCallOutcome] = useState('dialed');
  const [callDuration, setCallDuration] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [savingCall, setSavingCall] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/prospect-lists/${listId}/items`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setListName(data.list?.name || '');
        // Start at first uncompleted item
        const firstUncompleted = data.items.findIndex((i: ListItem) => !i.completed);
        if (firstUncompleted >= 0) setCurrentIndex(firstUncompleted);
      }
    } catch (err) {
      console.error('Failed to fetch list items:', err);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const current = items[currentIndex];

  // Fetch calls when prospect changes
  useEffect(() => {
    if (!current) return;
    setNotesValue(current.notes || '');
    setLoadingCalls(true);
    fetch(`/api/prospects/${current.prospect_id}/calls`)
      .then(res => res.ok ? res.json() : { calls: [] })
      .then(data => setCalls(data.calls || []))
      .catch(() => setCalls([]))
      .finally(() => setLoadingCalls(false));
  }, [current?.prospect_id]);

  const handlePrev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex(i => Math.min(items.length - 1, i + 1));

  const handleSaveNotes = async () => {
    if (!current) return;
    try {
      const res = await fetch(`/api/accounts/${current.account_id}/prospects/${current.prospect_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue }),
      });
      if (!res.ok) throw new Error('Failed to save notes');
      setItems(prev => prev.map(item =>
        item.prospect_id === current.prospect_id ? { ...item, notes: notesValue } : item
      ));
      setToast({ message: 'Notes saved', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to save notes', type: 'error' });
    }
  };

  const handleLogCall = async () => {
    if (!current) return;
    setSavingCall(true);
    try {
      const res = await fetch(`/api/prospects/${current.prospect_id}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: callOutcome,
          notes: callNotes || null,
          duration_sec: callDuration ? parseInt(callDuration) : null,
        }),
      });
      if (res.ok) {
        const newCall = await res.json();
        setCalls(prev => [newCall, ...prev]);
        setCallOutcome('dialed');
        setCallDuration('');
        setCallNotes('');
        setShowLogCall(false);
        // Update local call count
        setItems(prev => prev.map(item =>
          item.prospect_id === current.prospect_id
            ? { ...item, call_count: item.call_count + 1, connect_count: callOutcome === 'connected' ? item.connect_count + 1 : item.connect_count }
            : item
        ));
      }
    } catch (err) {
      setToast({ message: 'Failed to log call', type: 'error' });
    } finally {
      setSavingCall(false);
    }
  };

  const handleSaveAndNext = async () => {
    if (!current) return;
    try {
      const res = await fetch(`/api/prospect-lists/${listId}/items/${current.prospect_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setItems(prev => prev.map(item =>
        item.prospect_id === current.prospect_id ? { ...item, completed: 1 } : item
      ));
      // Move to next uncompleted
      const nextUncompleted = items.findIndex((item, idx) => idx > currentIndex && !item.completed);
      if (nextUncompleted >= 0) {
        setCurrentIndex(nextUncompleted);
      } else if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (err) {
      setToast({ message: 'Failed to save progress. Please try again.', type: 'error' });
    }
  };

  const handleGenerateAI = async () => {
    if (!current) return;
    setGeneratingAI(true);
    try {
      const res = await fetch(`/api/prospects/${current.prospect_id}/research`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => prev.map(item =>
          item.prospect_id === current.prospect_id
            ? { ...item, ai_summary: data.prospect?.ai_summary || data.research?.summary, ai_processed_at: new Date().toISOString(), value_tier: data.prospect?.value_tier || item.value_tier }
            : item
        ));
      }
    } catch (err) {
      console.error('Failed to generate AI summary:', err);
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-3 text-sm">Loading list...</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md" onClick={e => e.stopPropagation()}>
          <p className="text-gray-500 text-center">This list is empty. Add prospects to get started.</p>
          <button onClick={onClose} className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    );
  }

  const OUTCOME_LABELS: Record<string, string> = {
    dialed: 'Dialed',
    connected: 'Connected',
    voicemail: 'Voicemail',
    no_answer: 'No Answer',
    busy: 'Busy',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">{listName}</h3>
            <span className="text-sm text-gray-500">{currentIndex + 1} of {items.length}</span>
            {current?.completed ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Completed</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} disabled={currentIndex === 0}
              className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={handleNext} disabled={currentIndex === items.length - 1}
              className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button onClick={onClose} className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {current && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left panel (2/3) */}
            <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200">
              {/* Prospect header */}
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-bold text-gray-900">{current.first_name} {current.last_name}</h2>
                <ProspectTierBadge tier={current.value_tier} size="md" />
              </div>

              {/* AI Summary */}
              <section className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">AI Summary</h4>
                  <button
                    onClick={handleGenerateAI}
                    disabled={generatingAI}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {generatingAI ? 'Generating...' : current.ai_summary ? 'Refresh' : 'Generate'}
                  </button>
                </div>
                {current.ai_summary ? (
                  <div className="prose prose-sm max-w-none bg-blue-50 rounded-lg p-4 text-gray-700">
                    <MarkdownBody>{current.ai_summary}</MarkdownBody>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-400 text-sm">
                    No AI summary yet. Click &quot;Generate&quot; to research this prospect.
                  </div>
                )}
                {current.ai_processed_at && (
                  <p className="text-xs text-gray-400 mt-1">Last updated: {new Date(current.ai_processed_at).toLocaleString()}</p>
                )}
              </section>

              {/* Call History */}
              <section className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    Call History ({current.call_count} calls, {current.connect_count} connects)
                  </h4>
                  <button
                    onClick={() => setShowLogCall(!showLogCall)}
                    className="text-xs font-medium text-green-600 hover:text-green-700"
                  >
                    + Log Call
                  </button>
                </div>

                {/* Inline Log Call Panel */}
                {showLogCall && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Outcome</label>
                        <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white">
                          <option value="dialed">Dialed</option>
                          <option value="connected">Connected</option>
                          <option value="voicemail">Voicemail</option>
                          <option value="no_answer">No Answer</option>
                          <option value="busy">Busy</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Duration (sec)</label>
                        <input type="number" value={callDuration} onChange={e => setCallDuration(e.target.value)}
                          placeholder="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                      <textarea value={callNotes} onChange={e => setCallNotes(e.target.value)}
                        rows={2} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleLogCall} disabled={savingCall}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                        {savingCall ? 'Saving...' : 'Save Call'}
                      </button>
                      <button onClick={() => setShowLogCall(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {loadingCalls ? (
                  <div className="text-sm text-gray-400">Loading calls...</div>
                ) : calls.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-3 text-center text-gray-400 text-sm">No calls recorded</div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Date</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Outcome</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Duration</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {calls.slice(0, 10).map(call => (
                          <tr key={call.id}>
                            <td className="px-3 py-2 text-gray-600">{new Date(call.called_at).toLocaleDateString()}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                call.outcome === 'connected' ? 'bg-green-100 text-green-700' :
                                call.outcome === 'voicemail' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {OUTCOME_LABELS[call.outcome] || call.outcome}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{call.duration_sec ? `${call.duration_sec}s` : '-'}</td>
                            <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">{call.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Notes */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Notes</h4>
                <textarea
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  onBlur={handleSaveNotes}
                  rows={4}
                  placeholder="Add notes about this prospect..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-saves on blur</p>
              </section>
            </div>

            {/* Right panel (1/3) */}
            <div className="w-80 overflow-y-auto p-6 bg-gray-50">
              {/* Contact Info */}
              <section className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Contact</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Company:</span>
                    <span className="ml-2 font-medium text-gray-900">{current.company_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Title:</span>
                    <span className="ml-2 text-gray-900">{current.title || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    {current.email ? (
                      <a href={`mailto:${current.email}`} className="ml-2 text-blue-600 hover:underline">{current.email}</a>
                    ) : (
                      <span className="ml-2 text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    {current.phone ? (
                      <a href={`tel:${current.phone}`} className="ml-2 text-blue-600 hover:underline">{current.phone}</a>
                    ) : (
                      <span className="ml-2 text-gray-400">-</span>
                    )}
                  </div>
                  {current.mobile && (
                    <div>
                      <span className="text-gray-500">Mobile:</span>
                      <a href={`tel:${current.mobile}`} className="ml-2 text-blue-600 hover:underline">{current.mobile}</a>
                    </div>
                  )}
                  {current.linkedin_url && (
                    <div>
                      <a href={current.linkedin_url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm">
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>
              </section>

              {/* Role & Status Badges */}
              <section className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Role & Status</h4>
                <div className="flex flex-wrap gap-2">
                  {current.role_type && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      {current.role_type.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                    current.relationship_status === 'warm' ? 'bg-orange-100 text-orange-700' :
                    current.relationship_status === 'engaged' ? 'bg-blue-100 text-blue-700' :
                    current.relationship_status === 'cold' ? 'bg-cyan-100 text-cyan-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {current.relationship_status}
                  </span>
                  {current.seniority_level && current.seniority_level !== 'unknown' && (
                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                      {current.seniority_level.replace(/_/g, ' ')}
                    </span>
                  )}
                  {current.department_tag && (
                    <span className="px-2 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-full">
                      {current.department_tag}
                    </span>
                  )}
                </div>
                {/* Tags */}
                {current.prospect_tags && (
                  <div className="mt-2">
                    <TagList tagsJson={current.prospect_tags} />
                  </div>
                )}
              </section>

              {/* Quick Actions */}
              <section>
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowLogCall(true)}
                    className="w-full px-3 py-2 text-sm font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition-colors text-left"
                  >
                    Log Call
                  </button>
                  {current.email && (
                    <a
                      href={`mailto:${current.email}`}
                      className="block w-full px-3 py-2 text-sm font-medium text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors text-left"
                    >
                      Write Email
                    </a>
                  )}
                  <button
                    onClick={() => window.open(`/accounts/${current.account_id}?tab=prospects`, '_blank')}
                    className="w-full px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    View Account
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-gray-50 rounded-b-xl">
          <div className="text-sm text-gray-500">
            {items.filter(i => i.completed).length}/{items.length} completed
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors">
              Close
            </button>
            <button onClick={handleSaveAndNext}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              Save & Next
            </button>
          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
