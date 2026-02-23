'use client';

import { useState } from 'react';
import { PERSONA_OPTIONS } from '@/lib/writer-options';
import { CopyButton } from '@/components/CopyButton';
import { ResearchContextToggle } from '@/components/ResearchContextToggle';
import { GenerateButton } from '@/components/GenerateButton';
import { useWriterState } from '@/lib/hooks/useWriterState';
import { downloadFile } from '@/lib/utils';

interface SequenceWriterProps {
  accountId: number;
  account?: any;
}

interface SequenceTouch {
  touchNumber: number;
  channel: 'email' | 'linkedin';
  subject?: string;
  body: string;
  angle: string;
  dayDelay: number;
}

interface SequenceResult {
  touches: SequenceTouch[];
  strategy: string;
}

export default function SequenceWriter({ accountId, account }: SequenceWriterProps) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientPersona, setRecipientPersona] = useState('CTO');
  const [researchContext, setResearchContext] = useState<'auth0' | 'okta'>('auth0');
  const [sequenceLength, setSequenceLength] = useState(5);
  const [customInstructions, setCustomInstructions] = useState('');
  const [expandedTouch, setExpandedTouch] = useState<number | null>(null);
  const [regeneratingTouch, setRegeneratingTouch] = useState<number | null>(null);

  const { loading, error, result, setResult, generate } = useWriterState<SequenceResult>({
    accountId,
    account,
    endpoint: 'generate-sequence',
    researchContext,
    primaryFieldValid: recipientName.trim() !== '',
    primaryFieldError: 'Please enter a recipient name',
    buildPayload: () => ({
      recipientName: recipientName.trim(),
      recipientPersona,
      researchContext,
      sequenceLength,
      customInstructions: customInstructions.trim() || undefined,
    }),
    getResult: (data) => data.sequence,
    onSuccess: () => { setExpandedTouch(0); },
  });

  const handleRegenerateTouch = async (touchIndex: number) => {
    if (!result || !recipientName.trim()) return;

    setRegeneratingTouch(touchIndex);
    try {
      const response = await fetch(`/api/accounts/${accountId}/generate-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientPersona,
          researchContext,
          sequenceLength: 1,
          customInstructions: `Generate ONLY touch ${touchIndex + 1} (${result.touches[touchIndex].angle} angle, ${result.touches[touchIndex].channel} channel). Day delay: ${result.touches[touchIndex].dayDelay}. ${customInstructions}`.trim(),
        }),
      });

      const data = await response.json();
      if (data.success && data.sequence.touches.length > 0) {
        const newTouch = data.sequence.touches[0];
        setResult((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, touches: [...prev.touches] };
          updated.touches[touchIndex] = {
            ...newTouch,
            touchNumber: touchIndex + 1,
            dayDelay: prev.touches[touchIndex].dayDelay,
          };
          return updated;
        });
      }
    } catch {
      // Silently fail for individual touch regen
    } finally {
      setRegeneratingTouch(null);
    }
  };

  const formatAllTouches = () => {
    if (!result) return '';
    return result.touches
      .map((t) => {
        const header = `--- Touch ${t.touchNumber} | Day ${t.dayDelay} | ${t.channel.toUpperCase()} | ${t.angle} ---`;
        const subject = t.subject ? `Subject: ${t.subject}\n` : '';
        return `${header}\n${subject}${t.body}`;
      })
      .join('\n\n');
  };

  const formatTouch = (touch: SequenceTouch) => {
    const subject = touch.subject ? `Subject: ${touch.subject}\n\n` : '';
    return `${subject}${touch.body}`;
  };

  const handleExport = () => {
    if (!result) return;
    const formatted = `# Outreach Sequence for ${recipientName}\n## ${account?.companyName || 'Account'}\n## Strategy: ${result.strategy}\n\n` +
      result.touches
        .map((t) => {
          const header = `### Touch ${t.touchNumber} — Day ${t.dayDelay} — ${t.channel.toUpperCase()}\n**Angle:** ${t.angle}`;
          const subject = t.subject ? `\n**Subject:** ${t.subject}` : '';
          return `${header}${subject}\n\n${t.body}`;
        })
        .join('\n\n---\n\n');

    const blob = new Blob([formatted], { type: 'text/markdown' });
    downloadFile(blob, `sequence-${account?.companyName?.replace(/\s+/g, '-').toLowerCase() || accountId}-${recipientName.replace(/\s+/g, '-').toLowerCase()}.md`);
  };

  const getChannelIcon = (channel: 'email' | 'linkedin') => {
    if (channel === 'linkedin') {
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sequence Builder</h2>
            <p className="text-sm text-gray-600">
              Generate a multi-touch outreach sequence
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Config Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name *</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g., Sarah Johnson"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Persona *</label>
            <input
              type="text"
              list="sequence-persona-options"
              value={recipientPersona}
              onChange={(e) => setRecipientPersona(e.target.value)}
              placeholder="e.g., CTO, VP Engineering, or type custom..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <datalist id="sequence-persona-options">
              {PERSONA_OPTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-500">
              Select from suggestions or type a custom title
            </p>
          </div>

          {/* Research Context */}
          <ResearchContextToggle
            value={researchContext}
            onChange={setResearchContext}
            account={account}
          />

          {/* Sequence Length */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Touches: {sequenceLength}
            </label>
            <input
              type="range"
              min={3}
              max={5}
              value={sequenceLength}
              onChange={(e) => setSequenceLength(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Instructions (Optional)</label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g., Focus on their upcoming migration, mention the conference"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Generate Button */}
        <GenerateButton
          onClick={generate}
          loading={loading}
          disabled={!recipientName.trim()}
          loadingLabel="Generating Sequence..."
          label={`Generate ${sequenceLength}-Touch Sequence`}
          gradient="from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
        />

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 border-t border-gray-200 pt-6">
            {/* Strategy */}
            {result.strategy && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800 mb-1">Sequence Strategy</p>
                <p className="text-sm text-blue-700">{result.strategy}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <CopyButton
                text={formatAllTouches()}
                label="Copy All"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
              />
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
              <button
                onClick={generate}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate All
              </button>
            </div>

            {/* Touches Accordion */}
            <div className="space-y-2">
              {result.touches.map((touch, i) => (
                <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Touch Header */}
                  <button
                    onClick={() => setExpandedTouch(expandedTouch === i ? null : i)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        touch.channel === 'linkedin' ? 'bg-blue-700' : 'bg-gray-600'
                      }`}>
                        {touch.touchNumber}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          touch.channel === 'linkedin'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {getChannelIcon(touch.channel)}
                          {touch.channel === 'linkedin' ? 'LinkedIn' : 'Email'}
                        </span>
                        <span className="text-sm text-gray-500">Day {touch.dayDelay}</span>
                        <span className="text-sm text-gray-400">|</span>
                        <span className="text-sm text-gray-600 font-medium">{touch.angle}</span>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${expandedTouch === i ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Touch Content */}
                  {expandedTouch === i && (
                    <div className="px-4 py-4 border-t border-gray-200">
                      {touch.subject && (
                        <div className="mb-3">
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">SUBJECT</label>
                          <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded">{touch.subject}</p>
                        </div>
                      )}
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">
                          {touch.channel === 'linkedin' ? 'MESSAGE' : 'BODY'}
                        </label>
                        <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 px-3 py-2 rounded">
                          {touch.body}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <CopyButton
                          text={formatTouch(touch)}
                          label="Copy"
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 transition-colors flex items-center gap-1"
                        />
                        <button
                          onClick={() => handleRegenerateTouch(i)}
                          disabled={regeneratingTouch === i}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          {regeneratingTouch === i ? 'Regenerating...' : 'Regenerate'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
