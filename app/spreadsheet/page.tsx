'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AccountTabBar from '@/components/spreadsheet/AccountTabBar';
import PerspectiveSection from '@/components/spreadsheet/PerspectiveSection';
import MessagingSection from '@/components/spreadsheet/MessagingSection';
import SpreadsheetTable from '@/components/spreadsheet/SpreadsheetTable';
import ProspectOrgMap from '@/components/spreadsheet/ProspectOrgMap';
import CSVImportDialog from '@/components/spreadsheet/CSVImportDialog';

type ViewMode = 'single' | 'cross';

interface AccountSummary {
  id: number;
  companyName: string;
  domain: string;
  tier: string | null;
}

interface SpreadsheetData {
  status: string;
  sdrNotes: string | null;
  commandOfMessage: string | null;
  spreadsheetPerspective: string | null;
  spreadsheetMessaging: string | null;
}

function loadViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem('spreadsheet_view_mode');
    if (saved === 'cross') return 'cross';
  } catch { /* ignore */ }
  return 'single';
}

export default function SpreadsheetPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Cross-account state
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [prospectStatusFilter, setProspectStatusFilter] = useState('');
  const [relationshipStatusFilter, setRelationshipStatusFilter] = useState('');

  // Refs for zero-allocation caching — no re-renders when these change
  const accountMapRef = useRef<Map<number, AccountSummary>>(new Map());
  const prefetchCacheRef = useRef<Map<number, SpreadsheetData>>(new Map());
  const activeFetchIdRef = useRef<number | null>(null);

  const fetchSpreadsheetData = useCallback(async (id: number): Promise<SpreadsheetData | null> => {
    const cached = prefetchCacheRef.current.get(id);
    if (cached) return cached;
    try {
      const res = await fetch(`/api/accounts/${id}/spreadsheet-data`);
      if (!res.ok) return null;
      const data: SpreadsheetData = await res.json();
      prefetchCacheRef.current.set(id, data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const handleSelectAccount = useCallback(async (id: number) => {
    if (id === activeFetchIdRef.current) return;
    activeFetchIdRef.current = id;
    setSelectedAccountId(id);
    localStorage.setItem('spreadsheet_account_id', String(id));

    // Render header immediately from tab list data
    const tabAccount = accountMapRef.current.get(id);
    if (tabAccount) setSelectedAccount(tabAccount);

    // Show cached data immediately if available, otherwise blank the sections
    const cached = prefetchCacheRef.current.get(id);
    setSpreadsheetData(cached ?? null);

    const data = await fetchSpreadsheetData(id);
    // Guard against stale response if user switched accounts mid-flight
    if (activeFetchIdRef.current === id) {
      setSpreadsheetData(data);
    }
  }, [fetchSpreadsheetData]);

  const handlePrefetch = useCallback((id: number) => {
    fetchSpreadsheetData(id); // fire-and-forget; result stored in cache
  }, [fetchSpreadsheetData]);

  const handleAccountsLoaded = useCallback((accounts: AccountSummary[]) => {
    accounts.forEach(a => accountMapRef.current.set(a.id, a));
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('spreadsheet_view_mode', mode);
  };

  const handleToggleAccountId = (id: number) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveField = async (field: 'spreadsheetPerspective' | 'spreadsheetMessaging', value: string) => {
    if (!selectedAccountId) return;
    try {
      await fetch(`/api/accounts/${selectedAccountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      setSpreadsheetData(prev => prev ? { ...prev, [field]: value } : null);
      // Keep cache in sync
      const cached = prefetchCacheRef.current.get(selectedAccountId);
      if (cached) prefetchCacheRef.current.set(selectedAccountId, { ...cached, [field]: value });
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  const handleBulkStatusUpdate = async (updates: {
    ids: number[];
    prospect_status?: string;
    relationship_status?: string;
  }) => {
    const res = await fetch('/api/prospects/bulk-update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Update failed');
    }
    setRefreshKey(k => k + 1);
  };

  const handleImportComplete = useCallback(() => {
    setRefreshKey(k => k + 1);
    if (selectedAccountId) {
      // Bust cache so next selection re-fetches fresh data
      prefetchCacheRef.current.delete(selectedAccountId);
      fetchSpreadsheetData(selectedAccountId).then(data => {
        if (activeFetchIdRef.current === selectedAccountId && data) {
          setSpreadsheetData(data);
        }
      });
    }
  }, [selectedAccountId, fetchSpreadsheetData]);

  const isCross = viewMode === 'cross';
  const hasActiveFilters = !!(prospectStatusFilter || relationshipStatusFilter);
  const spreadsheetDataReady = spreadsheetData !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Spreadsheet</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isCross
              ? 'View and manage prospects across accounts'
              : 'Manage prospects, perspective, and messaging per account'}
          </p>
        </div>
        {!isCross && (
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)} className="gap-1.5">
            <Upload className="h-4 w-4" /> Import Salesforce Report
          </Button>
        )}
      </div>

      <CSVImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImportComplete={handleImportComplete}
        onNavigateToAccount={(id) => handleSelectAccount(id)}
      />

      <AccountTabBar
        selectedAccountId={selectedAccountId}
        onSelectAccount={handleSelectAccount}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        selectedAccountIds={selectedAccountIds}
        onToggleAccountId={handleToggleAccountId}
        refreshKey={refreshKey}
        onAccountsLoaded={handleAccountsLoaded}
        onPrefetch={isCross ? undefined : handlePrefetch}
      />

      {isCross ? (
        /* Cross-account mode */
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filters</span>
            <select
              value={prospectStatusFilter}
              onChange={(e) => setProspectStatusFilter(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Prospect Status</option>
              <option value="active">Active</option>
              <option value="working">Working</option>
              <option value="nurture">Nurture</option>
              <option value="unqualified">Unqualified</option>
              <option value="no_longer_at_company">Left Company</option>
            </select>
            <select
              value={relationshipStatusFilter}
              onChange={(e) => setRelationshipStatusFilter(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Relationship Status</option>
              <option value="new">New</option>
              <option value="engaged">Engaged</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { setProspectStatusFilter(''); setRelationshipStatusFilter(''); }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            )}
          </div>

          <SpreadsheetTable
            viewMode="cross"
            accountIds={selectedAccountIds.size > 0 ? [...selectedAccountIds] : undefined}
            prospectStatusFilter={prospectStatusFilter}
            relationshipStatusFilter={relationshipStatusFilter}
            onBulkStatusUpdate={handleBulkStatusUpdate}
            refreshKey={refreshKey}
          />
        </div>
      ) : (
        /* Single-account mode */
        <>
          {selectedAccount ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{selectedAccount.companyName}</h2>
                {selectedAccount.domain && selectedAccount.domain !== 'No domain' && (
                  <span className="text-sm text-gray-400">{selectedAccount.domain}</span>
                )}
              </div>

              {spreadsheetDataReady ? (
                <>
                  <PerspectiveSection
                    value={spreadsheetData.spreadsheetPerspective || ''}
                    existingNotes={spreadsheetData.sdrNotes}
                    accountId={selectedAccount.id}
                    researchCompleted={spreadsheetData.status === 'completed'}
                    onSave={(val) => handleSaveField('spreadsheetPerspective', val)}
                  />

                  <MessagingSection
                    value={spreadsheetData.spreadsheetMessaging || ''}
                    existingMessage={spreadsheetData.commandOfMessage}
                    accountId={selectedAccount.id}
                    researchCompleted={spreadsheetData.status === 'completed'}
                    onSave={(val) => handleSaveField('spreadsheetMessaging', val)}
                  />
                </>
              ) : (
                <>
                  <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
                  <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
                </>
              )}

              <SpreadsheetTable accountId={selectedAccount.id} refreshKey={refreshKey} />

              <ProspectOrgMap accountId={selectedAccount.id} refreshKey={refreshKey} />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
              Select an account above to get started
            </div>
          )}
        </>
      )}
    </div>
  );
}
