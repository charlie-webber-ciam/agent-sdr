'use client';

import { useState, useRef, useEffect } from 'react';

const PRESET_TAGS = [
  'Current Auth0 Customer',
  'Current Okta Customer',
  'Common Customer (Auth0 + Okta)',
  'Former Auth0 Customer',
  'Former Okta Customer',
  'Competitor Customer',
  'Partner',
  'Strategic Account',
  'Do Not Contact',
];

const TAG_COLORS: Record<string, string> = {
  'Current Auth0 Customer': 'bg-blue-100 text-blue-800 border-blue-200',
  'Current Okta Customer': 'bg-purple-100 text-purple-800 border-purple-200',
  'Common Customer (Auth0 + Okta)': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Former Auth0 Customer': 'bg-blue-50 text-blue-600 border-blue-100',
  'Former Okta Customer': 'bg-purple-50 text-purple-600 border-purple-100',
  'Competitor Customer': 'bg-orange-100 text-orange-800 border-orange-200',
  'Partner': 'bg-green-100 text-green-800 border-green-200',
  'Strategic Account': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Do Not Contact': 'bg-red-100 text-red-800 border-red-200',
};

interface Tag {
  id: number;
  tag: string;
  tagType: string;
  createdAt: string;
}

interface AccountTagsProps {
  accountId: number;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

export default function AccountTags({ accountId, tags, onTagsChange }: AccountTagsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const existingTagNames = new Set(tags.map(t => t.tag));

  const addTag = async (tag: string, tagType: 'preset' | 'custom') => {
    if (existingTagNames.has(tag)) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, tagType }),
      });
      if (res.ok) {
        const data = await res.json();
        onTagsChange([...tags, data.tag]);
      }
    } catch (err) {
      console.error('Failed to add tag:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const removeTag = async (tag: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      });
      if (res.ok) {
        onTagsChange(tags.filter(t => t.tag !== tag));
      }
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (trimmed && !existingTagNames.has(trimmed)) {
      addTag(trimmed, 'custom');
      setCustomInput('');
    }
  };

  const getTagColor = (tag: string, tagType: string) => {
    if (TAG_COLORS[tag]) return TAG_COLORS[tag];
    if (tagType === 'custom') return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span
          key={t.id}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getTagColor(t.tag, t.tagType)}`}
        >
          {t.tag}
          <button
            onClick={() => removeTag(t.tag)}
            className="ml-0.5 hover:text-red-600 transition-colors"
            title="Remove tag"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isAdding}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-dashed border-gray-300 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add tag
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-y-auto">
            <div className="p-2 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">Preset Tags</p>
              {PRESET_TAGS.map((preset) => {
                const exists = existingTagNames.has(preset);
                return (
                  <button
                    key={preset}
                    onClick={() => { if (!exists) addTag(preset, 'preset'); }}
                    disabled={exists}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                      exists
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {exists && (
                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {preset}
                    </span>
                  </button>
                );
              })}
            </div>
            <form onSubmit={handleCustomSubmit} className="p-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">Custom Tag</p>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Type a custom tag..."
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={64}
                />
                <button
                  type="submit"
                  disabled={!customInput.trim() || existingTagNames.has(customInput.trim())}
                  className="px-2 py-1.5 text-xs bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
