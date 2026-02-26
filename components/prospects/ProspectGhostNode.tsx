'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function ProspectGhostNode({ data }: NodeProps) {
  const d = data as {
    name: string;
    title: string | null;
    source: string;
    onPromote: () => void;
  };

  return (
    <div
      className="relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg shadow-sm opacity-80 hover:opacity-100 hover:border-gray-400 transition-all group"
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
    </div>
  );
}

export default memo(ProspectGhostNode);
