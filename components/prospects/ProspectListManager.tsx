'use client';

import { useState, useEffect, useCallback } from 'react';
import ProspectWorkflowModal from './ProspectWorkflowModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface ProspectListSummary {
  id: number;
  name: string;
  description: string | null;
  list_type: 'call' | 'email';
  item_count: number;
  completed_count: number;
  updated_at: string;
}

interface Props {
  accountId?: number; // If scoped to an account
}

export default function ProspectListManager({ accountId }: Props) {
  const [lists, setLists] = useState<ProspectListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'call' | 'email'>('call');
  const [creating, setCreating] = useState(false);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch('/api/prospect-lists');
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists);
      }
    } catch (err) {
      console.error('Failed to fetch prospect lists:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/prospect-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, list_type: newType }),
      });
      if (res.ok) {
        setNewName('');
        setShowCreate(false);
        fetchLists();
      }
    } catch (err) {
      console.error('Failed to create list:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await fetch(`/api/prospect-lists/${id}`, { method: 'DELETE' });
      setDeleteModal(null);
      fetchLists();
    } catch (err) {
      console.error('Failed to delete list:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Prospect Lists</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New List
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">List Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g., Q1 Outreach - HVT Prospects"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as 'call' | 'email')}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="call">Call List</option>
                <option value="email">Email List</option>
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Lists */}
      {lists.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 text-sm">No prospect lists yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first list
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map(list => {
            const progress = list.item_count > 0
              ? Math.round((list.completed_count / list.item_count) * 100)
              : 0;

            return (
              <div
                key={list.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => setActiveListId(list.id)}
                      className="text-left flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{list.name}</span>
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          list.list_type === 'call' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {list.list_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                          {list.item_count} prospect{list.item_count !== 1 ? 's' : ''}
                        </span>
                        {list.item_count > 0 && (
                          <>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="text-xs text-gray-500">
                              {list.completed_count}/{list.item_count} completed ({progress}%)
                            </span>
                          </>
                        )}
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-gray-400">
                          Updated {new Date(list.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => setActiveListId(list.id)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => setDeleteModal(list.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {list.item_count > 0 && (
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Workflow Modal */}
      {activeListId && (
        <ProspectWorkflowModal
          listId={activeListId}
          onClose={() => {
            setActiveListId(null);
            fetchLists();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal !== null && (
        <DeleteConfirmationModal
          title="Delete List"
          message={`Are you sure you want to delete this list? This action cannot be undone.`}
          onConfirm={() => handleDelete(deleteModal)}
          onCancel={() => setDeleteModal(null)}
          confirmLabel="Delete"
          isDeleting={deleting}
        />
      )}
    </div>
  );
}
