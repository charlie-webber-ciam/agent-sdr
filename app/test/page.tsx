'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheck[];
}

export default function TestPage() {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    companyName: string;
    headline_summary: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Failed to reach health endpoint');
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      setError('Please enter a company name');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to research company');
      }

      setResult({
        companyName: data.companyName,
        headline_summary: data.result.headline_summary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: 'pass' | 'fail' | 'warn') => {
    switch (status) {
      case 'pass': return <span className="text-green-600 font-bold">PASS</span>;
      case 'fail': return <span className="text-red-600 font-bold">FAIL</span>;
      case 'warn': return <span className="text-yellow-600 font-bold">WARN</span>;
    }
  };

  return (
    <>
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Environment Setup Check */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">Environment Setup Check</h1>
              <p className="text-gray-600">
                Validates that all required env vars, database, and dependencies are configured correctly
              </p>
            </div>
            <button
              onClick={fetchHealth}
              disabled={healthLoading}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {healthLoading ? 'Checking...' : 'Re-check'}
            </button>
          </div>

          {healthError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 font-medium">Could not reach health endpoint</p>
              <p className="text-red-600 text-sm">{healthError}</p>
            </div>
          )}

          {health && (
            <div className={`border rounded-lg overflow-hidden ${
              health.status === 'healthy'
                ? 'border-green-200'
                : health.status === 'degraded'
                ? 'border-yellow-200'
                : 'border-red-200'
            }`}>
              <div className={`px-5 py-3 flex items-center justify-between ${
                health.status === 'healthy'
                  ? 'bg-green-50'
                  : health.status === 'degraded'
                  ? 'bg-yellow-50'
                  : 'bg-red-50'
              }`}>
                <span className="font-semibold text-gray-900">
                  {health.status === 'healthy'
                    ? 'All checks passed'
                    : health.status === 'degraded'
                    ? 'Some warnings'
                    : 'Setup issues detected'}
                </span>
                <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                  health.status === 'healthy'
                    ? 'bg-green-100 text-green-800'
                    : health.status === 'degraded'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {health.status.toUpperCase()}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {health.checks.map((check, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-4 bg-white">
                    <div className="w-12 pt-0.5 shrink-0 text-xs font-mono">
                      {statusIcon(check.status)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{check.name}</p>
                      <p className="text-gray-600 text-sm">{check.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {healthLoading && !health && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
              <p className="text-gray-600">Running environment checks...</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <hr className="mb-10 border-gray-200" />

        {/* Agent Tester */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Agent Tester</h2>
          <p className="text-gray-600">
            Quick test of the research agent with a single company lookup
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name (e.g., Stripe, Airbnb)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Researching...' : 'Test Research'}
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">{result.companyName}</h2>
            <div className="prose max-w-none">
              <p className="text-gray-700 leading-relaxed">
                {result.headline_summary}
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <p className="text-blue-800">Researching company...</p>
            </div>
            <p className="text-blue-600 text-sm mt-2">
              This should take about 10-20 seconds
            </p>
          </div>
        )}
      </div>
    </>
  );
}
