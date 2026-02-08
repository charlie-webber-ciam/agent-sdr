'use client';

import { useState } from 'react';

interface AISuggestions {
  tier: 'A' | 'B' | 'C';
  tierReasoning: string;
  estimatedAnnualRevenue: string;
  revenueReasoning: string;
  estimatedUserVolume: string;
  volumeReasoning: string;
  useCases: string[];
  useCasesReasoning: string;
  auth0Skus: string[];
  skuReasoning: string;
  priorityScore: number;
  priorityReasoning: string;
  confidence: {
    tier: number;
    revenue: number;
    volume: number;
    useCases: number;
    skus: number;
  };
}

interface AIAutoCategorizePanelProps {
  accountId: number;
  onAccept: (suggestions: Partial<AISuggestions>) => void;
  onClose: () => void;
}

export default function AIAutoCategorizePanel({
  accountId,
  onAccept,
  onClose,
}: AIAutoCategorizePanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestions | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/accounts/${accountId}/auto-categorize`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to generate suggestions');
      }

      const data = await res.json();
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAll = () => {
    if (suggestions) {
      onAccept({
        tier: suggestions.tier,
        estimatedAnnualRevenue: suggestions.estimatedAnnualRevenue,
        estimatedUserVolume: suggestions.estimatedUserVolume,
        useCases: suggestions.useCases,
        auth0Skus: suggestions.auth0Skus,
        priorityScore: suggestions.priorityScore,
      });
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">AI Auto-Categorize</h3>
            <p className="text-sm text-gray-600">Let AI analyze research and suggest categorization</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!suggestions && !loading && (
        <button
          onClick={handleGenerate}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Generate AI Suggestions
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Analyzing account data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-semibold">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {suggestions && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">Tier</span>
                <span className={`text-xs font-medium ${getConfidenceColor(suggestions.confidence.tier)}`}>
                  {(suggestions.confidence.tier * 100).toFixed(0)}% confidence
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">Tier {suggestions.tier}</div>
              <p className="text-xs text-gray-600">{suggestions.tierReasoning}</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">Priority</span>
                <span className={`text-xs font-medium text-gray-600`}>
                  Score: {suggestions.priorityScore}/10
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{suggestions.priorityScore}</div>
              <p className="text-xs text-gray-600">{suggestions.priorityReasoning}</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">Revenue</span>
                <span className={`text-xs font-medium ${getConfidenceColor(suggestions.confidence.revenue)}`}>
                  {(suggestions.confidence.revenue * 100).toFixed(0)}% confidence
                </span>
              </div>
              <div className="text-lg font-bold text-gray-900 mb-1">{suggestions.estimatedAnnualRevenue}</div>
              <p className="text-xs text-gray-600">{suggestions.revenueReasoning}</p>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700">User Volume</span>
                <span className={`text-xs font-medium ${getConfidenceColor(suggestions.confidence.volume)}`}>
                  {(suggestions.confidence.volume * 100).toFixed(0)}% confidence
                </span>
              </div>
              <div className="text-lg font-bold text-gray-900 mb-1">{suggestions.estimatedUserVolume}</div>
              <p className="text-xs text-gray-600">{suggestions.volumeReasoning}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-700">Use Cases</span>
              <span className={`text-xs font-medium ${getConfidenceColor(suggestions.confidence.useCases)}`}>
                {(suggestions.confidence.useCases * 100).toFixed(0)}% confidence
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {suggestions.useCases.map(uc => (
                <span key={uc} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {uc}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-600">{suggestions.useCasesReasoning}</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-700">Recommended Auth0 SKUs</span>
              <span className={`text-xs font-medium ${getConfidenceColor(suggestions.confidence.skus)}`}>
                {(suggestions.confidence.skus * 100).toFixed(0)}% confidence
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {suggestions.auth0Skus.map(sku => (
                <span key={sku} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm font-semibold">
                  {sku}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-600">{suggestions.skuReasoning}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAcceptAll}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Accept All Suggestions
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
