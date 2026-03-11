'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function ProspectGhostNode({ data }: NodeProps) {
  const d = data as {
    name: string;
    title: string | null;
    source: string;
    onPromote: () => void;
    isCollapsed?: boolean;
    collapsedCount?: number;
    hasChildren?: boolean;
    onToggleCollapse?: () => void;
    isFocused?: boolean;
    isSearchMatch?: boolean;
  };

  return (
    <div
      className={`relative bg-gray-50 border-2 border-dashed rounded-lg shadow-sm opacity-80 hover:opacity-100 transition-all group ${
        d.isFocused
          ? 'border-blue-500 ring-2 ring-blue-200'
          : d.isSearchMatch
            ? 'border-sky-300 ring-1 ring-sky-200'
            : 'border-gray-300 hover:border-gray-400'
      }`}
      style={{ width: 200, minHeight: 70 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />

      <div className="p-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-medium text-sm text-gray-700 truncate">{d.name}</span>
          <span className="px-1 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 rounded uppercase flex-shrink-0">
            AI
          </span>
        </div>
        {d.title && (
          <p className="text-xs text-gray-500 truncate mb-1.5" title={d.title}>{d.title}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{d.source}</span>
          <button
            onClick={(e) => { e.stopPropagation(); d.onPromote(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            Promote
          </button>
        </div>
      </div>

      {/* Collapse/expand button */}
      {d.hasChildren && d.onToggleCollapse && (
        <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); d.onToggleCollapse!(); }}
            className={`
              flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold
              border shadow-sm transition-all duration-200 hover:scale-110
              ${d.isCollapsed
                ? 'bg-gray-600 text-white border-gray-700 hover:bg-gray-700'
                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}
            `}
            title={d.isCollapsed ? `Expand ${d.collapsedCount} hidden` : 'Collapse'}
          >
            {d.isCollapsed ? (
              <>{`+ ${d.collapsedCount}`}</>
            ) : (
              <>{'−'}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(ProspectGhostNode);
