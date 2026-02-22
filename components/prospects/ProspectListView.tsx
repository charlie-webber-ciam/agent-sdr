'use client';

import { useState } from 'react';
import type { Prospect } from './ProspectTab';
import ProspectTierBadge from './ProspectTierBadge';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import Toast from './Toast';

const ROLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  decision_maker: { bg: 'bg-green-100', text: 'text-green-800', label: 'Decision Maker' },
  champion: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Champion' },
  influencer: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Influencer' },
  blocker: { bg: 'bg-red-100', text: 'text-red-800', label: 'Blocker' },
  end_user: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'End User' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Unknown' },
};

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-gray-100', text: 'text-gray-700' },
  engaged: { bg: 'bg-blue-100', text: 'text-blue-800' },
  warm: { bg: 'bg-orange-100', text: 'text-orange-800' },
  cold: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
};

interface Props {
  prospects: Prospect[];
  accountId: number;
  onRefresh: () => void;
  onSelectProspect: (p: Prospect) => void;
  onWriteEmail: (p: Prospect) => void;
}

export default function ProspectListView({ prospects, accountId, onRefresh, onSelectProspect, onWriteEmail }: Props) {
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newRow, setNewRow] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '' });
  const [addingRow, setAddingRow] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Prospect | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{message: string; type: 'success'|'error'|'info'}|null>(null);

  const startEdit = (prospect: Prospect, field: string) => {
    setEditingCell({ id: prospect.id, field });
    setEditValue((prospect as any)[field] || '');
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    try {
      await fetch(`/api/accounts/${accountId}/prospects/${editingCell.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingCell.field]: editValue }),
      });
      onRefresh();
    } catch (err) {
      setToast({ message: 'Failed to save changes', type: 'error' });
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const handleDelete = (prospect: Prospect) => {
    setDeleteModal(prospect);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await fetch(`/api/accounts/${accountId}/prospects/${deleteModal.id}`, { method: 'DELETE' });
      setDeleteModal(null);
      onRefresh();
    } catch (err) {
      setToast({ message: 'Failed to delete prospect', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleAddRow = async () => {
    if (!newRow.first_name || !newRow.last_name) return;
    setAddingRow(true);
    try {
      await fetch(`/api/accounts/${accountId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow),
      });
      setNewRow({ first_name: '', last_name: '', title: '', email: '', phone: '' });
      onRefresh();
      setToast({ message: 'Prospect added', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to add prospect', type: 'error' });
    } finally {
      setAddingRow(false);
    }
  };

  const handleNewRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newRow.first_name && newRow.last_name) handleAddRow();
  };

  const renderCell = (prospect: Prospect, field: string, value: string | null) => {
    if (editingCell?.id === prospect.id && editingCell?.field === field) {
      return (
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      );
    }
    return (
      <span
        onClick={() => startEdit(prospect, field)}
        className="cursor-text hover:bg-gray-50 px-2 py-1 rounded block truncate"
        title={value || ''}
      >
        {value || <span className="text-gray-300">-</span>}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Title</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Tier</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Seniority</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Phone</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Calls</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Role</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {prospects.map(p => {
              const roleBadge = p.role_type ? ROLE_BADGES[p.role_type] : null;
              const statusBadge = STATUS_BADGES[p.relationship_status] || STATUS_BADGES.new;
              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-sm text-gray-900 font-medium whitespace-nowrap">
                    {renderCell(p, 'first_name', p.first_name)}{' '}
                    {renderCell(p, 'last_name', p.last_name)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 max-w-[200px]">
                    {renderCell(p, 'title', p.title)}
                  </td>
                  <td className="px-4 py-2.5">
                    <ProspectTierBadge tier={p.value_tier} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 capitalize">
                    {p.seniority_level ? p.seniority_level.replace(/_/g, ' ') : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600 max-w-[200px]">
                    {renderCell(p, 'email', p.email)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {renderCell(p, 'phone', p.phone)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {p.call_count > 0 ? (
                      <span className="text-xs">
                        {p.call_count}
                        {p.connect_count > 0 && <span className="text-green-600 ml-1">({p.connect_count}c)</span>}
                      </span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {roleBadge ? (
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${roleBadge.bg} ${roleBadge.text}`}>
                        {roleBadge.label}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge.bg} ${statusBadge.text}`}>
                      {p.relationship_status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectProspect(p)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onWriteEmail(p)}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium mr-3"
                    >
                      Email
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-red-500 hover:text-red-600 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Quick-add row */}
            <tr className="bg-gray-50/50">
              <td className="px-4 py-2 whitespace-nowrap">
                <div className="flex gap-1">
                  <input
                    placeholder="First"
                    value={newRow.first_name}
                    onChange={e => setNewRow(r => ({ ...r, first_name: e.target.value }))}
                    onKeyDown={handleNewRowKeyDown}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    placeholder="Last"
                    value={newRow.last_name}
                    onChange={e => setNewRow(r => ({ ...r, last_name: e.target.value }))}
                    onKeyDown={handleNewRowKeyDown}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </td>
              <td className="px-4 py-2">
                <input
                  placeholder="Title"
                  value={newRow.title}
                  onChange={e => setNewRow(r => ({ ...r, title: e.target.value }))}
                  onKeyDown={handleNewRowKeyDown}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2"></td>
              <td className="px-4 py-2">
                <input
                  placeholder="Email"
                  value={newRow.email}
                  onChange={e => setNewRow(r => ({ ...r, email: e.target.value }))}
                  onKeyDown={handleNewRowKeyDown}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  placeholder="Phone"
                  value={newRow.phone}
                  onChange={e => setNewRow(r => ({ ...r, phone: e.target.value }))}
                  onKeyDown={handleNewRowKeyDown}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
              <td className="px-4 py-2" colSpan={3}></td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={handleAddRow}
                  disabled={!newRow.first_name || !newRow.last_name || addingRow}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {addingRow ? 'Adding...' : '+ Add'}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

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
    </div>
  );
}
