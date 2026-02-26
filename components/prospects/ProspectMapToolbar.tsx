'use client';

interface ProspectMapToolbarProps {
  onAutoLayout: () => void;
  onAddProspect: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isSaving: boolean;
  isBuildingMap: boolean;
  buildStep: string | null;
  onBuildMap: () => void;
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
}: ProspectMapToolbarProps) {
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
      <button
        onClick={onBuildMap}
        disabled={isBuildingMap}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-colors ${
          isBuildingMap
            ? 'bg-purple-100 text-purple-400 border border-purple-200 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 border border-purple-600'
        }`}
        title="Use AI to discover new prospects, infer reporting hierarchy, and auto-layout the map"
      >
        {isBuildingMap ? (
          <>
            <svg className="w-3.5 h-3.5 inline mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {buildStep || 'Building...'}
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Build AI Map
          </>
        )}
      </button>
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
