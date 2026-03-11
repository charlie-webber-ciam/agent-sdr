'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';

import { usePerspective } from '@/lib/perspective-context';
import { formatDomain, capitalize, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

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
    oktaTier?: 'A' | 'B' | 'C' | 'DQ' | null;
    oktaSkus?: string[];
    oktaPriorityScore?: number | null;
    oktaAccountOwner?: string | null;
  };
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'processing':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function tierBadgeClass(tier: 'A' | 'B' | 'C' | 'DQ' | null | undefined): string {
  if (tier === 'A') return 'border-emerald-300 bg-emerald-100 text-emerald-800';
  if (tier === 'B') return 'border-blue-300 bg-blue-100 text-blue-800';
  if (tier === 'C') return 'border-slate-300 bg-slate-100 text-slate-800';
  if (tier === 'DQ') return 'border-red-300 bg-red-100 text-red-800';
  return '';
}

function AccountCardInner({
  account,
  selectable = false,
  selected = false,
  onSelectionChange,
}: AccountCardProps) {
  const router = useRouter();
  const { perspective } = usePerspective();

  const displayTier = perspective === 'okta' ? account.oktaTier : account.tier;
  const displaySkus = perspective === 'okta' ? account.oktaSkus : account.auth0Skus;
  const displayPriority = perspective === 'okta' ? account.oktaPriorityScore : account.priorityScore;
  const displayOwner = perspective === 'okta' ? account.oktaAccountOwner : account.auth0AccountOwner;

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
      return { color: 'bg-green-500', label: `${diffDays}d ago` };
    } else if (diffDays < 60) {
      return { color: 'bg-yellow-500', label: `${diffDays}d ago` };
    }

    return { color: 'bg-red-500', label: `${diffDays}d ago` };
  };

  const stalenessInfo = getStalenessInfo(account.processedAt);

  const handleCardClick = () => {
    router.push(`/accounts/${account.id}`);
  };

  const tierAccent =
    displayTier === 'A'
      ? 'border-l-green-500'
      : displayTier === 'B'
        ? 'border-l-blue-500'
        : displayTier === 'DQ'
          ? 'border-l-red-400'
          : displayTier === 'C'
            ? 'border-l-slate-400'
            : 'border-l-transparent';

  return (
    <Card
      onClick={handleCardClick}
      className={cn(
        'cursor-pointer border-l-4 transition hover:shadow-md',
        tierAccent,
        selected && 'border-blue-500 bg-blue-50/70'
      )}
    >
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          {selectable && (
            <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelectionChange?.(account.id, checked === true)}
                aria-label={`Select ${account.companyName}`}
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="mb-1 truncate text-lg font-semibold text-foreground">{account.companyName}</h3>
            <p className="text-sm text-muted-foreground">{formatDomain(account.domain)} · {account.industry}</p>

            {displayOwner && (
              <p className={cn('mt-1 flex items-center gap-1 text-xs', perspective === 'okta' ? 'text-purple-700' : 'text-blue-700')}>
                <UserRound className="h-3.5 w-3.5" />
                {displayOwner}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {displayTier && (
                <Badge variant="outline" className={cn('font-semibold', tierBadgeClass(displayTier))}>
                  {displayTier === 'DQ' ? 'DQ' : `Tier ${displayTier}`}
                </Badge>
              )}
              {displaySkus?.map((sku) => (
                <Badge key={sku} variant="secondary">
                  {sku}
                </Badge>
              ))}
              {displayPriority !== null && displayPriority !== undefined && displayPriority >= 75 && (
                <Badge variant="destructive">{displayPriority}/100</Badge>
              )}
            </div>
          </div>

          <Badge variant={statusVariant(account.status)}>{capitalize(account.status)}</Badge>
        </div>

        {account.researchSummary && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{account.researchSummary}</p>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          {stalenessInfo && <span className={cn('inline-block h-2 w-2 rounded-full', stalenessInfo.color)} />}
          <span>{stalenessInfo ? stalenessInfo.label : formatDate(account.processedAt)}</span>
        </div>

        <Button
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounts/${account.id}`);
          }}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}

const AccountCard = React.memo(AccountCardInner);
export default AccountCard;
