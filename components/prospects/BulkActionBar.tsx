'use client';

import { useState } from 'react';

interface Props {
  selectedCount: number;
  selectedIds: number[];
  onDeselectAll: () => void;
  onActionComplete: () => void;
}

export default function BulkActionBar({
  selectedCount,
  selectedIds,
  onDeselectAll,
  onActionComplete,
}: Props) {
  const [showAddToList, setShowAddToList] = useState(false);
  const [lists, setLists] = useState<{ id: number; name: string; list_type: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchLists = async () => {
    setLoadingLists(true);
    try {
      const res = await fetch('/api/prospect-lists');
      if (res.ok) {
        const data = await res.json();
        setLists(data.lists ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    } finally {
      setLoadingLists(false);
    }
  };

  const handleOpenAddToList = () => {
    if (!showAddToList) {
      fetchLists();
    }
    setShowAddToList(v => !v);
  };

  const handleAddToList = async (listId: number) => {
    setAddingToList(true);
    setShowAddToList(false);
    try {
      await fetch(`/api/prospect-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: selectedIds }),
      });
      onActionComplete();
    } catch (err) {
      console.error('Failed to add to list:', err);
    } finally {
      setAddingToList(false);
    }
  };

  const handleBulkStatus = async (status: string) => {
    setUpdatingStatus(true);
    try {
      await fetch('/api/prospects/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, relationship_status: status }),
      });
      onActionComplete();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-gray-900 text-white rounded-xl shadow-2xl px-5 py-3">
      <span className="text-sm font-semibold whitespace-nowrap">
        {selectedCount} selected
      </span>

      <div className="h-4 w-px bg-gray-600" />

      {/* Add to List */}
      <div className="relative">
        <button
          onClick={handleOpenAddToList}
          disabled={addingToList}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {addingToList ? 'Adding...' : 'Add to List'}
        </button>
        {showAddToList && (
          <div className="absolute bottom-full mb-2 left-0 min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
            {loadingLists ? (
              <div className="px-3 py-3 text-sm text-gray-500 text-center">Loading lists...</div>
            ) : lists.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500 text-center">No lists yet</div>
            ) : (
              lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => handleAddToList(list.id)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${list.list_type === 'call' ? 'bg-green-400' : 'bg-purple-400'}`} />
                  {list.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Mark as Warm */}
      <button
        onClick={() => handleBulkStatus('warm')}
        disabled={updatingStatus}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
      >
        Mark Warm
      </button>

      {/* Mark as Engaged */}
      <button
        onClick={() => handleBulkStatus('engaged')}
        disabled={updatingStatus}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        Mark Engaged
      </button>

      <div className="h-4 w-px bg-gray-600" />

      {/* Deselect */}
      <button
        onClick={onDeselectAll}
        className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
        title="Deselect all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
