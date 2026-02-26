'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const ROLE_COLORS: Record<string, string> = {
  decision_maker: 'bg-green-100 text-green-800',
  champion: 'bg-blue-100 text-blue-800',
  influencer: 'bg-purple-100 text-purple-800',
  blocker: 'bg-red-100 text-red-800',
  end_user: 'bg-gray-100 text-gray-700',
  unknown: 'bg-gray-100 text-gray-500',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-300',
  engaged: 'bg-green-400',
  warm: 'bg-yellow-400',
  cold: 'bg-blue-400',
};

const CONTACT_READINESS_ICONS: Record<string, string> = {
  ready: '✓',
  partial: '◐',
  minimal: '○',
};

function ProspectMapNode({ data }: NodeProps) {
  const d = data as {
    name: string;
    title: string | null;
    roleType: string | null;
    relationshipStatus: string;
    contactReadiness: string | null;
    onSelect: () => void;
    onWriteEmail: () => void;
    isCollapsed?: boolean;
    collapsedCount?: number;
    hasChildren?: boolean;
    onToggleCollapse?: () => void;
  };

  return (
    <div
      className="relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
      style={{
        width: 220,
        minHeight: 80,
      }}
      onClick={d.onSelect}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />

      <div className="p-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[d.relationshipStatus] || 'bg-gray-300'}`}
            title={d.relationshipStatus}
          />
          <span className="font-medium text-sm text-gray-900 truncate">{d.name}</span>
          {d.contactReadiness && (
            <span className="text-xs text-gray-400 flex-shrink-0" title={`Contact: ${d.contactReadiness}`}>
              {CONTACT_READINESS_ICONS[d.contactReadiness] || ''}
            </span>
          )}
        </div>
        {d.title && (
          <p className="text-xs text-gray-500 mb-1.5 line-clamp-2" title={d.title}>{d.title}</p>
        )}
        {d.roleType && d.roleType !== 'unknown' && (
          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full ${ROLE_COLORS[d.roleType] || ROLE_COLORS.unknown}`}>
            {d.roleType.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); d.onWriteEmail(); }}
          className="p-1 rounded hover:bg-purple-50 text-purple-500 hover:text-purple-700"
          title="Write email"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
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
                ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
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

export default memo(ProspectMapNode);
