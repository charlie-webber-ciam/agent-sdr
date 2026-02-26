'use client';

import { useState } from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';

const DEAL_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

function getDealColor(opportunityId: number): string {
  return DEAL_COLORS[opportunityId % DEAL_COLORS.length];
}

export default function DealEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = getDealColor((data as { opportunityId?: number })?.opportunityId ?? 0);
  const oppName = (data as { opportunityName?: string })?.opportunityName ?? '';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: '6 3',
          opacity: 0.6,
        }}
        interactionWidth={20}
      />
      {/* Invisible wider path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && oppName && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 shadow-md whitespace-nowrap"
          >
            {oppName}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
