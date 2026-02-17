'use client';

import { useState, useRef, useEffect } from 'react';

interface SectionRerunModalProps {
  sectionKey: string;
  sectionLabel: string;
  perspective: 'auth0' | 'okta';
  allSectionKeys: string[];
  onRerun: (sections: string[], additionalContext: string) => Promise<void>;
  isRunning: boolean;
}

export default function SectionRerunModal({
  sectionKey,
  sectionLabel,
  perspective,
  allSectionKeys,
  onRerun,
  isRunning,
}: SectionRerunModalProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRerunSection = async () => {
    await onRerun([sectionKey], additionalContext);
    setShowPopover(false);
    setAdditionalContext('');
  };

  const handleRerunAll = async () => {
    await onRerun(allSectionKeys, additionalContext);
    setShowPopover(false);
    setAdditionalContext('');
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setShowPopover(!showPopover)}
        disabled={isRunning}
        className="p-1 text-gray-400 hover:text-blue-600 transition-colors rounded hover:bg-blue-50 disabled:opacity-50"
        title={`Re-run ${sectionLabel}`}
      >
        {isRunning ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
      </button>

      {showPopover && !isRunning && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Re-run: {sectionLabel}
          </h4>
          <p className="text-xs text-gray-500 mb-2">
            {perspective === 'auth0' ? 'Auth0 CIAM' : 'Okta Workforce'} perspective
          </p>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Additional context for the research... (optional)"
            rows={3}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 mb-2"
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={handleRerunSection}
              className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              Re-run this section
            </button>
            <button
              onClick={handleRerunAll}
              className="w-full px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
            >
              Re-run all sections
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
