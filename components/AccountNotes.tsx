'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

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
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
      }
    } catch (err) {
      console.error('Failed to add note:', err);
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
      }
    } catch (err) {
      console.error('Failed to update note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      });
      if (res.ok) {
        onNotesChange(notes.filter(n => n.id !== noteId));
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  return (
    <div>
      {/* Add Note */}
      <div className="mb-4">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Note
          </button>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write a note about this account... (supports markdown)"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAdd}
                disabled={isAdding || !newContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {isAdding ? 'Saving...' : 'Save Note'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewContent(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No notes yet. Add one to track engagement history.</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              {editingId === note.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleUpdate(note.id)}
                      disabled={isSaving || !editContent.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="prose prose-sm max-w-none prose-p:text-gray-700 prose-p:mb-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {note.content}
                    </ReactMarkdown>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-yellow-200">
                    <span className="text-xs text-gray-500">
                      {formatDate(note.createdAt)}
                      {note.updatedAt !== note.createdAt && ` (edited ${formatDate(note.updatedAt)})`}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
