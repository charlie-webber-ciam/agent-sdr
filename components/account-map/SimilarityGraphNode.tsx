'use client';

import { type NodeProps } from '@xyflow/react';

import { cn } from '@/lib/utils';

interface SimilarityGraphNodeData {
  companyName: string;
  industry: string;
  domain: string | null;
  customerLabel: string | null;
  isCustomer: boolean;
  scoreLabel: string | null;
  strengthLabel: string | null;
  isCenter: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  compact: boolean;
  showLabels: boolean;
}

export default function SimilarityGraphNode({ data, selected }: NodeProps) {
  const node = data as unknown as SimilarityGraphNodeData;

  return (
    <div
      className={cn(
        'w-[220px] rounded-3xl border shadow-sm transition-all',
        node.compact ? 'px-4 py-3' : 'px-5 py-4',
        node.isCenter
          ? 'border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-white shadow-amber-100'
          : node.isHighlighted
            ? 'border-sky-300 bg-gradient-to-br from-sky-50 via-cyan-50 to-white shadow-sky-100'
            : 'border-stone-200 bg-gradient-to-br from-stone-50 via-white to-slate-50',
        selected && 'ring-2 ring-slate-900/70',
        node.isDimmed && 'opacity-45',
        !node.isDimmed && 'hover:-translate-y-0.5 hover:shadow-md'
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{node.companyName}</p>
            <p className="truncate text-xs text-slate-600">{node.industry || 'Unknown industry'}</p>
          </div>
          {node.strengthLabel && (
            <span
              className={cn(
                'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                node.isCenter
                  ? 'bg-amber-100 text-amber-800'
                  : node.isHighlighted
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-stone-200 text-stone-700'
              )}
            >
              {node.strengthLabel}
            </span>
          )}
        </div>

        {(node.showLabels || node.isCenter) && (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                  node.isCustomer
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-stone-700'
                )}
              >
                {node.isCustomer ? 'Customer' : 'Non-customer'}
              </span>
              {node.customerLabel && (
                <span className="truncate text-[11px] font-medium text-slate-600">
                  {node.customerLabel}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500">
              {node.domain || 'No domain'}
            </p>
            {node.scoreLabel && (
              <p className="text-xs font-medium text-slate-700">{node.scoreLabel}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
