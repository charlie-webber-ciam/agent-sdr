'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  accountId: number;
  researchContext: 'auth0' | 'okta';
  onClose: () => void;
  onComplete: () => void;
}

interface WorkingJob {
  id: number;
  status: string;
  current_step: string | null;
  prospects_found: number;
  prospects_created: number;
  prospects_skipped: number;
  emails_generated: number;
  emails_failed: number;
  error_log: string | null;
}

export default function AccountWorkingModal({ accountId, researchContext, onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<'config' | 'progress' | 'complete'>('config');
  const [userContext, setUserContext] = useState('');
  const [perspective, setPerspective] = useState<'auth0' | 'okta'>(researchContext);
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<WorkingJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/working-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_context: userContext || undefined,
          research_context: perspective,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start job');
      }
      const data = await res.json();
      setJobId(data.jobId);
      setPhase('progress');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (phase !== 'progress' || !jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/accounts/${accountId}/working-jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setJob(data.job);

        if (data.job.status === 'completed' || data.job.status === 'failed') {
          setPhase('complete');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // ignore poll errors
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, jobId, accountId]);

  const totalEmails = job ? job.prospects_created : 0;
  const emailProgress = job ? job.emails_generated + job.emails_failed : 0;
  const emailPercent = totalEmails > 0 ? Math.round((emailProgress / totalEmails) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Map Prospects & Generate Emails</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Config Phase */}
          {phase === 'config' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Context / Special Instructions (optional)
                </label>
                <textarea
                  value={userContext}
                  onChange={e => setUserContext(e.target.value)}
                  rows={3}
                  placeholder="E.g., Focus on security team leads, they recently had a breach, looking for champions in engineering..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perspective</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPerspective('auth0')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      perspective === 'auth0'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Auth0 CIAM
                  </button>
                  <button
                    onClick={() => setPerspective('okta')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      perspective === 'okta'
                        ? 'bg-purple-50 border-purple-300 text-purple-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Okta WIC
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
              )}

              <button
                onClick={handleStart}
                disabled={starting}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {starting ? 'Starting...' : 'Start Mapping'}
              </button>
            </div>
          )}

          {/* Progress Phase */}
          {phase === 'progress' && job && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                <span className="text-sm font-medium text-gray-700">
                  {job.status === 'mapping' ? 'Mapping prospects...' : 'Generating emails...'}
                </span>
              </div>

              {job.current_step && (
                <p className="text-sm text-gray-500">{job.current_step}</p>
              )}

              {job.status === 'generating' && totalEmails > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Emails: {emailProgress} / {totalEmails}</span>
                    <span>{emailPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${emailPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-semibold text-gray-900">{job.prospects_found}</div>
                  <div className="text-xs text-gray-500">Found</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-lg font-semibold text-green-700">{job.prospects_created}</div>
                  <div className="text-xs text-gray-500">Created</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2">
                  <div className="text-lg font-semibold text-yellow-700">{job.prospects_skipped}</div>
                  <div className="text-xs text-gray-500">Skipped</div>
                </div>
              </div>
            </div>
          )}

          {phase === 'progress' && !job && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {/* Complete Phase */}
          {phase === 'complete' && job && (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 ${job.status === 'failed' ? 'text-red-600' : job.prospects_created === 0 && job.prospects_found === 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {job.status === 'failed' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : job.prospects_created === 0 && job.prospects_found === 0 ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="text-sm font-medium">
                  {job.status === 'failed' ? 'Job Failed' : job.prospects_created === 0 && job.prospects_found === 0 ? 'No Prospects Found' : 'Complete'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-semibold text-green-700">{job.prospects_created}</div>
                  <div className="text-xs text-gray-500">Prospects Created</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-2xl font-semibold text-blue-700">{job.emails_generated}</div>
                  <div className="text-xs text-gray-500">Emails Generated</div>
                </div>
              </div>

              {job.prospects_skipped > 0 && (
                <p className="text-xs text-gray-500 text-center">
                  {job.prospects_skipped} existing prospects were skipped
                </p>
              )}

              {job.emails_failed > 0 && (
                <p className="text-xs text-red-500 text-center">
                  {job.emails_failed} emails failed to generate
                </p>
              )}

              {job.error_log && (
                job.prospects_created === 0 && job.prospects_found === 0 ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {job.error_log}
                  </div>
                ) : (
                  <details className="text-xs">
                    <summary className="text-gray-500 cursor-pointer hover:text-gray-700">View errors</summary>
                    <pre className="mt-1 p-2 bg-gray-50 rounded text-red-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {job.error_log}
                    </pre>
                  </details>
                )
              )}

              <button
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Results
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
