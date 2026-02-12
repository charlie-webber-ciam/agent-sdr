'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { usePerspective } from '@/lib/perspective-context';

interface AccountCardProps {
  account: {
    id: number;
    companyName: string;
    domain: string;
    industry: string;
    status: string;
    researchSummary: string | null;
    processedAt: string | null;
    tier?: 'A' | 'B' | 'C' | null;
    auth0Skus?: string[];
    priorityScore?: number | null;
    auth0AccountOwner?: string | null;
    oktaTier?: 'A' | 'B' | 'C' | null;
    oktaSkus?: string[];
    oktaPriorityScore?: number | null;
    oktaAccountOwner?: string | null;
  };
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
}

function AccountCardInner({
  account,
  selectable = false,
  selected = false,
  onSelectionChange,
}: AccountCardProps) {
  const router = useRouter();
  const { perspective } = usePerspective();

  // Perspective-aware computed values
  const displayTier = perspective === 'okta' ? account.oktaTier : account.tier;
  const displaySkus = perspective === 'okta' ? account.oktaSkus : account.auth0Skus;
  const displayPriority = perspective === 'okta' ? account.oktaPriorityScore : account.priorityScore;
  const displayOwner = perspective === 'okta' ? account.oktaAccountOwner : account.auth0AccountOwner;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border border-green-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border border-blue-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border border-red-300';
      case 'pending':
        return 'bg-gray-100 text-gray-600 border border-gray-300';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-300';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not processed';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStalenessInfo = (processedAt: string | null) => {
    if (!processedAt) return null;
    const now = new Date();
    const processed = new Date(processedAt);
    const diffMs = now.getTime() - processed.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return { color: 'bg-green-500', textColor: 'text-green-400', label: `${diffDays}d ago`, level: 'fresh' };
    } else if (diffDays < 60) {
      return { color: 'bg-yellow-500', textColor: 'text-yellow-400', label: `${diffDays}d ago`, level: 'aging' };
    } else {
      return { color: 'bg-red-500', textColor: 'text-red-400', label: `${diffDays}d ago`, level: 'stale' };
    }
  };

  const stalenessInfo = getStalenessInfo(account.processedAt);

  const formatDomain = (domain: string | null) => {
    if (!domain || domain.includes('.placeholder')) {
      return 'No domain';
    }
    return domain;
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onSelectionChange) {
      onSelectionChange(account.id, e.target.checked);
    }
  };

  const handleCardClick = () => {
    if (!selectable) {
      router.push(`/accounts/${account.id}`);
    }
  };

  const tierBorder = displayTier === 'A' ? 'border-l-green-500' :
                     displayTier === 'B' ? 'border-l-blue-500' :
                     displayTier === 'C' ? 'border-l-gray-500' : 'border-l-transparent';

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all p-6 border-l-2 ${tierBorder} ${
        selected
          ? 'border-blue-500/50 bg-blue-50'
          : ''
      } cursor-pointer hover:shadow-lg hover:scale-[1.005]`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        {selectable && (
          <div className="flex items-start mr-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 mt-1 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {account.companyName}
          </h3>
          <p className="text-sm text-gray-500">
            {formatDomain(account.domain)} · {account.industry}
          </p>
          {displayOwner && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${perspective === 'okta' ? 'text-purple-600' : 'text-blue-600'}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {displayOwner}
            </p>
          )}

          {/* Tier and SKU Badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            {displayTier && (
              <span className={`badge ${
                displayTier === 'A' ? 'tier-a' :
                displayTier === 'B' ? 'tier-b' :
                'tier-c'
              }`}>
                Tier {displayTier}
              </span>
            )}
            {displaySkus && displaySkus.map(sku => (
              <span key={sku} className="badge sku">
                {sku}
              </span>
            ))}
            {displayPriority !== null && displayPriority !== undefined && displayPriority >= 8 && (
              <span className="badge priority-high">
                P{displayPriority}
              </span>
            )}
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            account.status
          )}`}
        >
          {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
        </span>
      </div>

      {/* Summary */}
      {account.researchSummary && (
        <div className="mb-3">
          <p className="text-sm text-gray-500 line-clamp-3">
            {account.researchSummary}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          {stalenessInfo && (
            <span className={`inline-block w-2 h-2 rounded-full ${stalenessInfo.color}`} title={`Research ${stalenessInfo.level}`}></span>
          )}
          <span>{stalenessInfo ? stalenessInfo.label : formatDate(account.processedAt)}</span>
        </div>
        {!selectable && (
          <span className="text-blue-400 font-medium hover:text-blue-300">
            View Details →
          </span>
        )}
        {selectable && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/accounts/${account.id}`);
            }}
            className="text-blue-400 font-medium hover:text-blue-300 cursor-pointer"
          >
            View Details →
          </span>
        )}
      </div>
    </div>
  );
}

const AccountCard = React.memo(AccountCardInner);
export default AccountCard;
