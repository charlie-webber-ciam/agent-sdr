'use client';

import { useState, useRef, useEffect } from 'react';

interface ProspectMapToolbarProps {
  onAutoLayout: () => void;
  onAddProspect: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isSaving: boolean;
  isBuildingMap: boolean;
  buildStep: string | null;
  onBuildMap: (userContext?: string) => void;
  onImport: () => void;
}

export default function ProspectMapToolbar({
  onAutoLayout,
  onAddProspect,
  isFullscreen,
  onToggleFullscreen,
  isSaving,
  isBuildingMap,
  buildStep,
  onBuildMap,
  onImport,
}: ProspectMapToolbarProps) {
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [userContext, setUserContext] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!showContextPanel) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowContextPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showContextPanel]);

  const handleRun = () => {
    setShowContextPanel(false);
    onBuildMap(userContext.trim() || undefined);
  };

  const handleSkip = () => {
    setShowContextPanel(false);
    onBuildMap();
  };

  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
      <button
        onClick={onImport}
        className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-sm hover:from-purple-700 hover:to-indigo-700 border border-purple-600 transition-colors"
        title="Import prospects from ZoomInfo paste or Salesforce CSV"
      >
        <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import
      </button>
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => {
            if (!isBuildingMap) setShowContextPanel(prev => !prev);
          }}
          disabled={isBuildingMap}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-colors ${
            isBuildingMap
              ? 'bg-blue-100 text-blue-400 border border-blue-200 cursor-not-allowed'
              : showContextPanel
                ? 'bg-blue-50 border border-blue-300 text-blue-700'
                : 'bg-white border border-gray-200 hover:bg-gray-50'
          }`}
          title="Use AI to infer reporting hierarchy from prospect titles and re-layout the map"
        >
          {isBuildingMap ? (
            <>
              <svg className="w-3.5 h-3.5 inline mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {buildStep || 'Analyzing...'}
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              AI Hierarchy
            </>
          )}
        </button>

        {showContextPanel && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg border border-gray-200 shadow-lg p-3 z-20">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Context & relationships
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={userContext}
              onChange={e => setUserContext(e.target.value)}
              placeholder={"e.g. Sarah reports to Mike, the VP Engineering.\nJohn and Lisa are on the same team.\nThe security team reports into the CTO org."}
              rows={4}
              className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none placeholder:text-gray-400"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleRun();
                }
              }}
            />
            <p className="text-[10px] text-gray-400 mt-1 mb-2">
              Describe known reporting relationships, team structures, or any context to guide the AI hierarchy builder.
            </p>
            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleRun}
                className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Run AI Hierarchy
                <kbd className="ml-1.5 text-[9px] text-blue-300 font-mono">{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+↵</kbd>
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        onClick={onAutoLayout}
        className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        title="Auto-arrange nodes"
      >
        <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
        </svg>
        Auto Layout
      </button>
      <button
        onClick={onAddProspect}
        className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        title="Add prospect"
      >
        + Add
      </button>
      <button
        onClick={onToggleFullscreen}
        className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        )}
      </button>
      {isSaving && (
        <span className="text-xs text-gray-400 animate-pulse">Saving...</span>
      )}
    </div>
  );
}
