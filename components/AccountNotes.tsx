'use client';

import { useState } from 'react';

import MarkdownContent from '@/components/MarkdownContent';
import { useToast } from '@/lib/toast-context';

interface Note {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface AccountNotesProps {
  accountId: number;
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
}

export default function AccountNotes({ accountId, notes, onNotesChange }: AccountNotesProps) {
  const toast = useToast();
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onNotesChange([data.note, ...notes]);
        setNewContent('');
        setShowAddForm(false);
      } else {
        toast.error('Failed to save note. Please try again.');
      }
    } catch {
      toast.error('Failed to save note. Please check your connection.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdate = async (noteId: number) => {
    if (!editContent.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, content: editContent.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onNotesChange(notes.map(n => n.id === noteId ? data.note : n));
        setEditingId(null);
      } else {
        toast.error('Failed to update note. Please try again.');
      }
    } catch {
      toast.error('Failed to update note. Please check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    setDeletingId(noteId);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      });
      if (res.ok) {
        onNotesChange(notes.filter(n => n.id !== noteId));
      } else {
        toast.error('Failed to delete note. Please try again.');
      }
    } catch {
      toast.error('Failed to delete note. Please check your connection.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Account journal</p>
          <p className="mt-1 text-sm text-gray-600">
            Capture meetings, follow-ups, observations, and next steps. Markdown and source links are supported.
          </p>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Timeline Note
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
          <p className="mb-2 text-sm font-medium text-blue-900">New timeline entry</p>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What happened, why it matters, and what should happen next. Example: Met with the platform team, they are rationalising login flows before Q3 launch. Source: [board update](https://...)."
            rows={5}
            className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <p className="mt-2 text-xs text-blue-800/80">Tip: include owners, dates, next steps, and any source links worth preserving.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isAdding || !newContent.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isAdding ? 'Saving...' : 'Save Note'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewContent(''); }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
          No timeline notes yet. Add one to track account movement, stakeholder conversations, and follow-up actions.
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute bottom-2 left-[11px] top-2 w-px bg-gray-200" />

          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="relative">
                <div className="absolute left-[-1px] top-5 h-3 w-3 rounded-full border-2 border-blue-200 bg-white" />

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  {editingId === note.id ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={5}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleUpdate(note.id)}
                          disabled={isSaving || !editContent.trim()}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {formatDate(note.createdAt)}
                        </div>
                        {note.updatedAt !== note.createdAt && (
                          <div className="text-xs text-gray-500">Edited {formatDate(note.updatedAt)}</div>
                        )}
                      </div>

                      <MarkdownContent content={note.content} compact />

                      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
                        <button
                          onClick={() => { setEditingId(note.id); setEditContent(note.content); setConfirmDeleteId(null); }}
                          disabled={deletingId === note.id}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        {confirmDeleteId === note.id ? (
                          <span className="flex items-center gap-2 text-xs">
                            <span className="text-red-700">Delete this note?</span>
                            <button
                              onClick={() => handleDelete(note.id)}
                              disabled={deletingId === note.id}
                              className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              {deletingId === note.id ? 'Deleting...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingId === note.id}
                              className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(note.id)}
                            disabled={deletingId === note.id}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
