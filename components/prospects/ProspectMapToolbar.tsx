'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface ProspectMapToolbarProps {
  onAutoLayout: () => void;
  onFitVisible: () => void;
  onAddProspect: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onResetSmartCollapse: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isSaving: boolean;
  isBuildingMap: boolean;
  buildStep: string | null;
  onBuildMap: (userContext?: string) => void;
  onImport: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchMatchCount: number;
  searchActiveIndex: number;
  onFocusNextMatch: () => void;
  onFocusPrevMatch: () => void;
  showGhostNodes: boolean;
  showReportsToEdges: boolean;
  showCustomEdges: boolean;
  onToggleGhostNodes: () => void;
  onToggleReportsToEdges: () => void;
  onToggleCustomEdges: () => void;
  visibleNodeCount: number;
  totalNodeCount: number;
  visibleEdgeCount: number;
  totalEdgeCount: number;
}

interface MiniToggleProps {
  active: boolean;
  label: string;
  title: string;
  onClick: () => void;
}

function MiniToggle({ active, label, title, onClick }: MiniToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700 border-blue-300'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
      title={title}
    >
      {label}
    </button>
  );
}

export default function ProspectMapToolbar({
  onAutoLayout,
  onFitVisible,
  onAddProspect,
  onExpandAll,
  onCollapseAll,
  onResetSmartCollapse,
  isFullscreen,
  onToggleFullscreen,
  isSaving,
  isBuildingMap,
  buildStep,
  onBuildMap,
  onImport,
  searchQuery,
  onSearchQueryChange,
  searchMatchCount,
  searchActiveIndex,
  onFocusNextMatch,
  onFocusPrevMatch,
  showGhostNodes,
  showReportsToEdges,
  showCustomEdges,
  onToggleGhostNodes,
  onToggleReportsToEdges,
  onToggleCustomEdges,
  visibleNodeCount,
  totalNodeCount,
  visibleEdgeCount,
  totalEdgeCount,
}: ProspectMapToolbarProps) {
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [userContext, setUserContext] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && navigator.platform.includes('Mac'),
    []
  );

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

  const searchPositionText =
    searchMatchCount > 0
      ? `${Math.min(searchActiveIndex + 1, searchMatchCount)}/${searchMatchCount}`
      : '0/0';

  return (
    <div className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)]">
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm p-2.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
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
                    <kbd className="ml-1.5 text-[9px] text-blue-300 font-mono">{isMac ? '⌘' : 'Ctrl'}+↵</kbd>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onAutoLayout}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Auto-arrange visible nodes (shortcut: L)"
          >
            Auto Layout
          </button>
          <button
            onClick={onFitVisible}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Fit visible nodes to viewport (shortcut: V)"
          >
            Fit View
          </button>
          <button
            onClick={onExpandAll}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Expand all hierarchy nodes (shortcut: X)"
          >
            Expand All
          </button>
          <button
            onClick={onCollapseAll}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Collapse all hierarchy nodes (shortcut: C)"
          >
            Collapse All
          </button>
          <button
            onClick={onResetSmartCollapse}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Restore smart auto-collapse defaults (shortcut: S)"
          >
            Smart Collapse
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
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>

          {isSaving && (
            <span className="text-xs text-gray-400 animate-pulse">Saving...</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 min-w-[270px]">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-4.65a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search by name or title"
              className="bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) onFocusPrevMatch();
                  else onFocusNextMatch();
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="text-[11px] text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">
            <span className="text-[11px] text-gray-500">Matches {searchPositionText}</span>
            <button
              onClick={onFocusPrevMatch}
              disabled={searchMatchCount === 0}
              className="px-1.5 py-0.5 text-[11px] rounded border border-gray-200 bg-white disabled:opacity-50"
              title="Previous match"
            >
              Prev
            </button>
            <button
              onClick={onFocusNextMatch}
              disabled={searchMatchCount === 0}
              className="px-1.5 py-0.5 text-[11px] rounded border border-gray-200 bg-white disabled:opacity-50"
              title="Next match"
            >
              Next
            </button>
          </div>

          <MiniToggle
            active={showGhostNodes}
            label="Ghost Nodes"
            title="Toggle AI ghost nodes (shortcut: G)"
            onClick={onToggleGhostNodes}
          />
          <MiniToggle
            active={showReportsToEdges}
            label="Reports-To"
            title="Toggle reporting hierarchy edges"
            onClick={onToggleReportsToEdges}
          />
          <MiniToggle
            active={showCustomEdges}
            label="Custom Links"
            title="Toggle custom relationship edges"
            onClick={onToggleCustomEdges}
          />

          <span className="px-2 py-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded">
            Nodes: {visibleNodeCount}/{totalNodeCount}
          </span>
          <span className="px-2 py-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded">
            Edges: {visibleEdgeCount}/{totalEdgeCount}
          </span>
          <span className="text-[10px] text-gray-400 ml-1">
            Shortcuts: L layout, V fit, X expand, C collapse, S smart, G ghost
          </span>
        </div>
      </div>
    </div>
  );
}
