'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface JobEvent {
  id: number;
  job_id: number;
  job_type: string;
  event_type: string;
  account_id: number | null;
  company_name: string | null;
  message: string;
  step_index: number | null;
  total_steps: number | null;
  created_at: string;
}

const EVENT_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  account_start:    { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Start' },
  research_step:    { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Step' },
  categorizing:     { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Categorize' },
  account_complete: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Done' },
  account_failed:   { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Failed' },
  job_complete:     { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Complete' },
};

export default function QuickResearchProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();

  const [events, setEvents] = useState<JobEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('Starting research...');
  const [progressPct, setProgressPct] = useState(0);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('processing');
  const [companyName, setCompanyName] = useState<string>('');
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Stable refs — never trigger effect re-runs
  const seenIds = useRef(new Set<number>());
  const stepCountRef = useRef(0);
  const accountIdRef = useRef<number | null>(null);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  useEffect(() => {
    // Reset refs on mount (handles StrictMode double-mount)
    seenIds.current = new Set();
    stepCountRef.current = 0;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);

    es.onmessage = (e) => {
      let data: any;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      if (data.event_type === 'job_done') {
        setJobStatus(data.status);
        es.close();
        if (data.status === 'completed' && accountIdRef.current) {
          setTimeout(() => {
            router.push(`/accounts/${accountIdRef.current}`);
          }, 1500);
        }
        return;
      }

      // Deduplicate ALL updates by event ID — guards against StrictMode double-mount
      // and EventSource reconnection replays
      if (seenIds.current.has(data.id)) return;
      seenIds.current.add(data.id);

      setEvents(prev => [...prev, data as JobEvent]);

      if (data.event_type === 'account_start') {
        setCurrentStep(data.message);
        setProgressPct(5);
        if (data.account_id) {
          accountIdRef.current = data.account_id;
          setAccountId(data.account_id);
        }
        if (data.company_name) setCompanyName(data.company_name);
      } else if (data.event_type === 'research_step') {
        // Auth0: 7 sequential steps, Okta: 8 steps (6 parallel + 2 sequential) = 15 total
        // Use a simple counter — progress is monotonically increasing regardless of which
        // agent emits the step
        stepCountRef.current++;
        setCurrentStep(data.message);
        setProgressPct(Math.min(89, Math.round(5 + (stepCountRef.current / 15) * 84)));
      } else if (data.event_type === 'categorizing') {
        setCurrentStep(data.message);
        setProgressPct(90);
      } else if (data.event_type === 'account_complete') {
        setCurrentStep('Research complete!');
        setProgressPct(98);
        if (data.account_id) {
          accountIdRef.current = data.account_id;
          setAccountId(data.account_id);
        }
      } else if (data.event_type === 'account_failed') {
        setJobStatus('failed');
        setCurrentStep(data.message);
      } else if (data.event_type === 'job_complete') {
        setProgressPct(100);
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect via Last-Event-ID
    };

    return () => es.close();
  }, [jobId, router]); // accountId intentionally omitted — use accountIdRef instead

  const isComplete = jobStatus === 'completed';
  const isFailed = jobStatus === 'failed';
  const isDone = isComplete || isFailed;

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Researching...</h1>
        {companyName && (
          <p className="text-xl text-gray-600">{companyName}</p>
        )}
      </div>

      {/* Status Card */}
      <div className={`rounded-lg p-6 mb-6 border ${
        isComplete ? 'bg-green-50 border-green-200' :
        isFailed   ? 'bg-red-50 border-red-200' :
                     'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          {!isDone && (
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
          )}
          {isComplete && (
            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {isFailed && (
            <div className="h-5 w-5 rounded-full bg-red-500 flex-shrink-0" />
          )}
          <p className="font-medium text-gray-800">{currentStep}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${
              isComplete ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-sm text-gray-500">{progressPct}% complete</div>

        {isComplete && accountId && (
          <div className="mt-4">
            <p className="text-green-700 font-medium mb-2">Research complete! Redirecting to account...</p>
            <button
              onClick={() => router.push(`/accounts/${accountId}`)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              View Account Now
            </button>
          </div>
        )}
        {isFailed && (
          <div className="mt-4">
            <p className="text-red-700 font-medium mb-2">Research failed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/quick-research')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                Try Again
              </button>
              {accountId && (
                <button
                  onClick={() => router.push(`/accounts/${accountId}`)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
                >
                  View Partial Results
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Event Feed */}
      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700">Research Steps</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {events.map((evt) => {
              const style = EVENT_TYPE_STYLES[evt.event_type] ?? { bg: 'bg-gray-100', text: 'text-gray-700', label: evt.event_type };
              return (
                <div key={evt.id} className="px-4 py-2.5 flex items-start gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text} flex-shrink-0 mt-0.5`}>
                    {style.label}
                  </span>
                  <p className="text-sm text-gray-700 flex-1">{evt.message}</p>
                  {evt.step_index && evt.total_steps && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {evt.step_index}/{evt.total_steps}
                    </span>
                  )}
                </div>
              );
            })}
            <div ref={eventsEndRef} />
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => router.push('/quick-research')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
        >
          New Research
        </button>
        <button
          onClick={() => router.push('/accounts')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
        >
          Browse Accounts
        </button>
      </div>
    </main>
  );
}
