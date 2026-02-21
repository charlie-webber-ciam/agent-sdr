'use client';

import { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import type { HealthCheck, HealthResponse } from '@/app/api/health/route';
import type { TestErrorType } from '@/app/api/test/route';

// ─── Status icon ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'warn' }) {
  if (status === 'pass') {
    return (
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 shrink-0">
        <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === 'fail') {
    return (
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 shrink-0">
        <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 shrink-0">
      <svg className="w-3 h-3 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
      </svg>
    </span>
  );
}

// ─── Error type badge ────────────────────────────────────────────────────────

const ERROR_TYPE_LABELS: Record<TestErrorType, { label: string; color: string }> = {
  auth_error:     { label: 'Auth Error',       color: 'bg-red-100 text-red-700' },
  network_error:  { label: 'Network Error',    color: 'bg-orange-100 text-orange-700' },
  dns_error:      { label: 'DNS Error',        color: 'bg-orange-100 text-orange-700' },
  timeout:        { label: 'Timeout',          color: 'bg-yellow-100 text-yellow-700' },
  rate_limit:     { label: 'Rate Limited',     color: 'bg-yellow-100 text-yellow-700' },
  quota_exceeded: { label: 'Quota Exceeded',   color: 'bg-red-100 text-red-700' },
  model_not_found:{ label: 'Model Not Found',  color: 'bg-purple-100 text-purple-700' },
  server_error:   { label: 'Server Error',     color: 'bg-gray-100 text-gray-700' },
  unknown:        { label: 'Unknown Error',    color: 'bg-gray-100 text-gray-700' },
};

function ErrorTypeBadge({ type }: { type: TestErrorType }) {
  const { label, color } = ERROR_TYPE_LABELS[type] ?? ERROR_TYPE_LABELS.unknown;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

// ─── Check row ───────────────────────────────────────────────────────────────

function CheckRow({ check }: { check: HealthCheck }) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra = (check.status !== 'pass') && (check.fix || check.details);

  return (
    <div className={`px-5 py-3.5 bg-white ${hasExtra ? 'cursor-pointer select-none' : ''}`}
      onClick={() => hasExtra && setExpanded(v => !v)}
    >
      <div className="flex items-start gap-3">
        <StatusIcon status={check.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-gray-900 text-sm">{check.name}</p>
            {hasExtra && (
              <svg
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
          <p className={`text-sm mt-0.5 ${check.status === 'fail' ? 'text-red-600' : check.status === 'warn' ? 'text-yellow-700' : 'text-gray-500'}`}>
            {check.message}
          </p>
        </div>
      </div>

      {hasExtra && expanded && (
        <div className="mt-3 ml-8 space-y-3" onClick={e => e.stopPropagation()}>
          {check.fix && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">How to fix</p>
              <pre className="text-sm text-blue-900 whitespace-pre-wrap font-sans leading-relaxed">{check.fix}</pre>
            </div>
          )}
          {check.details && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Technical detail</p>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono break-all">{check.details}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

interface AgentTestError {
  message: string;
  type: TestErrorType;
  fix: string;
  technicalDetail: string;
  durationMs: number;
}

interface AgentTestResult {
  companyName: string;
  summary: string;
  durationMs: number;
}

export default function TestPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<AgentTestResult | null>(null);
  const [testError, setTestError] = useState<AgentTestError | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  const [copied, setCopied] = useState(false);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/health');
      const data: HealthResponse = await res.json();
      setHealth(data);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Failed to reach health endpoint');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const handleAgentTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setTestLoading(true);
    setTestResult(null);
    setTestError(null);
    setShowTechnical(false);

    try {
      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({
          companyName: data.companyName,
          summary: data.result.headline_summary,
          durationMs: data.durationMs,
        });
      } else {
        setTestError({
          message: data.error ?? 'Unknown error',
          type: data.errorType ?? 'unknown',
          fix: data.fix ?? 'Check your configuration and try again.',
          technicalDetail: data.technicalDetail ?? data.details ?? 'No technical detail available.',
          durationMs: data.durationMs ?? 0,
        });
      }
    } catch (err) {
      // Fetch itself failed (no network at all)
      setTestError({
        message: 'Could not reach the server',
        type: 'network_error',
        fix: 'The browser could not reach the Next.js API server.\n\n1. Make sure the dev server is running (npm run dev)\n2. Check that you are accessing the app at http://localhost:3000',
        technicalDetail: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const copyDebugReport = () => {
    const lines: string[] = [
      '=== Agent SDR System Diagnostics ===',
      `Timestamp: ${health?.timestamp ?? new Date().toISOString()}`,
      `Overall status: ${health?.status ?? 'unknown'}`,
      '',
      '--- System Checks ---',
    ];

    if (health?.checks) {
      for (const c of health.checks) {
        lines.push(`[${c.status.toUpperCase()}] ${c.name}: ${c.message}`);
        if (c.details) lines.push(`  Detail: ${c.details}`);
      }
    } else {
      lines.push('No health data available');
    }

    if (testError) {
      lines.push('', '--- Agent Test Error ---');
      lines.push(`Type: ${testError.type}`);
      lines.push(`Message: ${testError.message}`);
      lines.push(`Technical detail: ${testError.technicalDetail}`);
      lines.push(`Duration: ${testError.durationMs}ms`);
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const overallColor = {
    healthy: 'border-green-200 bg-green-50 text-green-800',
    degraded: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    unhealthy: 'border-red-200 bg-red-50 text-red-800',
  };

  const overallBadge = {
    healthy: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    unhealthy: 'bg-red-100 text-red-800',
  };

  const overallLabel = {
    healthy: 'All checks passed',
    degraded: 'Some warnings',
    unhealthy: 'Setup issues detected',
  };

  return (
    <>
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">System Diagnostics</h1>
          <p className="text-gray-500 text-sm">
            Verify your API keys, database, and agent are all working correctly before getting started.
          </p>
        </div>

        {/* ── Section 1: System checks ── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">System Checks</h2>
            <div className="flex items-center gap-2">
              {health && (
                <span className="text-xs text-gray-400">
                  Last checked {new Date(health.timestamp).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchHealth}
                disabled={healthLoading}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {healthLoading ? 'Checking...' : 'Re-check'}
              </button>
            </div>
          </div>

          {/* Network error fetching health */}
          {healthError && !healthLoading && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">Could not reach the health endpoint</p>
              <p className="text-sm text-red-600 font-mono break-all">{healthError}</p>
              <p className="text-sm text-red-700 mt-2">Make sure the dev server is running: <code className="bg-red-100 px-1 rounded">npm run dev</code></p>
            </div>
          )}

          {/* Loading skeleton */}
          {healthLoading && !health && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 flex items-center gap-3">
              <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full shrink-0" />
              <p className="text-sm text-gray-500">Running checks...</p>
            </div>
          )}

          {/* Results */}
          {health && (
            <div className={`rounded-xl border overflow-hidden ${overallColor[health.status]}`}>
              {/* Header bar */}
              <div className={`px-5 py-3 flex items-center justify-between border-b ${overallColor[health.status]}`}>
                <span className="text-sm font-semibold">{overallLabel[health.status]}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${overallBadge[health.status]}`}>
                  {health.status.toUpperCase()}
                </span>
              </div>

              {/* Check rows */}
              <div className="divide-y divide-gray-100">
                {health.checks.map((check, i) => (
                  <CheckRow key={i} check={check} />
                ))}
              </div>

              {/* Footer hint when there are failures */}
              {health.status !== 'healthy' && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Click any failed or warning row to expand fix instructions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Copy debug report */}
          {health && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={copyDebugReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy debug report
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <hr className="mb-10 border-gray-200" />

        {/* ── Section 2: Live agent test ── */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Live Agent Test</h2>
          <p className="text-sm text-gray-500">
            Runs a real end-to-end research query to confirm the AI agent is working. Enter any company name.
          </p>
        </div>

        <form onSubmit={handleAgentTest} className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Stripe, Airbnb, Shopify"
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              disabled={testLoading}
            />
            <button
              type="submit"
              disabled={testLoading || !companyName.trim()}
              className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {testLoading ? 'Running...' : 'Run Test'}
            </button>
          </div>
        </form>

        {/* Loading state */}
        {testLoading && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full shrink-0" />
              <p className="text-sm font-medium text-blue-800">Researching {companyName}...</p>
            </div>
            <p className="text-xs text-blue-600 ml-7">
              The agent runs a web search and summarises results. This typically takes 10–30 seconds.
            </p>
          </div>
        )}

        {/* Success result */}
        {testResult && !testLoading && (
          <div className="rounded-xl border border-green-200 bg-white overflow-hidden">
            <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon status="pass" />
                <span className="text-sm font-semibold text-green-800">Agent test passed — {testResult.companyName}</span>
              </div>
              <span className="text-xs text-green-600">{(testResult.durationMs / 1000).toFixed(1)}s</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 leading-relaxed">{testResult.summary}</p>
            </div>
          </div>
        )}

        {/* Error result */}
        {testError && !testLoading && (
          <div className="rounded-xl border border-red-200 bg-white overflow-hidden">
            {/* Error header */}
            <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <StatusIcon status="fail" />
                <span className="text-sm font-semibold text-red-800">{testError.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {testError.durationMs > 0 && (
                  <span className="text-xs text-red-400">{(testError.durationMs / 1000).toFixed(1)}s</span>
                )}
                <ErrorTypeBadge type={testError.type} />
              </div>
            </div>

            {/* How to fix */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How to fix</p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{testError.fix}</pre>
            </div>

            {/* Technical detail (collapsible) */}
            <div className="px-5 py-3">
              <button
                onClick={() => setShowTechnical(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showTechnical ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Technical detail
              </button>
              {showTechnical && (
                <pre className="mt-2 text-xs text-gray-500 font-mono whitespace-pre-wrap break-all bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {testError.technicalDetail}
                </pre>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
