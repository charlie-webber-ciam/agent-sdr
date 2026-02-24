'use client';

import { useEffect, useState } from 'react';

interface Activity {
  id: number;
  account_id: number;
  created_date: string | null;
  subject: string;
  comments: string;
  created_at: string;
}

export default function ActivitiesSection({ accountId }: { accountId: number }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);

  useEffect(() => {
    fetch(`/api/accounts/${accountId}/activities`)
      .then(res => res.json())
      .then(data => {
        setActivities(data.activities || []);
        setSummary(data.summary || null);
        setSummaryUpdatedAt(data.summaryUpdatedAt || null);
      })
      .catch(err => {
        console.error('Failed to fetch activities:', err);
      })
      .finally(() => setLoading(false));
  }, [accountId]);

  const handleSummarize = async () => {
    setSummarizing(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/activities/summarize`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Summarization failed');
      }
      const data = await res.json();
      setSummary(data.summary);
      setSummaryUpdatedAt(new Date().toISOString());
      setShowSummary(true);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setSummarizing(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-500 text-sm">Loading activities...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="font-medium">No activities yet</p>
        <p className="text-sm mt-1">Import activities from the <a href="/import-activities" className="text-blue-600 hover:underline">Import Activities</a> page.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with count + summarize button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
        </h3>
        <button
          onClick={handleSummarize}
          disabled={summarizing}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {summarizing ? (
            <>
              <div className="animate-spin w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full" />
              Summarising...
            </>
          ) : summary ? (
            'Regenerate Summary'
          ) : (
            'Generate AI Summary'
          )}
        </button>
      </div>

      {/* Summary error */}
      {summaryError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{summaryError}</p>
        </div>
      )}

      {/* AI Summary section */}
      {summary && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm font-semibold text-blue-800">AI Engagement Summary</span>
              {summaryUpdatedAt && (
                <span className="text-xs text-blue-500">
                  Updated {formatDateTime(summaryUpdatedAt)}
                </span>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-blue-500 transition-transform ${showSummary ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSummary && (
            <div className="px-4 pb-4 border-t border-blue-200">
              <pre className="text-sm text-gray-800 mt-3 whitespace-pre-wrap font-sans leading-relaxed">
                {summary}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Activity list */}
      <div className="space-y-2">
        {activities.map(activity => {
          const isExpanded = expandedIds.has(activity.id);
          const hasComments = activity.comments && activity.comments.trim().length > 0;

          return (
            <div
              key={activity.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => hasComments && toggleExpand(activity.id)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 ${hasComments ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
              >
                <div className="shrink-0 text-xs text-gray-400 mt-0.5 w-20">
                  {formatDate(activity.created_date)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.subject}
                  </p>
                  {hasComments && !isExpanded && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {activity.comments.substring(0, 120)}...
                    </p>
                  )}
                </div>
                {hasComments && (
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {isExpanded && hasComments && (
                <div className="px-4 pb-3 border-t border-gray-100">
                  <pre className="text-xs text-gray-600 mt-3 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
                    {activity.comments}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
