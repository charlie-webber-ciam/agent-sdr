'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Mail, Linkedin, User } from 'lucide-react';

interface Person {
  id: number;
  name: string;
  title: string | null;
  department: string | null;
  email: string | null;
  linkedin_url: string | null;
  manager_id: number | null;
  level: number;
}

interface TreeNode extends Person {
  children: TreeNode[];
}

const DEPARTMENT_COLORS: Record<string, string> = {
  engineering: 'bg-blue-100 text-blue-800',
  product: 'bg-purple-100 text-purple-800',
  sales: 'bg-green-100 text-green-800',
  marketing: 'bg-pink-100 text-pink-800',
  finance: 'bg-yellow-100 text-yellow-800',
  hr: 'bg-orange-100 text-orange-800',
  operations: 'bg-teal-100 text-teal-800',
  legal: 'bg-gray-100 text-gray-800',
  design: 'bg-indigo-100 text-indigo-800',
  support: 'bg-cyan-100 text-cyan-800',
};

function getDeptColor(dept: string | null): string {
  if (!dept) return 'bg-gray-100 text-gray-600';
  const key = dept.toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, v] of Object.entries(DEPARTMENT_COLORS)) {
    if (key.includes(k)) return v;
  }
  return 'bg-slate-100 text-slate-700';
}

function OrgChartNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div
        className={`
          relative border rounded-lg bg-white shadow-sm px-4 py-3 min-w-[200px] max-w-[260px]
          ${depth === 0 ? 'border-blue-300 shadow-md' : 'border-gray-200'}
          hover:shadow-md transition-shadow
        `}
      >
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-200 rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-50"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}

        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mt-0.5">
            <User className="w-4 h-4 text-gray-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-gray-900 truncate">{node.name}</p>
            {node.title && (
              <p className="text-xs text-gray-500 truncate">{node.title}</p>
            )}
            {node.department && (
              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getDeptColor(node.department)}`}>
                {node.department}
              </span>
            )}
          </div>
        </div>

        {(node.email || node.linkedin_url) && (
          <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-100">
            {node.email && (
              <a href={`mailto:${node.email}`} className="text-gray-400 hover:text-blue-600" title={node.email}>
                <Mail className="w-3.5 h-3.5" />
              </a>
            )}
            {node.linkedin_url && (
              <a href={node.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600" title="LinkedIn">
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="flex flex-col items-center mt-1">
          {/* Vertical connector from parent */}
          <div className="w-px h-5 bg-gray-300" />

          {node.children.length === 1 ? (
            <OrgChartNode node={node.children[0]} depth={depth + 1} />
          ) : (
            <div className="relative flex gap-6">
              {/* Horizontal connector bar */}
              <div
                className="absolute top-0 h-px bg-gray-300"
                style={{
                  left: 'calc(50% - 50% + 100px)',
                  right: 'calc(50% - 50% + 100px)',
                  width: `calc(100% - 200px)`,
                }}
              />
              {/* Calculate the horizontal line properly */}
              <div className="absolute top-0 left-0 right-0 flex justify-between px-[100px]">
                <div />
              </div>

              {node.children.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  {/* Vertical connector to horizontal bar */}
                  <div className="w-px h-5 bg-gray-300" />
                  <OrgChartNode node={child} depth={depth + 1} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrgChartTree({ people }: { people: Person[] }) {
  const tree = useMemo(() => {
    // Build a map of id -> TreeNode
    const nodeMap = new Map<number, TreeNode>();
    for (const p of people) {
      nodeMap.set(p.id, { ...p, children: [] });
    }

    // Link children to parents
    const roots: TreeNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.manager_id && nodeMap.has(node.manager_id)) {
        nodeMap.get(node.manager_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort children by name within each level
    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      node.children.forEach(sortChildren);
    };
    roots.forEach(sortChildren);

    return roots;
  }, [people]);

  if (tree.length === 0) {
    return <p className="text-gray-500 text-center py-8">No people in this chart.</p>;
  }

  return (
    <div className="overflow-x-auto pb-8">
      <div className="inline-flex flex-col items-center min-w-full px-8 pt-4">
        {tree.length === 1 ? (
          <OrgChartNode node={tree[0]} />
        ) : (
          <div className="flex gap-8">
            {tree.map((root) => (
              <OrgChartNode key={root.id} node={root} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
