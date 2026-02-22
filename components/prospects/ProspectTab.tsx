'use client';

import { useState, useEffect, useCallback } from 'react';
import ProspectListView from './ProspectListView';
import ProspectHierarchy from './ProspectHierarchy';
import ProspectTreeView from './ProspectTreeView';
import ProspectDetailModal from './ProspectDetailModal';
import ProspectEmailModal from './ProspectEmailModal';
import ProspectListManager from './ProspectListManager';
import { usePerspective } from '@/lib/perspective-context';

export interface Prospect {
  id: number;
  account_id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  linkedin_url: string | null;
  department: string | null;
  notes: string | null;
  role_type: 'decision_maker' | 'champion' | 'influencer' | 'blocker' | 'end_user' | 'unknown' | null;
  relationship_status: 'new' | 'engaged' | 'warm' | 'cold';
  source: 'manual' | 'salesforce_import' | 'ai_research';
  mailing_address: string | null;
  lead_source: string | null;
  last_activity_date: string | null;
  do_not_call: number;
  description: string | null;
  parent_prospect_id: number | null;
  sort_order: number;
  // AI enrichment fields
  value_tier: string | null;
  seniority_level: string | null;
  ai_summary: string | null;
  ai_processed_at: string | null;
  department_tag: string | null;
  call_count: number;
  connect_count: number;
  last_called_at: string | null;
  prospect_tags: string | null;
  created_at: string;
  updated_at: string;
}

type SubTab = 'list' | 'orgchart' | 'tree' | 'lists';

export default function ProspectTab({ accountId }: { accountId: number }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('list');
  const [search, setSearch] = useState('');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [emailingProspect, setEmailingProspect] = useState<Prospect | null>(null);
  const { perspective } = usePerspective();

  const fetchProspects = useCallback(async () => {
    setFetchError(false);
    try {
      const res = await fetch(`/api/accounts/${accountId}/prospects`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setProspects(data.prospects);
    } catch (err) {
      console.error('Failed to fetch prospects:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  const filteredProspects = search
    ? prospects.filter(p => {
        const s = search.toLowerCase();
        return (
          p.first_name.toLowerCase().includes(s) ||
          p.last_name.toLowerCase().includes(s) ||
          (p.title && p.title.toLowerCase().includes(s)) ||
          (p.email && p.email.toLowerCase().includes(s))
        );
      })
    : prospects;

  const handleSelectProspect = (p: Prospect) => {
    setSelectedProspect(p);
    setIsCreating(false);
    setShowModal(true);
  };

  const handleAddProspect = () => {
    setSelectedProspect(null);
    setIsCreating(true);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedProspect(null);
    setIsCreating(false);
  };

  const handleModalSave = () => {
    handleModalClose();
    fetchProspects();
  };

  const handleWriteEmail = (p: Prospect) => {
    setEmailingProspect(p);
  };

  const handleViewExisting = (p: Prospect) => {
    handleModalClose();
    setSelectedProspect(p);
    setIsCreating(false);
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Prospects</h2>
          <span className="px-2.5 py-0.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">
            {prospects.length}
          </span>
        </div>
        <button
          onClick={handleAddProspect}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Prospect
        </button>
      </div>

      {/* Sub-tabs + Search */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {([
            { key: 'list', label: 'List' },
            { key: 'orgchart', label: 'Org Chart' },
            { key: 'tree', label: 'Tree' },
            { key: 'lists', label: 'Lists' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveSubTab(key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeSubTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search prospects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
        />
      </div>

      {/* Content */}
      {fetchError ? (
        <div className="text-center py-12 bg-red-50 rounded-xl border border-red-200">
          <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-red-600 text-sm font-medium">Failed to load prospects</p>
          <button
            onClick={fetchProspects}
            className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium underline"
          >
            Retry
          </button>
        </div>
      ) : filteredProspects.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-500 text-sm">
            {search ? 'No prospects match your search' : 'No prospects yet'}
          </p>
          {!search && (
            <button
              onClick={handleAddProspect}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Add the first prospect
            </button>
          )}
        </div>
      ) : (
        <>
          {activeSubTab === 'list' && (
            <ProspectListView
              prospects={filteredProspects}
              accountId={accountId}
              onRefresh={fetchProspects}
              onSelectProspect={handleSelectProspect}
              onWriteEmail={handleWriteEmail}
            />
          )}
          {activeSubTab === 'orgchart' && (
            <ProspectHierarchy
              prospects={filteredProspects}
              onSelectProspect={handleSelectProspect}
              onWriteEmail={handleWriteEmail}
            />
          )}
          {activeSubTab === 'tree' && (
            <ProspectTreeView
              prospects={filteredProspects}
              accountId={accountId}
              onRefresh={fetchProspects}
              onSelectProspect={handleSelectProspect}
              onWriteEmail={handleWriteEmail}
            />
          )}
          {activeSubTab === 'lists' && (
            <ProspectListManager accountId={accountId} />
          )}
        </>
      )}

      {/* Detail Modal */}
      {showModal && (
        <ProspectDetailModal
          prospect={isCreating ? null : selectedProspect}
          accountId={accountId}
          allProspects={prospects}
          onClose={handleModalClose}
          onSave={handleModalSave}
          onWriteEmail={handleWriteEmail}
          onViewExisting={handleViewExisting}
        />
      )}

      {/* Email Modal */}
      {emailingProspect && (
        <ProspectEmailModal
          prospect={emailingProspect}
          accountId={accountId}
          researchContext={perspective}
          onClose={() => setEmailingProspect(null)}
        />
      )}
    </div>
  );
}
