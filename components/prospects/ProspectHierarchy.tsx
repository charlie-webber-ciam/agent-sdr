'use client';

import type { Prospect } from './ProspectTab';

const ROLE_COLORS: Record<string, string> = {
  decision_maker: 'bg-green-100 text-green-800',
  champion: 'bg-blue-100 text-blue-800',
  influencer: 'bg-purple-100 text-purple-800',
  blocker: 'bg-red-100 text-red-800',
  end_user: 'bg-gray-100 text-gray-700',
  unknown: 'bg-gray-100 text-gray-500',
};

const ROLE_LABELS: Record<string, string> = {
  decision_maker: 'Decision Maker',
  champion: 'Champion',
  influencer: 'Influencer',
  blocker: 'Blocker',
  end_user: 'End User',
  unknown: 'Unknown',
};

interface TreeNode {
  prospect: Prospect;
  children: TreeNode[];
}

function buildTree(prospects: Prospect[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  for (const p of prospects) {
    map.set(p.id, { prospect: p, children: [] });
  }

  for (const p of prospects) {
    const node = map.get(p.id)!;
    if (p.parent_prospect_id && map.has(p.parent_prospect_id)) {
      map.get(p.parent_prospect_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface Props {
  prospects: Prospect[];
  onSelectProspect: (p: Prospect) => void;
  onWriteEmail: (p: Prospect) => void;
}

function ProspectNode({ node, onSelect, onWriteEmail }: { node: TreeNode; onSelect: (p: Prospect) => void; onWriteEmail: (p: Prospect) => void }) {
  const { prospect, children } = node;
  const roleColor = prospect.role_type ? ROLE_COLORS[prospect.role_type] : '';
  const roleLabel = prospect.role_type ? ROLE_LABELS[prospect.role_type] : '';

  return (
    <div className="flex flex-col items-center">
      {/* Box */}
      <div
        className="relative bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all min-w-[160px] text-center group"
      >
        <div onClick={() => onSelect(prospect)}>
          <div className="font-medium text-sm text-gray-900">
            {prospect.first_name} {prospect.last_name}
          </div>
          {prospect.title && (
            <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{prospect.title}</div>
          )}
          {roleLabel && (
            <span className={`inline-block mt-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${roleColor}`}>
              {roleLabel}
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onWriteEmail(prospect); }}
          title="Write email"
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-purple-50 text-purple-500 hover:text-purple-700"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* Children */}
      {children.length > 0 && (
        <div className="flex flex-col items-center mt-0">
          {/* Vertical line down */}
          <div className="w-px h-6 bg-gray-300"></div>

          {/* Horizontal connector + children */}
          <div className="relative flex gap-6">
            {/* Horizontal line across all children */}
            {children.length > 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-gray-300"
                style={{ width: `calc(100% - 160px)` }}></div>
            )}

            {children.map(child => (
              <div key={child.prospect.id} className="flex flex-col items-center">
                {/* Vertical line to child */}
                <div className="w-px h-6 bg-gray-300"></div>
                <ProspectNode node={child} onSelect={onSelect} onWriteEmail={onWriteEmail} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProspectHierarchy({ prospects, onSelectProspect, onWriteEmail }: Props) {
  const tree = buildTree(prospects);

  if (prospects.length === 0) return null;

  // If no hierarchy exists, show flat grid
  const hasHierarchy = prospects.some(p => p.parent_prospect_id !== null);

  if (!hasHierarchy) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-500 mb-4">
          No hierarchy defined. Set parent relationships to see the org chart.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {prospects.map(p => {
            const roleColor = p.role_type ? ROLE_COLORS[p.role_type] : '';
            const roleLabel = p.role_type ? ROLE_LABELS[p.role_type] : '';
            return (
              <div
                key={p.id}
                className="relative bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all text-center group"
              >
                <div onClick={() => onSelectProspect(p)}>
                  <div className="font-medium text-sm text-gray-900">
                    {p.first_name} {p.last_name}
                  </div>
                  {p.title && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{p.title}</div>
                  )}
                  {roleLabel && (
                    <span className={`inline-block mt-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${roleColor}`}>
                      {roleLabel}
                    </span>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onWriteEmail(p); }}
                  title="Write email"
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-purple-50 text-purple-500 hover:text-purple-700"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 overflow-x-auto">
      <div className="flex justify-center gap-8">
        {tree.map(root => (
          <ProspectNode key={root.prospect.id} node={root} onSelect={onSelectProspect} onWriteEmail={onWriteEmail} />
        ))}
      </div>
    </div>
  );
}
