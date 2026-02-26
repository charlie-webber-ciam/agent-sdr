'use client';

import { useState, useCallback } from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  selected,
}: EdgeProps) {
  const [editing, setEditing] = useState(false);
  const [labelText, setLabelText] = useState(
    (data as { label?: string })?.label ?? ''
  );

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const onLabelSave = useCallback(() => {
    setEditing(false);
    const onLabelChange = (data as { onLabelChange?: (edgeId: string, label: string) => void })?.onLabelChange;
    if (onLabelChange) {
      onLabelChange(id, labelText);
    }
  }, [id, labelText, data]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: selected ? '#3b82f6' : '#94a3b8',
          strokeWidth: selected ? 2 : 1.5,
        }}
        markerEnd="url(#custom-arrow)"
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          {editing ? (
            <input
              className="bg-white border border-blue-300 rounded px-2 py-0.5 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              onBlur={onLabelSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onLabelSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
          ) : (
            <div
              className="bg-white/90 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-600 cursor-pointer hover:bg-gray-50 min-w-[20px] text-center"
              onDoubleClick={() => setEditing(true)}
            >
              {labelText || '...'}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
