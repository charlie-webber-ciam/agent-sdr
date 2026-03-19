'use client';

import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

interface SimilarityGraphEdgeData {
  label: string;
  strength: number;
  highlighted: boolean;
  dimmed: boolean;
  showLabel: boolean;
}

export default function SimilarityGraphEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const edge = (data || {}) as unknown as SimilarityGraphEdgeData;
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const strokeWidth = 1.5 + Math.max(Math.min(edge.strength, 1), 0) * 3;
  const color = edge.highlighted ? '#0f172a' : '#64748b';
  const opacity = edge.dimmed ? 0.18 : edge.highlighted ? 0.78 : 0.42;
  const showFloatingLabel = hovered || selected || edge.showLabel;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth,
          opacity,
        }}
        interactionWidth={20}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {showFloatingLabel && edge.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="rounded-full border border-stone-200 bg-white/95 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm"
          >
            {edge.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
