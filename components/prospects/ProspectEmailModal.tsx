'use client';

import { useState } from 'react';
import type { Prospect } from './ProspectTab';

interface Props {
  prospect: Prospect;
  accountId: number;
  researchContext: 'auth0' | 'okta';
  onClose: () => void;
}

interface EmailResult {
  subject: string;
  body: string;
  reasoning: string;
  keyInsights: string[];
}

export default function ProspectEmailModal({ prospect, accountId, researchContext, onClose }: Props) {
  const [emailType, setEmailType] = useState<'cold' | 'warm'>('cold');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmailResult | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const recipientName = `${prospect.first_name} ${prospect.last_name}`;
  const recipientPersona = prospect.title || (prospect.role_type ? prospect.role_type.replace(/_/g, ' ') : 'Contact');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/accounts/${accountId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName,
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

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Write Email to {recipientName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{recipientPersona}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  researchContext === 'auth0'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {researchContext === 'auth0' ? 'Auth0 CIAM' : 'Okta Workforce'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Email Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setEmailType('cold')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  emailType === 'cold'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cold
              </button>
              <button
                onClick={() => setEmailType('warm')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  emailType === 'warm'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Warm
              </button>
            </div>
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Instructions <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              placeholder="e.g., Focus on security compliance, mention recent funding"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Custom Context */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Context <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={customContext}
              onChange={e => setCustomContext(e.target.value)}
              placeholder="e.g., Met at AWS Summit last week, discussed their auth challenges"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : result ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Email
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4 border-t border-gray-200 pt-5">
              {/* Copy All */}
              <div className="flex justify-end">
                <button
                  onClick={() => copyToClipboard(`Subject: ${result.subject}\n\n${result.body}`, 'all')}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copiedField === 'all' ? 'Copied!' : 'Copy All'}
                </button>
              </div>

              {/* Subject */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">Subject</label>
                  <button
                    onClick={() => copyToClipboard(result.subject, 'subject')}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {copiedField === 'subject' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-900 font-medium">{result.subject}</p>
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">Body</label>
                  <button
                    onClick={() => copyToClipboard(result.body, 'body')}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {copiedField === 'body' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{result.body}</p>
                </div>
              </div>

              {/* Key Insights */}
              {result.keyInsights.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowInsights(!showInsights)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showInsights ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Key Insights ({result.keyInsights.length})
                  </button>
                  {showInsights && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {result.keyInsights.map((insight, i) => (
                          <li key={i}>{insight}</li>
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
                  <svg className={`w-4 h-4 transition-transform ${showReasoning ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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
      </div>
    </div>
  );
}
