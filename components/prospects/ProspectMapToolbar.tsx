'use client';

interface ProspectMapToolbarProps {
  onAutoLayout: () => void;
  onAddProspect: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isSaving: boolean;
}

export default function ProspectMapToolbar({
  onAutoLayout,
  onAddProspect,
  isFullscreen,
  onToggleFullscreen,
  isSaving,
}: ProspectMapToolbarProps) {
  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
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
