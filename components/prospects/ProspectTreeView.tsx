'use client';

import { useState, useCallback } from 'react';
import type { Prospect } from './ProspectTab';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const ROLE_COLORS: Record<string, string> = {
  decision_maker: 'bg-green-100 text-green-800',
  champion: 'bg-blue-100 text-blue-800',
  influencer: 'bg-purple-100 text-purple-800',
  blocker: 'bg-red-100 text-red-800',
  end_user: 'bg-gray-100 text-gray-700',
  unknown: 'bg-gray-100 text-gray-500',
};

const ROLE_LABELS: Record<string, string> = {
  decision_maker: 'DM',
  champion: 'Champ',
  influencer: 'Infl',
  blocker: 'Block',
  end_user: 'EU',
  unknown: '?',
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
  accountId: number;
  onRefresh: () => void;
  onSelectProspect: (p: Prospect) => void;
  onWriteEmail: (p: Prospect) => void;
}

export default function ProspectTreeView({ prospects, accountId, onRefresh, onSelectProspect, onWriteEmail }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(prospects.map(p => p.id)));
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<Prospect | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragStart = useCallback((e: React.DragEvent, prospect: Prospect) => {
    e.dataTransfer.setData('text/plain', String(prospect.id));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(targetId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);

    const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(draggedId) || draggedId === targetId) return;

    try {
      await fetch(`/api/accounts/${accountId}/prospects/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderedIds: prospects.map(p => p.id),
          parentChanges: [{ id: draggedId, newParentId: targetId }],
        }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to reparent:', err);
    }
  }, [accountId, prospects, onRefresh]);

  const handleDropRoot = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);

    const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
    if (isNaN(draggedId)) return;

    try {
      await fetch(`/api/accounts/${accountId}/prospects/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderedIds: prospects.map(p => p.id),
          parentChanges: [{ id: draggedId, newParentId: null }],
        }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to reparent:', err);
    }
  }, [accountId, prospects, onRefresh]);

  const handleDelete = (p: Prospect) => {
    setDeleteModal(p);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await fetch(`/api/accounts/${accountId}/prospects/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(false);
    }
  };

  const tree = buildTree(prospects);

  const renderNode = (node: TreeNode, level: number) => {
    const { prospect, children } = node;
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(prospect.id);
    const roleColor = prospect.role_type ? ROLE_COLORS[prospect.role_type] : '';
    const roleLabel = prospect.role_type ? ROLE_LABELS[prospect.role_type] : '';

    return (
      <div key={prospect.id}>
        <div
          draggable
          onDragStart={e => handleDragStart(e, prospect)}
          onDragOver={e => handleDragOver(e, prospect.id)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, prospect.id)}
          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing group ${
            dragOverId === prospect.id ? 'bg-blue-50 border border-blue-300' : ''
          }`}
          style={{ paddingLeft: `${level * 24 + 8}px` }}
        >
          {/* Expand/collapse */}
          <button
            onClick={() => toggleExpand(prospect.id)}
            className={`w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 ${
              !hasChildren ? 'invisible' : ''
            }`}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Name */}
          <span className="font-medium text-sm text-gray-900 truncate">
            {prospect.first_name} {prospect.last_name}
          </span>

          {/* Title */}
          {prospect.title && (
            <span className="text-xs text-gray-500 truncate max-w-[180px]">
              {prospect.title}
            </span>
          )}

          {/* Role badge */}
          {roleLabel && (
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${roleColor} flex-shrink-0`}>
              {roleLabel}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="opacity-0 group-hover:opacity-100 flex gap-1 flex-shrink-0 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onSelectProspect(prospect); }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-1.5 py-0.5"
            >
              Edit
            </button>
            <button
              onClick={e => { e.stopPropagation(); onWriteEmail(prospect); }}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium px-1.5 py-0.5"
            >
              Email
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(prospect); }}
              className="text-xs text-red-500 hover:text-red-600 font-medium px-1.5 py-0.5"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        {/* Drop zone for making root-level */}
        <div
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={handleDropRoot}
          className="min-h-[2px]"
        />
        {tree.map(root => renderNode(root, 0))}
        {tree.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-4">No prospects to display</p>
        )}
      </div>

      {deleteModal && (
        <DeleteConfirmationModal
          title="Delete Prospect"
          message={`Are you sure you want to delete ${deleteModal.first_name} ${deleteModal.last_name}? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteModal(null)}
          confirmLabel="Delete"
          isDeleting={deleting}
        />
      )}
    </>
  );
}
