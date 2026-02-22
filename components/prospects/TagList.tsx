'use client';

import { useState } from 'react';

interface Props {
  tagsJson: string | null | undefined;
  max?: number;
}

export default function TagList({ tagsJson, max = 5 }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!tagsJson) return null;

  let tags: string[];
  try {
    tags = JSON.parse(tagsJson);
  } catch {
    return null;
  }

  if (!Array.isArray(tags) || tags.length === 0) return null;

  const humanize = (s: string) => s.replace(/_/g, ' ');
  const visible = expanded ? tags : tags.slice(0, max);
  const hiddenCount = tags.length - max;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag, i) => (
        <span
          key={i}
          className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded border border-gray-200"
        >
          {humanize(tag)}
        </span>
      ))}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-1.5 py-0.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {expanded ? 'show less' : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
