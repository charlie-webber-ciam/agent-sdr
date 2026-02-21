'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickResearchPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [model, setModel] = useState('gpt-5.2');
  const [isResearching, setIsResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableModels = [
    'gpt-5.2',
    'claude-4-6-opus',
    'claude-4-5-sonnet',
    'gpt-5-nano',
    'gemini-3-flash-preview',
    'llama-4-maverick-17b',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }

    if (!industry.trim()) {
      setError('Industry is required');
      return;
    }

    setIsResearching(true);

    try {
      const response = await fetch('/api/quick-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          domain: domain.trim() || null,
          industry: industry.trim(),
          model,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start research');
      }

      const data = await response.json();

      // Redirect to the live progress page
      router.push(`/quick-research/progress/${data.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start research');
      setIsResearching(false);
    }
  };

  const commonIndustries = [
    'Technology',
    'Financial Services',
    'Healthcare',
    'E-commerce',
    'SaaS',
    'Gaming',
    'Media & Entertainment',
    'Education',
    'Manufacturing',
    'Retail',
    'Travel & Hospitality',
    'Telecommunications',
    'Energy',
    'Real Estate',
    'Professional Services',
    'Non-Profit',
    'Government',
    'Other',
  ];

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Quick Research</h1>
        <p className="text-gray-600">
          Research a single account instantly without uploading a CSV
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700 mb-2">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Corporation"
              disabled={isResearching}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              required
            />
          </div>

          {/* Domain */}
          <div>
            <label htmlFor="domain" className="block text-sm font-semibold text-gray-700 mb-2">
              Domain <span className="text-gray-500 text-xs font-normal">(Optional)</span>
            </label>
            <input
              id="domain"
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g., acme.com"
              disabled={isResearching}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              If not provided, research will rely on company name only
            </p>
          </div>

          {/* Industry */}
          <div>
            <label htmlFor="industry" className="block text-sm font-semibold text-gray-700 mb-2">
              Industry <span className="text-red-500">*</span>
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={isResearching}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              required
            >
              <option value="">Select an industry...</option>
              {commonIndustries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label htmlFor="model" className="block text-sm font-semibold text-gray-700 mb-2">
              Research Model
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isResearching}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the AI model to use for research
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">What happens next?</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>AI agent will conduct deep research (6 queries)</li>
                  <li>Takes approximately 45-75 seconds</li>
                  <li>Account will be automatically categorized</li>
                  <li>Results saved to your account database</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/accounts')}
              disabled={isResearching}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResearching}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isResearching ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Researching...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Start Research
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Quick Tips */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">💡 Quick Tips</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span><strong>Domain is optional:</strong> Research works with just company name, but providing a domain improves accuracy</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span><strong>Industry matters:</strong> Select the most relevant industry for better categorization</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span><strong>For bulk research:</strong> Use the CSV upload feature to process multiple accounts at once</span>
          </li>
        </ul>
      </div>
    </main>
  );
}
