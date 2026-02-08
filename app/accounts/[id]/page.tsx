'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import MarkdownSection from '@/components/MarkdownSection';
import TierSelector from '@/components/TierSelector';
import PrioritySlider from '@/components/PrioritySlider';
import UseCaseMultiSelect from '@/components/UseCaseMultiSelect';
import SKUMultiSelect from '@/components/SKUMultiSelect';
import AIAutoCategorizePanel from '@/components/AIAutoCategorizePanel';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';

interface AccountDetail {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  status: string;
  currentAuthSolution: string | null;
  customerBaseInfo: string | null;
  securityIncidents: string | null;
  newsAndFunding: string | null;
  techTransformation: string | null;
  prospects: Array<{
    name: string;
    title: string;
    background?: string;
  }>;
  researchSummary: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  // SDR fields
  tier: 'A' | 'B' | 'C' | null;
  estimatedAnnualRevenue: string | null;
  estimatedUserVolume: string | null;
  useCases: string[];
  auth0Skus: string[];
  sdrNotes: string | null;
  priorityScore: number | null;
  lastEditedAt: string | null;
  aiSuggestions: any | null;
}

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Retry state
  const [isRetrying, setIsRetrying] = useState(false);
  const [editData, setEditData] = useState({
    tier: null as 'A' | 'B' | 'C' | null,
    estimatedAnnualRevenue: '',
    estimatedUserVolume: '',
    useCases: [] as string[],
    auth0Skus: [] as string[],
    sdrNotes: '',
    priorityScore: 5,
  });

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const res = await fetch(`/api/accounts/${id}`);
        if (!res.ok) {
          throw new Error('Failed to fetch account');
        }
        const data = await res.json();
        setAccount(data);

        // Initialize edit data
        setEditData({
          tier: data.tier || null,
          estimatedAnnualRevenue: data.estimatedAnnualRevenue || '',
          estimatedUserVolume: data.estimatedUserVolume || '',
          useCases: data.useCases || [],
          auth0Skus: data.auth0Skus || [],
          sdrNotes: data.sdrNotes || '',
          priorityScore: data.priorityScore || 5,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load account');
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, [id]);

  const handleEdit = () => {
    setIsEditing(true);
    setShowAISuggestions(false);
  };

  const handleCancel = () => {
    if (account) {
      setEditData({
        tier: account.tier || null,
        estimatedAnnualRevenue: account.estimatedAnnualRevenue || '',
        estimatedUserVolume: account.estimatedUserVolume || '',
        useCases: account.useCases || [],
        auth0Skus: account.auth0Skus || [],
        sdrNotes: account.sdrNotes || '',
        priorityScore: account.priorityScore || 5,
      });
    }
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: editData.tier,
          estimatedAnnualRevenue: editData.estimatedAnnualRevenue,
          estimatedUserVolume: editData.estimatedUserVolume,
          useCases: editData.useCases,
          auth0Skus: editData.auth0Skus,
          sdrNotes: editData.sdrNotes,
          priorityScore: editData.priorityScore,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save changes');
      }

      // Refresh account data
      const updatedRes = await fetch(`/api/accounts/${id}`);
      const updatedData = await updatedRes.json();
      setAccount(updatedData);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleAISuggest = () => {
    setShowAISuggestions(true);
    setIsEditing(false);
  };

  const handleAcceptAISuggestions = (suggestions: any) => {
    setEditData({
      tier: suggestions.tier || editData.tier,
      estimatedAnnualRevenue: suggestions.estimatedAnnualRevenue || editData.estimatedAnnualRevenue,
      estimatedUserVolume: suggestions.estimatedUserVolume || editData.estimatedUserVolume,
      useCases: suggestions.useCases || editData.useCases,
      auth0Skus: suggestions.auth0Skus || editData.auth0Skus,
      sdrNotes: editData.sdrNotes,
      priorityScore: suggestions.priorityScore || editData.priorityScore,
    });
    setShowAISuggestions(false);
    setIsEditing(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete account');
      }

      // Redirect to accounts list after successful deletion
      router.push('/accounts?deleted=true');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/accounts/${id}/retry`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retry account');
      }

      const data = await res.json();
      // Redirect to processing page
      router.push(data.redirectUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry account');
      setIsRetrying(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-600">Loading...</div>
        </div>
      </main>
    );
  }

  if (error || !account) {
    return (
      <main className="min-h-screen p-8 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error || 'Account not found'}</p>
          <button
            onClick={() => router.push('/accounts')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Back to Accounts
          </button>
        </div>
      </main>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not processed';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Icon components
  const LockIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );

  const UsersIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const ShieldIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );

  const NewspaperIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  );

  const LightningIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const TargetIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/accounts')}
          className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2 font-medium transition-colors"
        >
          ← Back to Accounts
        </button>

        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg p-8 border border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2 text-gray-900">{account.companyName}</h1>
              <div className="flex items-center gap-3 text-lg text-gray-600 mb-3">
                <span className="font-medium">{account.domain}</span>
                <span>•</span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm">{account.industry}</span>
              </div>

              {/* Tier and SKU Badges */}
              <div className="flex flex-wrap gap-2">
                {account.tier && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold border-2 ${
                    account.tier === 'A' ? 'bg-green-100 text-green-800 border-green-300' :
                    account.tier === 'B' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                    'bg-gray-100 text-gray-800 border-gray-300'
                  }`}>
                    Tier {account.tier}
                  </span>
                )}
                {account.auth0Skus && account.auth0Skus.map(sku => (
                  <span key={sku} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold border-2 border-purple-300">
                    {sku}
                  </span>
                ))}
                {account.priorityScore !== null && account.priorityScore >= 7 && (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold border-2 border-red-300">
                    🔥 Priority {account.priorityScore}/10
                  </span>
                )}
              </div>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                account.status === 'completed'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : account.status === 'failed'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
            </span>
          </div>

          <p className="text-sm text-gray-500 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Processed: {formatDate(account.processedAt)}
          </p>

          {account.errorMessage && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-red-700 font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Error:
                  </p>
                  <p className="text-red-600 text-sm mt-1 ml-7">{account.errorMessage}</p>
                </div>
                {account.status === 'failed' && (
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="ml-4 px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isRetrying ? 'Retrying...' : 'Retry Research'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SDR Information Section */}
      {account.status === 'completed' && (
        <>
          {showAISuggestions && (
            <AIAutoCategorizePanel
              accountId={account.id}
              onAccept={handleAcceptAISuggestions}
              onClose={() => setShowAISuggestions(false)}
            />
          )}

          {!showAISuggestions && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              {!isEditing ? (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">SDR Information</h2>
                    <div className="flex gap-3">
                      <button
                        onClick={handleAISuggest}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI Suggest
                      </button>
                      <button
                        onClick={handleEdit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Display Mode */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Revenue</label>
                      <p className="text-gray-900">{account.estimatedAnnualRevenue || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated User Volume</label>
                      <p className="text-gray-900">{account.estimatedUserVolume || 'Not set'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Use Cases</label>
                      <div className="flex flex-wrap gap-2">
                        {account.useCases && account.useCases.length > 0 ? (
                          account.useCases.map(uc => (
                            <span key={uc} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              {uc}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500">No use cases set</span>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">SDR Notes</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{account.sdrNotes || 'No notes yet'}</p>
                    </div>
                    {account.lastEditedAt && (
                      <div className="md:col-span-2 text-xs text-gray-500">
                        Last edited: {formatDate(account.lastEditedAt)}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Edit Mode */}
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Edit SDR Information</h2>
                  </div>

                  <div className="space-y-6">
                    <TierSelector
                      value={editData.tier}
                      onChange={(tier) => setEditData({ ...editData, tier })}
                    />

                    <PrioritySlider
                      value={editData.priorityScore}
                      onChange={(priorityScore) => setEditData({ ...editData, priorityScore })}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated Annual Revenue</label>
                        <input
                          type="text"
                          value={editData.estimatedAnnualRevenue}
                          onChange={(e) => setEditData({ ...editData, estimatedAnnualRevenue: e.target.value })}
                          placeholder="e.g., $10M-$50M"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Estimated User Volume</label>
                        <input
                          type="text"
                          value={editData.estimatedUserVolume}
                          onChange={(e) => setEditData({ ...editData, estimatedUserVolume: e.target.value })}
                          placeholder="e.g., 100K-500K users"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <UseCaseMultiSelect
                      value={editData.useCases}
                      onChange={(useCases) => setEditData({ ...editData, useCases })}
                    />

                    <SKUMultiSelect
                      value={editData.auth0Skus}
                      onChange={(auth0Skus) => setEditData({ ...editData, auth0Skus })}
                    />

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">SDR Notes</label>
                      <textarea
                        value={editData.sdrNotes}
                        onChange={(e) => setEditData({ ...editData, sdrNotes: e.target.value })}
                        placeholder="Add notes about this account..."
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={saving}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Research Summary */}
      {account.researchSummary && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8 mb-8 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-600 rounded-lg">
              <TargetIcon />
            </div>
            <h2 className="text-3xl font-bold text-blue-900">
              Executive Summary
            </h2>
          </div>
          <MarkdownSection
            title=""
            content={account.researchSummary}
          />
        </div>
      )}

      {/* Research Sections */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-200">
        <h2 className="text-3xl font-bold mb-8 text-gray-900 flex items-center gap-3">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Research Findings
        </h2>

        <MarkdownSection
          title="Current Authentication Solution"
          content={account.currentAuthSolution}
          icon={<LockIcon />}
        />

        <MarkdownSection
          title="Customer Base & Scale"
          content={account.customerBaseInfo}
          icon={<UsersIcon />}
        />

        <MarkdownSection
          title="Security & Compliance"
          content={account.securityIncidents}
          icon={<ShieldIcon />}
        />

        <MarkdownSection
          title="Recent News & Funding"
          content={account.newsAndFunding}
          icon={<NewspaperIcon />}
        />

        <MarkdownSection
          title="Tech Transformation Initiatives"
          content={account.techTransformation}
          icon={<LightningIcon />}
        />
      </div>

      {/* Prospects */}
      {account.prospects && account.prospects.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-3xl font-bold text-gray-900">Key Prospects & Personas</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Target decision-makers and ideal customer personas for Auth0 CIAM outreach
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {account.prospects.map((prospect, idx) => {
              const isPersona = prospect.name.startsWith('Persona:');
              return (
                <div
                  key={idx}
                  className={`border-2 rounded-xl p-6 transition-all hover:shadow-lg hover:-translate-y-1 ${
                    isPersona
                      ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-white'
                      : 'border-blue-200 bg-gradient-to-br from-blue-50 to-white'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${isPersona ? 'bg-purple-100' : 'bg-blue-100'}`}>
                      {isPersona ? (
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-gray-900 mb-1">
                        {prospect.name}
                      </h4>
                      <p className={`text-sm font-medium px-2 py-1 rounded inline-block ${
                        isPersona ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {prospect.title}
                      </p>
                    </div>
                  </div>
                  {prospect.background && (
                    <p className="text-sm text-gray-700 leading-relaxed mt-3 pl-11">
                      {prospect.background}
                    </p>
                  )}
                  {isPersona && (
                    <div className="mt-3 pl-11">
                      <span className="text-xs text-purple-600 font-medium">Ideal Persona</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push('/accounts')}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
        >
          Back to Accounts
        </button>
        <button
          onClick={() => window.print()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        accountName={account.companyName}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        isDeleting={isDeleting}
      />
    </main>
  );
}
