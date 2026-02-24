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

  useEffect(() => {
    fetch(`/api/accounts/${accountId}/activities`)
      .then(res => res.json())
      .then(data => {
        setActivities(data.activities || []);
      })
      .catch(err => {
        console.error('Failed to fetch activities:', err);
      })
      .finally(() => setLoading(false));
  }, [accountId]);

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
        </h3>
      </div>

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
