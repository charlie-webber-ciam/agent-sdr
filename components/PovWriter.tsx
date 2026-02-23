'use client';

import { useState } from 'react';
import { TITLE_OPTIONS } from '@/lib/writer-options';
import { CopyButton } from '@/components/CopyButton';
import { ResearchContextToggle } from '@/components/ResearchContextToggle';
import { GenerateButton } from '@/components/GenerateButton';
import { useWriterState } from '@/lib/hooks/useWriterState';

interface PovWriterProps {
  accountId: number;
  account?: any;
}

interface PovSection {
  heading: string;
  content: string;
}

interface PovResult {
  outputType: 'email' | 'document';
  subject?: string;
  body?: string;
  title?: string;
  sections?: PovSection[];
  reasoning: string;
  keyInsights: string[];
}

function buildMarkdown(result: PovResult): string {
  if (result.outputType === 'email') {
    return `Subject: ${result.subject}\n\n${result.body}`;
  }
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const lines = [
    `# ${result.title}`,
    '',
    `*Prepared by Charlie Webber, Auth0 SDR | ${date}*`,
    '',
  ];
  for (const section of result.sections ?? []) {
    lines.push(`## ${section.heading}`, '', section.content, '');
  }
  return lines.join('\n');
}

export default function PovWriter({ accountId, account }: PovWriterProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientTitle, setRecipientTitle] = useState('CTO');
  const [outputType, setOutputType] = useState<'email' | 'document'>('document');
  const [researchContext, setResearchContext] = useState<'auth0' | 'okta'>('auth0');
  const [customInstructions, setCustomInstructions] = useState('');

  // UI state
  const [showInsights, setShowInsights] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const { loading, error, result, generate } = useWriterState<PovResult>({
    accountId,
    account,
    endpoint: 'generate-pov',
    researchContext,
    primaryFieldValid: recipientTitle.trim() !== '',
    primaryFieldError: 'Please enter a recipient title',
    buildPayload: () => ({
      recipientName: recipientName.trim() || undefined,
      recipientTitle: recipientTitle.trim(),
      outputType,
      researchContext,
      customInstructions: customInstructions.trim() || undefined,
    }),
    getResult: (data) => data.pov,
    onSuccess: () => { setShowInsights(false); setShowReasoning(false); },
  });

  const downloadMarkdown = () => {
    if (!result) return;
    const md = buildMarkdown(result);
    const companyName = account?.companyName ?? 'company';
    const filename = `pov-${companyName.toLowerCase().replace(/\s+/g, '-')}.md`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">POV Writer</h2>
            <p className="text-sm text-gray-600">
              Generate an executive point of view — email or structured document
              {researchContext === 'auth0' && (
                <span className="ml-1 text-blue-600 font-medium"> • Auth0 context</span>
              )}
              {researchContext === 'okta' && (
                <span className="ml-1 text-purple-600 font-medium"> • Okta context</span>
              )}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-5">

          {/* Output type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Output Type *</label>
            <div className="flex gap-2">
              {(['document', 'email'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOutputType(type)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors capitalize ${
                    outputType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type === 'document' ? 'POV Document' : 'POV Email'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {outputType === 'document'
                ? 'A structured 5-section document covering vision, challenges, fit, partnership approach, and next steps.'
                : 'A concise strategic email (200–300 words) covering the same narrative in a sendable format.'}
            </p>
          </div>

          {/* Recipient name (optional for email) */}
          {outputType === 'email' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Sarah Johnson"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Executive title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Executive Title *</label>
            <input
              type="text"
              list="pov-title-options"
              value={recipientTitle}
              onChange={(e) => setRecipientTitle(e.target.value)}
              placeholder="e.g. CTO, CISO, or type custom..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <datalist id="pov-title-options">
              {TITLE_OPTIONS.map((t) => <option key={t} value={t} />)}
            </datalist>
            <p className="mt-1 text-xs text-gray-500">Used to calibrate the narrative angle and tone.</p>
          </div>

          {/* Research context */}
          <ResearchContextToggle
            value={researchContext}
            onChange={setResearchContext}
            account={account}
          />

          {/* Custom instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Instructions <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Focus on compliance angle, reference their recent Series B, emphasise multi-tenancy challenges"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Generate button */}
          <GenerateButton
            onClick={generate}
            loading={loading}
            disabled={!recipientTitle.trim()}
            loadingLabel="Generating POV..."
            label={`Generate ${outputType === 'document' ? 'POV Document' : 'POV Email'}`}
            gradient="from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
          />

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <p className="font-medium mb-0.5">Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="border-t border-gray-200 pt-6 space-y-5">
              {/* Context badge + actions */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${
                  researchContext === 'auth0'
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-purple-100 text-purple-800 border-purple-300'
                }`}>
                  {researchContext === 'auth0' ? 'Auth0 CIAM' : 'Okta Workforce'} research
                </span>
                <div className="flex items-center gap-2">
                  <CopyButton text={buildMarkdown(result)} label="Copy all" />
                  <button
                    onClick={downloadMarkdown}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download .md
                  </button>
                  <button
                    onClick={generate}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </button>
                </div>
              </div>

              {/* EMAIL output */}
              {result.outputType === 'email' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700">Subject</label>
                      <CopyButton text={result.subject!} />
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{result.subject}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700">Body</label>
                      <CopyButton text={result.body!} />
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-4">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{result.body}</p>
                    </div>
                  </div>
                </>
              )}

              {/* DOCUMENT output */}
              {result.outputType === 'document' && (
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-gray-900">{result.title}</h3>
                  {result.sections?.map((section, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-800">{section.heading}</h4>
                        <CopyButton text={section.content} />
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{section.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Key Insights */}
              {result.keyInsights.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowInsights(!showInsights)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showInsights ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Key Insights Used ({result.keyInsights.length})
                  </button>
                  {showInsights && (
                    <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
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
                  <svg className={`w-4 h-4 transition-transform ${showReasoning ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Why This Angle
                </button>
                {showReasoning && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
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
