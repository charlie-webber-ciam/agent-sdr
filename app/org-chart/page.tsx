'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, Loader2, AlertTriangle, Search, Link2, Unlink, Trash2, ChevronDown, ChevronUp, Users, FileText } from 'lucide-react';
import OrgChartTree from '@/components/OrgChartTree';

interface OrgChartSummary {
  id: number;
  name: string;
  account_id: number | null;
  total_people: number;
  validation_notes: string | null;
  account_name?: string;
  created_at: string;
}

interface OrgChartPerson {
  id: number;
  chart_id: number;
  name: string;
  title: string | null;
  department: string | null;
  email: string | null;
  linkedin_url: string | null;
  manager_id: number | null;
  level: number;
}

interface OrgChartFull extends OrgChartSummary {
  people: OrgChartPerson[];
}

interface AccountResult {
  id: number;
  company_name: string;
  domain: string | null;
  industry: string;
}

export default function OrgChartPage() {
  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active chart state
  const [activeChart, setActiveChart] = useState<OrgChartFull | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);

  // Saved charts
  const [savedCharts, setSavedCharts] = useState<OrgChartSummary[]>([]);
  const [showSaved, setShowSaved] = useState(true);

  // Account linking
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState<AccountResult[]>([]);
  const [searchingAccounts, setSearchingAccounts] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load saved charts
  const loadSavedCharts = useCallback(async () => {
    try {
      const res = await fetch('/api/org-chart');
      if (res.ok) {
        const data = await res.json();
        setSavedCharts(data.charts || []);
      }
    } catch {
      // Silently fail for list load
    }
  }, []);

  useEffect(() => {
    loadSavedCharts();
  }, [loadSavedCharts]);

  // Upload handler
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/org-chart/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed');
        return;
      }

      // Load the newly created chart
      await loadChart(data.chartId);
      await loadSavedCharts();
      setFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Load a specific chart
  const loadChart = async (chartId: number) => {
    setLoadingChart(true);
    try {
      const res = await fetch(`/api/org-chart/${chartId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveChart(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingChart(false);
    }
  };

  // Account search
  useEffect(() => {
    if (accountSearch.length < 2) {
      setAccountResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingAccounts(true);
      try {
        const res = await fetch(`/api/accounts?search=${encodeURIComponent(accountSearch)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setAccountResults(data.accounts || []);
        }
      } catch {
        // Silently fail
      } finally {
        setSearchingAccounts(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [accountSearch]);

  // Attach chart to account
  const handleAttach = async (accountId: number) => {
    if (!activeChart) return;
    setAttaching(true);
    try {
      const res = await fetch(`/api/org-chart/${activeChart.id}/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveChart(data);
        setAccountSearch('');
        setAccountResults([]);
        await loadSavedCharts();
      }
    } catch {
      // Silently fail
    } finally {
      setAttaching(false);
    }
  };

  // Detach chart from account
  const handleDetach = async () => {
    if (!activeChart) return;
    setAttaching(true);
    try {
      const res = await fetch(`/api/org-chart/${activeChart.id}/attach`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setActiveChart(data);
        await loadSavedCharts();
      }
    } catch {
      // Silently fail
    } finally {
      setAttaching(false);
    }
  };

  // Delete chart
  const handleDelete = async (chartId: number) => {
    try {
      const res = await fetch(`/api/org-chart/${chartId}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeChart?.id === chartId) setActiveChart(null);
        await loadSavedCharts();
      }
    } catch {
      // Silently fail
    } finally {
      setDeletingId(null);
    }
  };

  const warnings: string[] = activeChart?.validation_notes
    ? JSON.parse(activeChart.validation_notes)
    : [];

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Org Chart Builder</h1>
        <p className="text-gray-500 mt-1">Upload a CSV of people to build and visualize an organizational chart</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Upload + Saved Charts */}
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload CSV
            </h2>

            <div
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
              `}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const dropped = e.dataTransfer.files[0];
                if (dropped?.name.endsWith('.csv')) setFile(dropped);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv';
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) setFile(f);
                };
                input.click();
              }}
            >
              {file ? (
                <div>
                  <FileText className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                  <p className="text-sm font-medium text-blue-700">{file.name}</p>
                  <p className="text-xs text-blue-500 mt-1">Click to change file</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Drop a CSV file here or click to browse</p>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-gray-500">
              <p className="font-medium mb-1">Expected columns:</p>
              <p>name, title, department, reports_to, email, linkedin_url</p>
              <p className="mt-1 italic">Only &quot;name&quot; is required. The agent will handle variations.</p>
            </div>

            {uploadError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {uploadError}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="mt-4 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building chart...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload &amp; Build Chart
                </>
              )}
            </button>
          </div>

          {/* Saved Charts */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900"
            >
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Saved Charts ({savedCharts.length})
              </span>
              {showSaved ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showSaved && (
              <div className="mt-4 space-y-2">
                {savedCharts.length === 0 ? (
                  <p className="text-sm text-gray-500">No charts yet. Upload a CSV to get started.</p>
                ) : (
                  savedCharts.map((chart) => (
                    <div
                      key={chart.id}
                      className={`
                        p-3 rounded-lg border cursor-pointer transition-colors
                        ${activeChart?.id === chart.id
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                        }
                      `}
                      onClick={() => loadChart(chart.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{chart.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {chart.total_people} people
                            {chart.account_name && (
                              <span className="ml-2 inline-flex items-center gap-1 text-blue-600">
                                <Link2 className="w-3 h-3" />
                                {chart.account_name}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(chart.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (deletingId === chart.id) {
                              handleDelete(chart.id);
                            } else {
                              setDeletingId(chart.id);
                              setTimeout(() => setDeletingId(null), 3000);
                            }
                          }}
                          className={`ml-2 p-1.5 rounded transition-colors ${
                            deletingId === chart.id
                              ? 'bg-red-100 text-red-600'
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={deletingId === chart.id ? 'Click again to confirm' : 'Delete chart'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Chart Viewer + Account Linking */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Linking */}
          {activeChart && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Link to Account
              </h2>

              {activeChart.account_id ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Linked to: {activeChart.account_name || `Account #${activeChart.account_id}`}
                    </p>
                  </div>
                  <button
                    onClick={handleDetach}
                    disabled={attaching}
                    className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Detach
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      placeholder="Search accounts by name..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchingAccounts && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>

                  {accountResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {accountResults.map((account) => (
                        <button
                          key={account.id}
                          onClick={() => handleAttach(account.id)}
                          disabled={attaching}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                        >
                          <p className="text-sm font-medium text-gray-900">{account.company_name}</p>
                          <p className="text-xs text-gray-500">
                            {account.domain && <span>{account.domain} &middot; </span>}
                            {account.industry}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Chart Viewer */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[400px]">
            {loadingChart ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-500">Loading chart...</span>
              </div>
            ) : activeChart ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{activeChart.name}</h2>
                    <p className="text-sm text-gray-500">{activeChart.total_people} people</p>
                  </div>
                </div>

                {warnings.length > 0 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-800 text-sm font-medium mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Agent Warnings
                    </div>
                    <ul className="text-xs text-amber-700 space-y-1 ml-6 list-disc">
                      {warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <OrgChartTree people={activeChart.people} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Users className="w-16 h-16 mb-4" />
                <p className="text-lg font-medium">No chart selected</p>
                <p className="text-sm mt-1">Upload a CSV or select a saved chart</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
