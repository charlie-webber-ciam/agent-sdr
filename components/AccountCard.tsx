'use client';

import { useRouter } from 'next/navigation';

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
  };
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
}

export default function AccountCard({
  account,
  selectable = false,
  selected = false,
  onSelectionChange,
}: AccountCardProps) {
  const router = useRouter();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onSelectionChange) {
      onSelectionChange(account.id, e.target.checked);
    }
  };

  const handleCardClick = () => {
    // Don't navigate if in selection mode - let the checkbox handle it
    if (!selectable) {
      router.push(`/accounts/${account.id}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer p-6 border-2 ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-blue-300'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        {selectable && account.status === 'failed' && (
          <div className="flex items-start mr-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 mt-1 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-1">
            {account.companyName}
          </h3>
          <p className="text-sm text-gray-600">
            {account.domain} • {account.industry}
          </p>

          {/* Tier and SKU Badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            {account.tier && (
              <span className={`badge ${
                account.tier === 'A' ? 'tier-a' :
                account.tier === 'B' ? 'tier-b' :
                'tier-c'
              }`}>
                Tier {account.tier}
              </span>
            )}
            {account.auth0Skus && account.auth0Skus.map(sku => (
              <span key={sku} className="badge sku">
                {sku}
              </span>
            ))}
            {account.priorityScore !== null && account.priorityScore !== undefined && account.priorityScore >= 8 && (
              <span className="badge priority-high">
                🔥 P{account.priorityScore}
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
          <p className="text-sm text-gray-700 line-clamp-3">
            {account.researchSummary}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100">
        <span>{formatDate(account.processedAt)}</span>
        {!selectable && (
          <span className="text-blue-600 font-medium hover:text-blue-700">
            View Details →
          </span>
        )}
        {selectable && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/accounts/${account.id}`);
            }}
            className="text-blue-600 font-medium hover:text-blue-700 cursor-pointer"
          >
            View Details →
          </span>
        )}
      </div>
    </div>
  );
}
