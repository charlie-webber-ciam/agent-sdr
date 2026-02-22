'use client';

import { useState } from 'react';

interface Props {
  onListCreated: () => void;
}

const PRESET_CRITERIA = [
  {
    id: 'hvt_tier_a',
    label: 'HVT at Tier A Accounts',
    description: 'High-value targets at top-tier accounts',
    filters: { valueTier: 'HVT', tier: 'A' },
  },
  {
    id: 'decision_makers',
    label: 'Decision Makers - Not Cold',
    description: 'Decision makers with active engagement',
    filters: { roleType: 'decision_maker', relationshipStatus: 'engaged' },
  },
  {
    id: 'c_suite',
    label: 'C-Suite Prospects',
    description: 'C-level executives across all accounts',
    filters: { seniorityLevel: 'c_suite' },
  },
  {
    id: 'warm_leads',
    label: 'Warm Prospects',
    description: 'Prospects currently marked as warm',
    filters: { relationshipStatus: 'warm' },
  },
  {
    id: 'ai_processed',
    label: 'AI-Enriched Prospects',
    description: 'Prospects that have been AI processed',
    filters: { aiProcessed: 'yes' },
  },
  {
    id: 'uncontacted',
    label: 'Never Contacted',
    description: 'New prospects with no calls logged',
    filters: { relationshipStatus: 'new' },
  },
];

const LIST_TYPE_OPTIONS = [
  { value: 'call', label: 'Call List' },
  { value: 'email', label: 'Email List' },
];

export default function ProspectSmartListBuilder({ onListCreated }: Props) {
  const [listName, setListName] = useState('');
  const [listType, setListType] = useState<'call' | 'email'>('call');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customFilters, setCustomFilters] = useState<Record<string, string>>({});
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const activeFilters = selectedPreset
    ? PRESET_CRITERIA.find(p => p.id === selectedPreset)?.filters ?? customFilters
    : customFilters;

  const handlePresetSelect = (id: string) => {
    setSelectedPreset(prev => prev === id ? null : id);
    setPreviewCount(null);
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    setPreviewCount(null);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(activeFilters)) {
        if (v) params.set(k, v);
      }
      params.set('limit', '1');
      params.set('offset', '0');
      const res = await fetch(`/api/prospects?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewCount(data.total ?? 0);
      }
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreate = async () => {
    if (!listName.trim()) {
      setError('Please enter a list name.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // Create the list
      const createRes = await fetch('/api/prospect-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: listName.trim(), list_type: listType }),
      });
      if (!createRes.ok) throw new Error('Failed to create list');
      const { list } = await createRes.json();

      // Fetch all matching prospects
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(activeFilters)) {
        if (v) params.set(k, v);
      }
      params.set('limit', '10000');
      params.set('offset', '0');
      const prospectsRes = await fetch(`/api/prospects?${params.toString()}`);
      if (!prospectsRes.ok) throw new Error('Failed to fetch prospects');
      const { prospects } = await prospectsRes.json();

      if (prospects && prospects.length > 0) {
        // Add all prospects to the list
        const addRes = await fetch(`/api/prospect-lists/${list.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectIds: prospects.map((p: { id: number }) => p.id) }),
        });
        if (!addRes.ok) throw new Error('Failed to add prospects to list');
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onListCreated();
      }, 1500);
    } catch (err) {
      console.error('Create list failed:', err);
      setError('Failed to create list. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Build Smart List</h3>
        <p className="text-sm text-gray-500">
          Choose a preset or configure filters to create a targeted prospect list.
        </p>
      </div>

      {/* Preset Criteria */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Quick Presets</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESET_CRITERIA.map(preset => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.id)}
              className={`text-left p-3 rounded-lg border-2 transition-all ${
                selectedPreset === preset.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  selectedPreset === preset.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                }`}>
                  {selectedPreset === preset.id && (
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{preset.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Active filters summary */}
      {Object.keys(activeFilters).length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Filters</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(activeFilters).map(([k, v]) => (
              <span
                key={k}
                className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
              >
                {k}: {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePreview}
          disabled={loadingPreview || Object.keys(activeFilters).length === 0}
          className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loadingPreview ? 'Checking...' : 'Preview Count'}
        </button>
        {previewCount !== null && (
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{previewCount.toLocaleString()}</span> prospect{previewCount !== 1 ? 's' : ''} match these filters
          </span>
        )}
      </div>

      {/* List configuration */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">List Details</h4>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">List Name</label>
            <input
              type="text"
              value={listName}
              onChange={e => setListName(e.target.value)}
              placeholder="e.g., Q1 HVT Outreach"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={listType}
              onChange={e => setListType(e.target.value as 'call' | 'email')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LIST_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleCreate}
        disabled={creating || success || !listName.trim()}
        className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
          success
            ? 'bg-green-600 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {creating ? 'Creating...' : success ? 'List Created!' : 'Create List'}
      </button>
    </div>
  );
}
