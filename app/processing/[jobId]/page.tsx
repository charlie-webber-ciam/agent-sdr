'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { useToast } from '@/lib/toast-context';
import { humanizeError } from '@/lib/error-messages';

interface JobEvent {
  id: number;
  job_id: number;
  event_type: string;
  account_id: number | null;
  company_name: string | null;
  message: string;
  step_index: number | null;
  total_steps: number | null;
  created_at: string;
}

// Utility to format domain display
const formatDomain = (domain: string | null) => {
  if (!domain || domain.includes('.placeholder')) {
    return 'No domain';
  }
  return domain;
};

interface JobData {
  job: {
    id: number;
    filename: string;
    status: string;
    totalAccounts: number;
    processedCount: number;
    failedCount: number;
    progressPercent: number;
    paused: number; // SQLite boolean (0/1)
    createdAt: string;
    completedAt: string | null;
  };
  currentAccount: {
    id: number;
    companyName: string;
    domain: string;
  } | null;
  accounts: Array<{
    id: number;
    companyName: string;
    domain: string;
    industry: string;
    status: string;
    errorMessage: string | null;
    processedAt: string | null;
    auth0AccountOwner: string | null;
  }>;
}

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isOrphaned, setIsOrphaned] = useState(false);
  const [retryingAccountId, setRetryingAccountId] = useState<number | null>(null);

  // SSE live event state
  const [liveEvents, setLiveEvents] = useState<JobEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [subProgress, setSubProgress] = useState(0); // fraction 0-1 within current account
  const liveEventsEndRef = useRef<HTMLDivElement>(null);

  // SSE-derived completion — updated immediately from stream, before the API round-trip
  const [sseJobDone, setSseJobDone] = useState(false);
  const [sseProcessedCount, setSseProcessedCount] = useState(0);

  // Stable refs — never trigger effect re-runs or cause stale closures
  const seenIds = useRef(new Set<number>());
  const stepCountRef = useRef(0);
  // Always holds the latest fetchJobData so the SSE closure never calls a stale version
  const fetchJobDataRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const checkJobActive = async (jobStatus: string) => {
    if (jobStatus === 'processing') {
      try {
        const res = await fetch(`/api/jobs/${jobId}/active`);
        if (res.ok) {
          const { active } = await res.json();
          setIsOrphaned(!active);
        }
      } catch {
        // If we can't reach the endpoint, don't change orphan state
      }
    } else {
      setIsOrphaned(false);
    }
  };

  const fetchJobData = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch job data');
      }
      const jobData = await res.json();
      setData(jobData);
      setError(null);
      await checkJobActive(jobData.job.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  // Keep the ref pointing at the latest version so SSE closures are never stale
  fetchJobDataRef.current = fetchJobData;

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/process/${jobId}/pause`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to pause job');
      await fetchJobData();
    } catch (err) {
      console.error('Pause error:', err);
      toast.error('Failed to pause job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/process/${jobId}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resume job');
      await fetchJobData();
    } catch (err) {
      console.error('Resume error:', err);
      toast.error('Failed to resume job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this job? This cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/process/${jobId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to cancel job');
      toast.info('Job cancelled');
      await fetchJobData();
    } catch (err) {
      console.error('Cancel error:', err);
      toast.error('Failed to cancel job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartProcessing = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/process/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: Number(jobId) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start processing');
      }
      await fetchJobData();
    } catch (err) {
      console.error('Start processing error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to start processing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job and all its data? This cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/process/${jobId}/delete`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete job');
      router.push('/');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete job');
      setActionLoading(false);
    }
  };

  const handleDeleteFailedAccounts = async () => {
    if (!data) return;
    const failedIds = data.accounts.filter(a => a.status === 'failed').map(a => a.id);
    if (failedIds.length === 0) {
      toast.info('No failed accounts to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${failedIds.length} failed account(s)? This cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/accounts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: failedIds }),
      });
      if (!res.ok) throw new Error('Failed to delete accounts');
      const result = await res.json();
      toast.success(`Deleted ${result.deletedCount} failed account(s).`);
      await fetchJobData();
    } catch (err) {
      console.error('Delete failed accounts error:', err);
      toast.error('Failed to delete accounts');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAllJobAccounts = async () => {
    if (!data) return;
    const allIds = data.accounts.map(a => a.id);
    if (allIds.length === 0) {
      toast.info('No accounts to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ALL ${allIds.length} account(s) from this job? This cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/accounts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: allIds }),
      });
      if (!res.ok) throw new Error('Failed to delete accounts');
      const result = await res.json();
      toast.success(`Deleted ${result.deletedCount} account(s).`);
      await fetchJobData();
    } catch (err) {
      console.error('Delete all accounts error:', err);
      toast.error('Failed to delete accounts');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!data) return;
    const failedIds = data.accounts.filter(a => a.status === 'failed').map(a => a.id);
    if (failedIds.length === 0) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/accounts/retry-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: failedIds }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to retry accounts');
      }
      const result = await res.json();
      toast.success(`Retrying ${result.accountCount} account(s)`);
      router.push(result.redirectUrl);
    } catch (err) {
      console.error('Retry failed accounts error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to retry accounts');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrySingleAccount = async (accountId: number) => {
    setRetryingAccountId(accountId);
    try {
      const res = await fetch('/api/accounts/retry-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: [accountId] }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to retry account');
      }
      const result = await res.json();
      toast.success('Retrying account');
      router.push(result.redirectUrl);
    } catch (err) {
      console.error('Retry single account error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to retry account');
    } finally {
      setRetryingAccountId(null);
    }
  };

  // SSE effect: streams live research step events
  useEffect(() => {
    // Reset refs on mount (handles StrictMode double-mount)
    seenIds.current = new Set();
    stepCountRef.current = 0;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);

    es.onmessage = (e) => {
      let event: any;
      try { event = JSON.parse(e.data); } catch { return; }

      if (event.event_type === 'job_done') {
        // Immediately reflect completion in the UI regardless of API round-trip timing
        setSseJobDone(true);
        es.close();
        fetchJobDataRef.current();
        return;
      }

      // Deduplicate ALL state updates — guards against StrictMode double-mount
      // and EventSource reconnection replays
      if (seenIds.current.has(event.id)) return;
      seenIds.current.add(event.id);

      setLiveEvents(prev => [...prev.slice(-49), event]);

      if (event.event_type === 'account_start') {
        setCurrentStep(event.message);
        // Reset step counter for this new account
        stepCountRef.current = 0;
        setSubProgress(0);
      } else if (event.event_type === 'research_step') {
        // Count total steps across both Auth0 (7) and Okta (8) = 15 combined.
        // Monotonically increasing so parallel interleaving never goes backwards.
        stepCountRef.current++;
        setCurrentStep(event.message);
        setSubProgress(Math.min(0.9, stepCountRef.current / 15));
      } else if (event.event_type === 'categorizing') {
        setCurrentStep(event.message);
        setSubProgress(0.93);
      } else if (event.event_type === 'account_complete') {
        setSubProgress(1);
        setSseProcessedCount(prev => prev + 1);
      } else if (event.event_type === 'job_complete') {
        // job_complete is written to DB after updateJobProgress, so fetch here to
        // guarantee the API returns updated counts (not just on job_done)
        fetchJobDataRef.current();
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect via Last-Event-ID
    };

    return () => es.close();
  }, [jobId]);

  // Scroll event feed to bottom on new events
  useEffect(() => {
    liveEventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveEvents]);

  useEffect(() => {
    const fetchAndCheck = async () => {
      await fetchJobData();
    };

    fetchAndCheck();

    // Auto-refresh every 3 seconds, checking status on each poll
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const jobData = await res.json();
        setData(jobData);

        // Check if a "processing" job actually has a live server loop
        await checkJobActive(jobData.job.status);

        // Stop polling if job is complete
        if (jobData.job.status !== 'processing' && jobData.job.status !== 'pending') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]); // Only depend on jobId, not data state

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error || 'Job not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  const { job, currentAccount, accounts } = data;
  // sseJobDone is the source of truth the moment the stream closes — don't wait for
  // the 3-second API poll or the fetchJobData round-trip to catch up.
  const isComplete = job.status === 'completed' || sseJobDone;
  const isFailed = job.status === 'failed';
  const isPending = job.status === 'pending' && !sseJobDone;
  const isActivelyProcessing = job.status === 'processing' && !sseJobDone;
  const isProcessing = (isActivelyProcessing || isPending) && !sseJobDone;
  const isPaused = job.paused === 1 && !sseJobDone;
  // Use the higher of the API count and the SSE-derived count
  const effectiveProcessedCount = Math.max(job.processedCount, sseProcessedCount);

  const completedAccounts = accounts.filter(a => a.status === 'completed');
  const failedAccounts = accounts.filter(a => a.status === 'failed');
  const pendingAccounts = accounts.filter(a => a.status === 'pending');
  // A pending job with no current account and accounts still pending is likely stuck
  const isStuck = isPending && !currentAccount && pendingAccounts.length > 0 && job.processedCount === 0;
  // An orphaned job shows "processing" in DB but has no server-side loop running
  // (e.g. after a server restart). Also covers paused+orphaned state.
  const needsResume = isOrphaned && isActivelyProcessing && pendingAccounts.length > 0;

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Research Progress</h1>
        <p className="text-gray-600">{job.filename}</p>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-lg p-6 mb-6 ${
          isComplete
            ? 'bg-green-50 border border-green-200'
            : isFailed
            ? 'bg-red-50 border border-red-200'
            : isStuck || needsResume
            ? 'bg-orange-50 border border-orange-200'
            : isPaused
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-blue-50 border border-blue-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-1">
              {isComplete
                ? 'Completed!'
                : isFailed
                ? 'Failed/Cancelled'
                : isStuck
                ? 'Pending'
                : needsResume
                ? 'Stopped'
                : isPaused
                ? 'Paused'
                : 'Processing...'}
            </h2>
            <p className="text-gray-700">
              {isStuck
                ? `${job.totalAccounts} account${job.totalAccounts !== 1 ? 's' : ''} waiting to be processed`
                : needsResume
                ? (
                  <>
                    {effectiveProcessedCount} of {job.totalAccounts} accounts processed
                    {job.failedCount > 0 && ` (${job.failedCount} failed)`}
                    {` — ${pendingAccounts.length} remaining`}
                  </>
                )
                : (
                  <>
                    {effectiveProcessedCount} of {job.totalAccounts} accounts processed
                    {job.failedCount > 0 && ` (${job.failedCount} failed)`}
                  </>
                )}
            </p>
            {isStuck && (
              <p className="text-sm text-orange-700 mt-1">
                Processing did not start automatically. Click &quot;Start Processing&quot; to begin.
              </p>
            )}
            {needsResume && (
              <p className="text-sm text-orange-700 mt-1">
                Processing is no longer running (server may have restarted). Click &quot;Resume Processing&quot; to continue.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {isComplete && (
              <button
                onClick={() => router.push('/accounts')}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                View All Accounts
              </button>
            )}
            {isStuck && (
              <>
                <button
                  onClick={handleStartProcessing}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2 font-medium"
                >
                  {actionLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Starting...
                    </>
                  ) : (
                    'Start Processing'
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                >
                  Delete Job
                </button>
              </>
            )}
            {needsResume && !isStuck && (
              <>
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2 font-medium"
                >
                  {actionLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Resuming...
                    </>
                  ) : (
                    'Resume Processing'
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                >
                  {actionLoading ? 'Cancelling...' : 'Cancel'}
                </button>
              </>
            )}
            {isProcessing && !isStuck && !needsResume && (
              <>
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                  >
                    {actionLoading ? 'Resuming...' : 'Resume'}
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                  >
                    {actionLoading ? 'Pausing...' : 'Pause'}
                  </button>
                )}
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                >
                  {actionLoading ? 'Cancelling...' : 'Cancel'}
                </button>
              </>
            )}
            {(isFailed || isComplete) && (
              <>
                {failedAccounts.length > 0 && (
                  <>
                    <button
                      onClick={handleRetryFailed}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      {actionLoading ? 'Retrying...' : `Retry Failed (${failedAccounts.length})`}
                    </button>
                    <button
                      onClick={handleDeleteFailedAccounts}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2 text-sm"
                    >
                      {actionLoading ? 'Deleting...' : `Delete Failed (${failedAccounts.length})`}
                    </button>
                  </>
                )}
                <button
                  onClick={handleDeleteAllJobAccounts}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:bg-gray-400 transition-colors flex items-center gap-2 text-sm"
                >
                  {actionLoading ? 'Deleting...' : `Delete All Accounts (${accounts.length})`}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                >
                  {actionLoading ? 'Deleting...' : 'Delete Job'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar — smooth sub-step interpolation */}
        {(() => {
          const basePercent = job.totalAccounts > 0 ? effectiveProcessedCount / job.totalAccounts : 0;
          const oneAccountFraction = job.totalAccounts > 0 ? 1 / job.totalAccounts : 0;
          const smoothPercent = isComplete ? 100 : isFailed ? job.progressPercent : Math.min(
            99,
            Math.round((basePercent + oneAccountFraction * subProgress) * 100)
          );
          return (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-700 ${
                    isComplete ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${smoothPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>{smoothPercent}% complete</span>
                <span>
                  {effectiveProcessedCount} / {job.totalAccounts}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Current Account */}
        {isProcessing && currentAccount && (
          <div className="mt-4 p-3 bg-white rounded border border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
              <span className="font-medium">Currently researching:</span>
              <span className="text-gray-700">
                {currentAccount.companyName} ({currentAccount.domain})
              </span>
            </div>
            {currentStep && (
              <p className="mt-1.5 text-sm text-blue-600 pl-6">{currentStep}</p>
            )}
          </div>
        )}
      </div>

      {/* Live Event Feed */}
      {liveEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Live Research Activity</h3>
            <span className="text-xs text-gray-400">{liveEvents.length} events</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {liveEvents.slice(-10).map((evt, i) => {
              const typeColors: Record<string, string> = {
                account_start:    'bg-blue-100 text-blue-700',
                research_step:    'bg-indigo-100 text-indigo-700',
                categorizing:     'bg-purple-100 text-purple-700',
                account_complete: 'bg-green-100 text-green-700',
                account_failed:   'bg-red-100 text-red-700',
              };
              const typeLabels: Record<string, string> = {
                account_start:    'Start',
                research_step:    'Step',
                categorizing:     'Categorize',
                account_complete: 'Done',
                account_failed:   'Failed',
              };
              const colorClass = typeColors[evt.event_type] ?? 'bg-gray-100 text-gray-700';
              const label = typeLabels[evt.event_type] ?? evt.event_type;
              return (
                <div key={evt.id ?? i} className="px-4 py-2 flex items-start gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass} flex-shrink-0 mt-0.5`}>
                    {label}
                  </span>
                  <p className="text-sm text-gray-700 flex-1">{evt.message}</p>
                  {evt.step_index != null && evt.total_steps != null && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {evt.step_index}/{evt.total_steps}
                    </span>
                  )}
                </div>
              );
            })}
            <div ref={liveEventsEndRef} />
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold">Accounts</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {accounts.map((account) => (
            <div key={account.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-lg">{account.companyName}</h4>
                  <p className="text-sm text-gray-600">
                    {formatDomain(account.domain)} • {account.industry}
                  </p>
                  {account.auth0AccountOwner && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {account.auth0AccountOwner}
                    </p>
                  )}
                  {account.errorMessage && (
                    <p className="text-sm text-red-600 mt-1" title={account.errorMessage}>
                      {humanizeError(account.errorMessage)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {account.status === 'completed' && (
                    <>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✓ Completed
                      </span>
                      <button
                        onClick={() => router.push(`/accounts/${account.id}`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        View
                      </button>
                    </>
                  )}
                  {account.status === 'processing' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      Processing...
                    </span>
                  )}
                  {account.status === 'failed' && (
                    <>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        Failed
                      </span>
                      {(isComplete || isFailed) && (
                        <button
                          onClick={() => handleRetrySingleAccount(account.id)}
                          disabled={retryingAccountId === account.id}
                          className="px-3 py-1.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-400 transition-colors text-sm flex items-center gap-1.5"
                          title="Retry this account"
                        >
                          {retryingAccountId === account.id ? (
                            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          Retry
                        </button>
                      )}
                    </>
                  )}
                  {account.status === 'pending' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Go Home
        </button>
        {completedAccounts.length > 0 && (
          <button
            onClick={() => router.push('/accounts')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Completed Accounts ({completedAccounts.length})
          </button>
        )}
      </div>
    </main>
  );
}
