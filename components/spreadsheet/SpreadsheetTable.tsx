'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ClipboardPaste, Trash2, ArrowUpDown, ExternalLink, Columns3 } from 'lucide-react';

interface ProspectRow {
  id: number | null;
  _key: string;
  account_id?: number;
  company_name?: string;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  mobile: string;
  enriched_mobile: string;
  linkedin_url: string;
  sfdc_id: string;
  sfdc_type: string;
  department: string;
  role_type: string;
  prospect_status: string;
  relationship_status: string;
  notes: string;
}

let _nextTempKey = 0;
function tempKey() { return `tmp-${++_nextTempKey}`; }

type SortField = 'first_name' | 'last_name' | 'title' | 'email' | 'mobile' | 'department' | 'role_type' | 'prospect_status' | 'relationship_status' | 'company_name';

function emptyRow(): ProspectRow {
  return {
    id: null,
    _key: tempKey(),
    first_name: '',
    last_name: '',
    title: '',
    email: '',
    mobile: '',
    enriched_mobile: '',
    linkedin_url: '',
    sfdc_id: '',
    sfdc_type: '',
    department: '',
    role_type: '',
    prospect_status: 'active',
    relationship_status: 'new',
    notes: '',
  };
}

const COLUMNS: { key: keyof ProspectRow; label: string; width: string; crossOnly?: boolean }[] = [
  { key: 'company_name', label: 'Company', width: 'w-[150px]', crossOnly: true },
  { key: 'first_name', label: 'First Name', width: 'w-[120px]' },
  { key: 'last_name', label: 'Last Name', width: 'w-[120px]' },
  { key: 'title', label: 'Title', width: 'w-[180px]' },
  { key: 'email', label: 'Email', width: 'w-[180px]' },
  { key: 'mobile', label: 'Mobile', width: 'w-[130px]' },
  { key: 'enriched_mobile', label: 'Enriched Mobile', width: 'w-[140px]' },
  { key: 'linkedin_url', label: 'LinkedIn', width: 'w-[150px]' },
  { key: 'sfdc_id', label: 'Salesforce', width: 'w-[120px]' },
  { key: 'department', label: 'Department', width: 'w-[120px]' },
  { key: 'role_type', label: 'Role', width: 'w-[120px]' },
  { key: 'prospect_status', label: 'Status', width: 'w-[140px]' },
  { key: 'relationship_status', label: 'Rel. Status', width: 'w-[130px]' },
  { key: 'notes', label: 'Notes', width: 'w-[180px]' },
];

const DEFAULT_HIDDEN_COLS = new Set(['enriched_mobile', 'department', 'notes', 'relationship_status']);

function loadHiddenCols(): Set<string> {
  try {
    const saved = localStorage.getItem('spreadsheet_hidden_cols');
    if (saved) return new Set(JSON.parse(saved));
  } catch { /* ignore */ }
  return new Set(DEFAULT_HIDDEN_COLS);
}

const ROLE_OPTIONS = ['', 'decision_maker', 'champion', 'influencer', 'blocker', 'end_user', 'unknown'];
const STATUS_OPTIONS = ['active', 'working', 'nurture', 'unqualified', 'no_longer_at_company'];
const REL_STATUS_OPTIONS = ['new', 'engaged', 'warm', 'cold'];

function statusBadgeColor(status: string) {
  switch (status) {
    case 'working': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'nurture': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'unqualified': return 'bg-gray-100 text-gray-500 border-gray-200';
    case 'no_longer_at_company': return 'bg-red-100 text-red-700 border-red-200';
    case 'active': return 'bg-green-100 text-green-700 border-green-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function relStatusBadgeColor(status: string) {
  switch (status) {
    case 'engaged': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'warm': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'cold': return 'bg-slate-100 text-slate-500 border-slate-200';
    case 'new': return 'bg-green-100 text-green-700 border-green-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'no_longer_at_company': return 'left company';
    default: return status.replace(/_/g, ' ');
  }
}

function sfdcUrl(sfdcId: string, sfdcType: string): string {
  if (sfdcType === 'lead') return `https://okta.lightning.force.com/lightning/r/Lead/${sfdcId}/view`;
  if (sfdcType === 'contact') return `https://okta.lightning.force.com/lightning/r/Contact/${sfdcId}/view`;
  return `https://okta.lightning.force.com/lightning/r/${sfdcId}/view`;
}

function roleBadgeColor(role: string) {
  switch (role) {
    case 'decision_maker': return 'bg-red-100 text-red-700 border-red-200';
    case 'champion': return 'bg-green-100 text-green-700 border-green-200';
    case 'influencer': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'blocker': return 'bg-orange-100 text-orange-700 border-orange-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

// ============================================================
// ProspectTableRow — memoized so only re-renders when its own
// data, selection state, or editing column actually changes.
// Selecting a checkbox or clicking a cell in one row no longer
// triggers a re-render of every other row in the table.
// ============================================================

type ColumnDef = { key: keyof ProspectRow; label: string; width: string; crossOnly?: boolean };

interface ProspectTableRowProps {
  row: ProspectRow;
  isSelected: boolean;
  editingCol: keyof ProspectRow | null;
  visibleColumns: ColumnDef[];
  isCross: boolean;
  onToggleSelect: (key: string) => void;
  onCellClick: (rowKey: string, col: keyof ProspectRow) => void;
  onCellChange: (rowKey: string, col: keyof ProspectRow, value: string) => void;
  onCellBlur: (rowKey: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent, rowKey: string, col: keyof ProspectRow) => void;
}

const ProspectTableRow = memo(function ProspectTableRow({
  row,
  isSelected,
  editingCol,
  visibleColumns,
  isCross,
  onToggleSelect,
  onCellClick,
  onCellChange,
  onCellBlur,
  onCellKeyDown,
}: ProspectTableRowProps) {
  const rowKey = row._key;

  const renderCell = (col: keyof ProspectRow) => {
    const isEditing = editingCol === col;
    const value = (row[col] as string) || '';

    if (isEditing) {
      if (col === 'prospect_status') {
        return (
          <select
            autoFocus
            value={value || 'active'}
            onChange={(e) => { onCellChange(rowKey, col, e.target.value); setTimeout(() => onCellBlur(rowKey), 0); }}
            onBlur={() => onCellBlur(rowKey)}
            onKeyDown={(e) => onCellKeyDown(e, rowKey, col)}
            className="w-full rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{statusLabel(opt)}</option>
            ))}
          </select>
        );
      }

      if (col === 'relationship_status') {
        return (
          <select
            autoFocus
            value={value || 'new'}
            onChange={(e) => { onCellChange(rowKey, col, e.target.value); setTimeout(() => onCellBlur(rowKey), 0); }}
            onBlur={() => onCellBlur(rowKey)}
            onKeyDown={(e) => onCellKeyDown(e, rowKey, col)}
            className="w-full rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {REL_STATUS_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }

      if (col === 'role_type') {
        return (
          <select
            autoFocus
            value={value}
            onChange={(e) => { onCellChange(rowKey, col, e.target.value); setTimeout(() => onCellBlur(rowKey), 0); }}
            onBlur={() => onCellBlur(rowKey)}
            onKeyDown={(e) => onCellKeyDown(e, rowKey, col)}
            className="w-full rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ROLE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt ? opt.replace(/_/g, ' ') : '(none)'}</option>
            ))}
          </select>
        );
      }

      if (col === 'notes') {
        return (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onCellChange(rowKey, col, e.target.value)}
            onBlur={() => onCellBlur(rowKey)}
            onKeyDown={(e) => onCellKeyDown(e, rowKey, col)}
            rows={2}
            className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        );
      }

      return (
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => onCellChange(rowKey, col, e.target.value)}
          onBlur={() => onCellBlur(rowKey)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCellBlur(rowKey);
            onCellKeyDown(e, rowKey, col);
          }}
          className="w-full rounded border border-blue-300 px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      );
    }

    // Display mode
    if (col === 'prospect_status') {
      const s = value || 'active';
      return (
        <Badge variant="outline" className={`text-[10px] ${statusBadgeColor(s)}`}>
          {statusLabel(s)}
        </Badge>
      );
    }

    if (col === 'relationship_status') {
      const s = value || 'new';
      return (
        <Badge variant="outline" className={`text-[10px] ${relStatusBadgeColor(s)}`}>
          {s}
        </Badge>
      );
    }

    if (col === 'role_type' && value) {
      return (
        <Badge variant="outline" className={`text-[10px] ${roleBadgeColor(value)}`}>
          {value.replace(/_/g, ' ')}
        </Badge>
      );
    }

    if (col === 'linkedin_url' && value) {
      return (
        <span className="flex items-center gap-1 truncate">
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:underline truncate"
          >
            {value.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}
          </a>
        </span>
      );
    }

    if (col === 'sfdc_id' && value) {
      const type = row.sfdc_type;
      const isLead = type === 'lead';
      return (
        <a
          href={sfdcUrl(value, type)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1"
        >
          <Badge
            variant="outline"
            className={`text-[10px] ${isLead ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}
          >
            {isLead ? 'Lead' : 'Contact'}
            <ExternalLink className="ml-0.5 h-2.5 w-2.5" />
          </Badge>
        </a>
      );
    }

    if (col === 'company_name' && value) {
      return <span className="truncate block font-medium text-gray-700">{value}</span>;
    }

    if (!value) {
      return <span className="truncate block text-gray-300 opacity-0 group-hover/cell:opacity-100 transition-opacity">--</span>;
    }

    return <span className="truncate block">{value}</span>;
  };

  return (
    <TableRow
      className={`${isSelected ? 'bg-blue-50' : ''} ${row.id === null ? 'bg-yellow-50/50' : ''}`}
    >
      <TableCell className="px-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(rowKey)}
        />
      </TableCell>
      {visibleColumns.map(col => {
        const hasLink = (col.key === 'linkedin_url' && row.linkedin_url) || (col.key === 'sfdc_id' && row.sfdc_id);
        const isReadOnly = isCross && col.key === 'company_name';
        return (
          <TableCell
            key={col.key}
            className={`${col.width} ${isReadOnly ? 'cursor-default' : 'cursor-text'} px-2 py-1.5 text-xs group/cell`}
            onClick={hasLink || isReadOnly ? undefined : () => onCellClick(rowKey, col.key)}
            onDoubleClick={hasLink ? () => onCellClick(rowKey, col.key) : undefined}
          >
            {renderCell(col.key)}
          </TableCell>
        );
      })}
    </TableRow>
  );
});

// ============================================================

type ViewMode = 'single' | 'cross';

interface SpreadsheetTableProps {
  accountId?: number;
  viewMode?: ViewMode;
  accountIds?: number[];
  prospectStatusFilter?: string;
  relationshipStatusFilter?: string;
  onBulkStatusUpdate?: (updates: { ids: number[]; prospect_status?: string; relationship_status?: string }) => Promise<void>;
  refreshKey?: number;
}

export default function SpreadsheetTable({
  accountId,
  viewMode = 'single',
  accountIds,
  prospectStatusFilter,
  relationshipStatusFilter,
  onBulkStatusUpdate,
  refreshKey = 0,
}: SpreadsheetTableProps) {
  const [rows, setRows] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowKey: string; col: keyof ProspectRow } | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(loadHiddenCols);
  const [showColMenu, setShowColMenu] = useState(false);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteImporting, setPasteImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const lastBlurRef = useRef<{ key: string; time: number } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: 'saving' | 'saved' | 'error'; message?: string } | null>(null);

  // Refs for stable callbacks — updated every render, never cause re-renders
  const rowsRef = useRef<ProspectRow[]>([]);
  rowsRef.current = rows;
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;
  const preEditRowRef = useRef<ProspectRow | null>(null);

  const showSaveStatus = useCallback((type: 'saved' | 'error', message?: string) => {
    setSaveStatus({ type, message });
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus(null), type === 'error' ? 4000 : 2000);
  }, []);

  // Bulk update bar state
  const [bulkProspectStatus, setBulkProspectStatus] = useState('');
  const [bulkRelStatus, setBulkRelStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const isCross = viewMode === 'cross';

  // Memoized — only recomputes when columns or hidden state changes
  const visibleColumns = useMemo(
    () => COLUMNS.filter(c => !(c.crossOnly && !isCross) && !hiddenCols.has(c.key)),
    [isCross, hiddenCols]
  );

  // Kept as ref so tab-navigation callback stays stable
  const visibleColumnsRef = useRef(visibleColumns);
  visibleColumnsRef.current = visibleColumns;

  const toggleColumn = (key: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem('spreadsheet_hidden_cols', JSON.stringify([...next]));
      return next;
    });
  };

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      let data: any;

      if (isCross) {
        const params = new URLSearchParams();
        params.set('limit', '1000');
        if (prospectStatusFilter) params.set('prospectStatus', prospectStatusFilter);
        if (relationshipStatusFilter) params.set('relationshipStatus', relationshipStatusFilter);
        if (accountIds && accountIds.length > 0) params.set('accountIds', accountIds.join(','));

        const res = await fetch(`/api/prospects?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch');
        data = await res.json();
      } else {
        if (!accountId) { setLoading(false); return; }
        const res = await fetch(`/api/accounts/${accountId}/prospects`);
        if (!res.ok) throw new Error('Failed to fetch');
        data = await res.json();
      }

      setRows((data.prospects || []).map((p: any) => ({
        id: p.id,
        _key: `id-${p.id}`,
        account_id: p.account_id,
        company_name: p.company_name || '',
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        title: p.title || '',
        email: p.email || '',
        mobile: p.mobile || '',
        enriched_mobile: p.enriched_mobile || '',
        linkedin_url: p.linkedin_url || '',
        sfdc_id: p.sfdc_id || '',
        sfdc_type: p.sfdc_type || '',
        department: p.department || '',
        role_type: p.role_type || '',
        prospect_status: p.prospect_status || 'active',
        relationship_status: p.relationship_status || 'new',
        notes: p.notes || '',
      })));
    } catch (err) {
      console.error('Failed to fetch prospects:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, isCross, accountIds, prospectStatusFilter, relationshipStatusFilter]);

  useEffect(() => {
    fetchProspects();
    setSelected(new Set());
    setEditingCell(null);
    setSortField(null);
    setSortAsc(true);
    setBulkProspectStatus('');
    setBulkRelStatus('');
  }, [fetchProspects, refreshKey]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Memoized — only recomputes when rows or sort state changes
  const sortedRows = useMemo(
    () => sortField
      ? [...rows].sort((a, b) => {
          const aVal = (a[sortField] || '').toLowerCase();
          const bVal = (b[sortField] || '').toLowerCase();
          return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        })
      : rows,
    [rows, sortField, sortAsc]
  );

  // Kept as ref so tab-navigation callback stays stable
  const sortedRowsRef = useRef(sortedRows);
  sortedRowsRef.current = sortedRows;

  // Stable: only recreates when isCross changes (i.e. never during normal use)
  const handleCellClick = useCallback((rowKey: string, col: keyof ProspectRow) => {
    if (col === 'id' || col === '_key' || col === 'sfdc_type' || col === 'account_id') return;
    if (isCross && col === 'company_name') return;
    if (!editingCellRef.current || editingCellRef.current.rowKey !== rowKey) {
      const row = rowsRef.current.find(r => r._key === rowKey);
      if (row) preEditRowRef.current = { ...row };
    }
    setEditingCell({ rowKey, col });
  }, [isCross]);

  // Stable: setRows is always the same reference
  const handleCellChange = useCallback((rowKey: string, col: keyof ProspectRow, value: string) => {
    setRows(prev => prev.map(r => r._key === rowKey ? { ...r, [col]: value } : r));
  }, []);

  // Stable: deps are primitives that only change on account switch
  const handleCellBlur = useCallback(async (rowKey: string) => {
    const now = Date.now();
    if (lastBlurRef.current?.key === rowKey && now - lastBlurRef.current.time < 100) {
      setEditingCell(null);
      return;
    }
    lastBlurRef.current = { key: rowKey, time: now };
    setEditingCell(null);

    const row = rowsRef.current.find(r => r._key === rowKey);
    if (!row) return;

    const snapshot = preEditRowRef.current;
    preEditRowRef.current = null;

    const targetAccountId = isCross ? row.account_id : accountId;
    if (!targetAccountId) return;

    const rollback = () => {
      if (snapshot) {
        setRows(prev => prev.map(r => r._key === rowKey ? { ...snapshot } : r));
      }
    };

    if (row.id === null) {
      if (row.first_name.trim() && row.last_name.trim()) {
        setSaveStatus({ type: 'saving' });
        try {
          const res = await fetch(`/api/accounts/${targetAccountId}/prospects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              first_name: row.first_name.trim(),
              last_name: row.last_name.trim(),
              title: row.title || undefined,
              email: row.email || undefined,
              mobile: row.mobile || undefined,
              enriched_mobile: row.enriched_mobile || undefined,
              linkedin_url: row.linkedin_url || undefined,
              sfdc_id: row.sfdc_id || undefined,
              sfdc_type: row.sfdc_type || undefined,
              department: row.department || undefined,
              role_type: row.role_type || undefined,
              prospect_status: row.prospect_status || 'active',
              relationship_status: row.relationship_status || 'new',
              notes: row.notes || undefined,
            }),
          });
          if (res.ok) {
            const created = await res.json();
            const newKey = `id-${created.id}`;
            setRows(prev => prev.map(r => r._key === rowKey ? { ...r, id: created.id, _key: newKey } : r));
            showSaveStatus('saved');
          } else {
            rollback();
            showSaveStatus('error', 'Failed to create — reverted');
          }
        } catch (err) {
          console.error('Failed to create prospect:', err);
          rollback();
          showSaveStatus('error', 'Failed to create — reverted');
        }
      }
    } else {
      setSaveStatus({ type: 'saving' });
      try {
        const res = await fetch(`/api/accounts/${targetAccountId}/prospects/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: row.first_name,
            last_name: row.last_name,
            title: row.title || null,
            email: row.email || null,
            mobile: row.mobile || null,
            enriched_mobile: row.enriched_mobile || null,
            linkedin_url: row.linkedin_url || null,
            sfdc_id: row.sfdc_id || null,
            sfdc_type: row.sfdc_type || null,
            department: row.department || null,
            role_type: row.role_type || null,
            prospect_status: row.prospect_status || 'active',
            relationship_status: row.relationship_status || 'new',
            notes: row.notes || null,
          }),
        });
        if (res.ok) {
          showSaveStatus('saved');
        } else {
          rollback();
          showSaveStatus('error', 'Save failed — reverted');
        }
      } catch (err) {
        console.error('Failed to update prospect:', err);
        rollback();
        showSaveStatus('error', 'Save failed — reverted');
      }
    }
  }, [isCross, accountId, showSaveStatus]);

  // Stable: refs provide current values without causing recreations
  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, rowKey: string, col: keyof ProspectRow) => {
    if (e.key === 'Escape') {
      handleCellBlur(rowKey);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      handleCellBlur(rowKey);
      const cols = visibleColumnsRef.current;
      const sRows = sortedRowsRef.current;
      const colIdx = cols.findIndex(c => c.key === col);
      const nextCol = cols[colIdx + 1];
      if (nextCol) {
        setTimeout(() => handleCellClick(rowKey, nextCol.key), 0);
      } else {
        const currentRowIdx = sRows.findIndex(r => r._key === rowKey);
        const nextRow = sRows[currentRowIdx + 1];
        if (nextRow) {
          const firstEditableCol = cols.find(c => !(isCross && c.key === 'company_name'));
          if (firstEditableCol) {
            setTimeout(() => handleCellClick(nextRow._key, firstEditableCol.key), 0);
          }
        }
      }
    }
  }, [handleCellBlur, handleCellClick, isCross]);

  const handleAddRow = () => {
    const newRow = emptyRow();
    setRows(prev => [...prev, newRow]);
    setTimeout(() => {
      setEditingCell({ rowKey: newRow._key, col: 'first_name' });
    }, 0);
  };

  const handleDeleteSelected = async () => {
    const rowsToDelete = rowsRef.current.filter(r => selected.has(r._key));
    for (const row of rowsToDelete) {
      if (row.id) {
        const targetAccountId = isCross ? row.account_id : accountId;
        if (!targetAccountId) continue;
        try {
          await fetch(`/api/accounts/${targetAccountId}/prospects/${row.id}`, { method: 'DELETE' });
        } catch (err) {
          console.error('Failed to delete prospect:', err);
        }
      }
    }
    setRows(prev => prev.filter(r => !selected.has(r._key)));
    setSelected(new Set());
    setShowDeleteConfirm(false);
  };

  const handleBulkUpdate = async () => {
    if (!onBulkStatusUpdate || bulkUpdating) return;
    const selectedIds = rowsRef.current.filter(r => selected.has(r._key) && r.id).map(r => r.id as number);
    if (selectedIds.length === 0) return;
    if (!bulkProspectStatus && !bulkRelStatus) return;

    setBulkUpdating(true);
    try {
      await onBulkStatusUpdate({
        ids: selectedIds,
        prospect_status: bulkProspectStatus || undefined,
        relationship_status: bulkRelStatus || undefined,
      });
      setRows(prev => prev.map(r => {
        if (!selected.has(r._key)) return r;
        const updated = { ...r };
        if (bulkProspectStatus) updated.prospect_status = bulkProspectStatus;
        if (bulkRelStatus) updated.relationship_status = bulkRelStatus;
        return updated;
      }));
      setSelected(new Set());
      setBulkProspectStatus('');
      setBulkRelStatus('');
    } catch (err) {
      console.error('Bulk update failed:', err);
    } finally {
      setBulkUpdating(false);
    }
  };

  const handlePasteImport = async () => {
    if (!pasteText.trim() || pasteImporting || !accountId) return;
    setPasteImporting(true);
    setImportResult(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/prospects/import-paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      if (!res.ok) {
        const err = await res.json();
        setImportResult(`Error: ${err.error}`);
        return;
      }
      const data = await res.json();
      setImportResult(`Created ${data.created}, skipped ${data.skipped} (of ${data.parsed} parsed)`);
      setPasteText('');
      fetchProspects();
    } catch {
      setImportResult('Import failed');
    } finally {
      setPasteImporting(false);
    }
  };

  // Stable: setSelected is always the same reference
  const toggleSelect = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(r => r._key)));
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  const availableColumns = COLUMNS.filter(c => !c.crossOnly || isCross);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {!isCross && (
            <>
              <Button size="sm" variant="outline" onClick={handleAddRow} className="h-8 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Row
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowPasteDialog(true)} className="h-8 gap-1.5 text-xs">
                <ClipboardPaste className="h-3.5 w-3.5" /> Paste
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowColMenu(!showColMenu)}
              className="h-8 gap-1.5 text-xs text-gray-500"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
            {showColMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColMenu(false)} />
                <div
                  ref={colMenuRef}
                  className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {availableColumns.map(col => (
                    <label
                      key={col.key}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-gray-300"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <span className="text-xs text-gray-500">{rows.length} prospect{rows.length !== 1 ? 's' : ''}</span>
          {saveStatus && (
            <span className={`text-xs font-medium ${
              saveStatus.type === 'saving' ? 'text-gray-400' :
              saveStatus.type === 'saved' ? 'text-green-600' : 'text-red-600'
            }`}>
              {saveStatus.type === 'saving' ? 'Saving...' :
               saveStatus.type === 'saved' ? 'Saved' :
               saveStatus.message || 'Save failed'}
            </span>
          )}
          {selected.size > 0 && (
            showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Delete {selected.size} prospect{selected.size !== 1 ? 's' : ''}?</span>
                <Button size="sm" variant="destructive" onClick={() => { handleDeleteSelected(); setShowDeleteConfirm(false); }} className="h-7 text-xs">
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="h-7 text-xs">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="h-8 gap-1.5 text-xs">
                <Trash2 className="h-3.5 w-3.5" /> Delete ({selected.size})
              </Button>
            )
          )}
        </div>
      </div>

      {/* Bulk update bar (cross-account mode) */}
      {selected.size > 0 && isCross && (
        <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-xs font-medium text-blue-800">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <select
              value={bulkProspectStatus}
              onChange={(e) => setBulkProspectStatus(e.target.value)}
              className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Prospect Status...</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{statusLabel(opt)}</option>
              ))}
            </select>
            <select
              value={bulkRelStatus}
              onChange={(e) => setBulkRelStatus(e.target.value)}
              className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Rel. Status...</option>
              {REL_STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleBulkUpdate}
              disabled={bulkUpdating || (!bulkProspectStatus && !bulkRelStatus)}
              className="h-7 text-xs"
            >
              {bulkUpdating ? 'Updating...' : 'Update'}
            </Button>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-7 gap-1.5 text-xs"
          >
            <Trash2 className="h-3 w-3" /> Delete ({selected.size})
          </Button>
          <button
            onClick={() => { setSelected(new Set()); setBulkProspectStatus(''); setBulkRelStatus(''); setShowDeleteConfirm(false); }}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            {isCross ? 'No prospects match your filters' : 'No prospects yet'}
          </p>
          {!isCross && (
            <p className="mt-1 text-xs text-gray-400">Add a row, upload a CSV, or paste from your clipboard</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] px-2">
                  <Checkbox
                    checked={selected.size === rows.length && rows.length > 0 ? true : selected.size > 0 ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                {visibleColumns.map(col => (
                  <TableHead
                    key={col.key}
                    className={`${col.width} cursor-pointer select-none px-2 text-xs`}
                    onClick={() => handleSort(col.key as SortField)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && (
                        <ArrowUpDown className="h-3 w-3 text-gray-400" />
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <ProspectTableRow
                  key={row._key}
                  row={row}
                  isSelected={selected.has(row._key)}
                  editingCol={editingCell?.rowKey === row._key ? editingCell.col : null}
                  visibleColumns={visibleColumns}
                  isCross={isCross}
                  onToggleSelect={toggleSelect}
                  onCellClick={handleCellClick}
                  onCellChange={handleCellChange}
                  onCellBlur={handleCellBlur}
                  onCellKeyDown={handleCellKeyDown}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paste Dialog */}
      {showPasteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !pasteImporting) {
              setShowPasteDialog(false); setPasteText(''); setImportResult(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Paste Prospects</h3>
            <p className="mt-1 text-sm text-gray-500">
              Paste contact data from ZoomInfo, Excel, or any tab-separated source.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && pasteText.trim() && !pasteImporting) {
                  handlePasteImport();
                }
              }}
              placeholder="Paste tab-separated data here... (⌘+Enter to import)"
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[150px] resize-y"
            />
            {importResult && (
              <p className={`mt-2 text-sm ${importResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {importResult}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" disabled={pasteImporting} onClick={() => { setShowPasteDialog(false); setPasteText(''); setImportResult(null); }}>
                Cancel
              </Button>
              <Button onClick={handlePasteImport} disabled={!pasteText.trim() || pasteImporting}>
                {pasteImporting ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
