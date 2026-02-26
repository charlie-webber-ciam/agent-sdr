'use client';

import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

export default function ReportsToEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        stroke: '#6b7280',
        strokeWidth: 2,
      }}
      markerEnd="url(#reports-to-arrow)"
    />
  );
}
