'use client';

import { useState } from 'react';

interface EmailWriterProps {
  accountId: number;
  account?: any; // Account data to check research availability
}

interface EmailResult {
  subject: string;
  body: string;
  reasoning: string;
  keyInsights: string[];
}

const PERSONA_OPTIONS = [
  'CTO',
  'VP Engineering',
  'CISO',
  'VP Product',
  'VP Security',
  'Head of Engineering',
  'Director of Security',
  'CEO',
  'Founder',
];

export default function EmailWriter({ accountId, account }: EmailWriterProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPersona, setRecipientPersona] = useState('CTO');
  const [emailType, setEmailType] = useState<'cold' | 'warm'>('cold');
  const [researchContext, setResearchContext] = useState<'auth0' | 'okta'>('auth0');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmailResult | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const handleGenerate = async () => {
    if (!recipientName.trim()) {
      setError('Please enter a recipient name');
      return;
    }

    // Check if research context is available
    if (account) {
      if (researchContext === 'auth0' && !account.processedAt) {
        setError('Auth0 research not available for this account. Please select Okta or run Auth0 research first.');
        return;
      }
      if (researchContext === 'okta' && !account.oktaProcessedAt) {
        setError('Okta research not available for this account. Please select Auth0 or run Okta research first.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/accounts/${accountId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientPersona,
          emailType,
          researchContext,
          customInstructions: customInstructions.trim() || undefined,
          customContext: customContext.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate email');
      }

      setResult(data.email);
      setShowInsights(false);
      setShowReasoning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySubject = () => {
    if (result) {
      navigator.clipboard.writeText(result.subject);
    }
  };

  const handleCopyBody = () => {
    if (result) {
      navigator.clipboard.writeText(result.body);
    }
  };

  const handleCopyAll = () => {
    if (result) {
      const fullEmail = `Subject: ${result.subject}\n\n${result.body}`;
      navigator.clipboard.writeText(fullEmail);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Email Writer</h2>
            <p className="text-sm text-gray-600">
              Generate personalized cold emails using Josh Braun strategies
              {researchContext === 'auth0' && (
                <span className="ml-1 text-blue-600 font-medium"> • Using Auth0 CIAM context</span>
              )}
              {researchContext === 'okta' && (
                <span className="ml-1 text-purple-600 font-medium"> • Using Okta Workforce context</span>
              )}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Input Form */}
          <div className="space-y-4">
            {/* Recipient Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Name *
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g., Sarah Johnson"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Recipient Persona */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Persona *
              </label>
              <input
                type="text"
                list="persona-options"
                value={recipientPersona}
                onChange={(e) => setRecipientPersona(e.target.value)}
                placeholder="e.g., CTO, VP Engineering, or type custom..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <datalist id="persona-options">
                {PERSONA_OPTIONS.map((persona) => (
                  <option key={persona} value={persona} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-gray-500">
                Select from suggestions or type a custom title
              </p>
            </div>

            {/* Email Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Type *
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEmailType('cold')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    emailType === 'cold'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cold
                </button>
                <button
                  onClick={() => setEmailType('warm')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    emailType === 'warm'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Warm
                </button>
              </div>
            </div>

            {/* Research Context Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Research Context *
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setResearchContext('auth0')}
                  disabled={account && !account.processedAt}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    researchContext === 'auth0'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    Auth0 CIAM
                    {account && !account.processedAt && (
                      <span className="text-xs">⚠️</span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setResearchContext('okta')}
                  disabled={account && !account.oktaProcessedAt}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    researchContext === 'okta'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    Okta Workforce
                    {account && !account.oktaProcessedAt && (
                      <span className="text-xs">⚠️</span>
                    )}
                  </div>
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Choose which research perspective to use for email generation. Disabled options indicate missing research data.
              </p>
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Instructions (Optional)
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., Focus on security compliance, mention recent funding"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Custom Context */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Context (Optional)
              </label>
              <textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="e.g., Met at AWS Summit last week, discussed their auth challenges"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !recipientName.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating Email...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Generate Email
              </>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-4 border-t border-gray-200 pt-6">
              {/* Context Badge */}
              <div className="flex justify-center mb-4">
                <span
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    researchContext === 'auth0'
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                      : 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                  }`}
                >
                  Generated using {researchContext === 'auth0' ? 'Auth0 CIAM' : 'Okta Workforce'} research
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCopyAll}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy All
                </button>
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Regenerate
                </button>
              </div>

              {/* Subject Line */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Subject Line</label>
                  <button
                    onClick={handleCopySubject}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-900 font-medium">{result.subject}</p>
                </div>
              </div>

              {/* Email Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Email Body</label>
                  <button
                    onClick={handleCopyBody}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{result.body}</p>
                </div>
              </div>

              {/* Key Insights */}
              {result.keyInsights.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowInsights(!showInsights)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showInsights ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    Key Insights Used ({result.keyInsights.length})
                  </button>
                  {showInsights && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {result.keyInsights.map((insight, index) => (
                          <li key={index}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Reasoning */}
              <div>
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showReasoning ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  Why This Approach
                </button>
                {showReasoning && (
                  <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm text-gray-700">{result.reasoning}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
