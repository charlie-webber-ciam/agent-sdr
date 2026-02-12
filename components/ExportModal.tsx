'use client';

import { useState } from 'react';
import { FilterState } from './SearchBar';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccountIds: Set<number>;
  currentFilters: FilterState;
  totalFilteredAccounts: number;
}

type ExportMode = 'selected' | 'filtered';
type ExportFormat = 'csv' | 'json' | 'js';

export default function ExportModal({
  isOpen,
  onClose,
  selectedAccountIds,
  currentFilters,
  totalFilteredAccounts,
}: ExportModalProps) {
  const [exportMode, setExportMode] = useState<ExportMode>(
    selectedAccountIds.size > 0 ? 'selected' : 'filtered'
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSelection = selectedAccountIds.size > 0;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const body: any = { format: exportFormat };

      if (exportMode === 'selected') {
        if (selectedAccountIds.size === 0) {
          throw new Error('No accounts selected');
        }
        body.accountIds = Array.from(selectedAccountIds);
      } else {
        // Convert FilterState to API filter format
        const apiFilters: any = {};
        if (currentFilters.search) apiFilters.search = currentFilters.search;
        if (currentFilters.industry) apiFilters.industry = currentFilters.industry;
        if (currentFilters.status) apiFilters.status = currentFilters.status;
        if (currentFilters.tier) apiFilters.tier = currentFilters.tier;
        if (currentFilters.sku) apiFilters.sku = currentFilters.sku;
        if (currentFilters.useCase) apiFilters.useCase = currentFilters.useCase;
        if (currentFilters.minPriority !== null) apiFilters.minPriority = currentFilters.minPriority;
        if (currentFilters.revenue) apiFilters.revenue = currentFilters.revenue;
        if (currentFilters.accountOwner) apiFilters.accountOwner = currentFilters.accountOwner;
        if (currentFilters.sortBy) apiFilters.sortBy = currentFilters.sortBy;

        body.filters = apiFilters;
      }

      const response = await fetch('/api/accounts/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export accounts');
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `accounts-export.${exportFormat}`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // If JS format, also download the HTML viewer and CSS
      if (exportFormat === 'js') {
        // Download HTML viewer
        setTimeout(async () => {
          try {
            const viewerResponse = await fetch('/viewer.html');
            const viewerBlob = await viewerResponse.blob();
            const viewerUrl = window.URL.createObjectURL(viewerBlob);
            const viewerLink = document.createElement('a');
            viewerLink.href = viewerUrl;
            viewerLink.download = 'accounts-viewer.html';
            document.body.appendChild(viewerLink);
            viewerLink.click();
            window.URL.revokeObjectURL(viewerUrl);
            document.body.removeChild(viewerLink);
          } catch (e) {
            console.error('Failed to download viewer:', e);
          }
        }, 500);

        // Download CSS file
        setTimeout(async () => {
          try {
            const cssResponse = await fetch('/styles.css');
            const cssBlob = await cssResponse.blob();
            const cssUrl = window.URL.createObjectURL(cssBlob);
            const cssLink = document.createElement('a');
            cssLink.href = cssUrl;
            cssLink.download = 'styles.css';
            document.body.appendChild(cssLink);
            cssLink.click();
            window.URL.revokeObjectURL(cssUrl);
            document.body.removeChild(cssLink);
          } catch (e) {
            console.error('Failed to download CSS:', e);
          }
        }, 1000);
      }

      // Close modal on success
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const accountCount = exportMode === 'selected' ? selectedAccountIds.size : totalFilteredAccounts;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Export Accounts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Export Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              What to export
            </label>
            <div className="space-y-2">
              {hasSelection && (
                <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="exportMode"
                    value="selected"
                    checked={exportMode === 'selected'}
                    onChange={(e) => setExportMode(e.target.value as ExportMode)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      Selected accounts ({selectedAccountIds.size})
                    </div>
                    <div className="text-sm text-gray-600">
                      Export only the accounts you've selected
                    </div>
                  </div>
                </label>
              )}
              <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="exportMode"
                  value="filtered"
                  checked={exportMode === 'filtered'}
                  onChange={(e) => setExportMode(e.target.value as ExportMode)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">
                    Current view ({totalFilteredAccounts} accounts)
                  </div>
                  <div className="text-sm text-gray-600">
                    Export all accounts matching your current filters
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Export format
            </label>
            <div className="space-y-2">
              <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    CSV (Spreadsheet)
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                      Recommended
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Best for Excel, Google Sheets, or data analysis
                  </div>
                </div>
              </label>
              <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900">JSON (Structured Data)</div>
                  <div className="text-sm text-gray-600">
                    Best for programmatic access or importing into other systems
                  </div>
                </div>
              </label>
              <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="js"
                  checked={exportFormat === 'js'}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    JavaScript + HTML Viewer
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                      Offline
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Includes interactive HTML viewer - perfect for sharing reports offline
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Export includes complete research data</p>
                <p>All research findings, categorization, prospects, and SDR notes will be included in the export.</p>
                {exportFormat === 'js' && (
                  <p className="mt-2 font-medium">
                    <span className="text-green-700">3 files will download:</span> data.js, accounts-viewer.html, and styles.css
                  </p>
                )}
                {accountCount > 100 && (
                  <p className="mt-2 text-blue-700 font-medium">
                    Note: Exporting {accountCount} accounts may take a moment
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || accountCount === 0}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export {accountCount} Account{accountCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
