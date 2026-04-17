'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUpDown, UserRound } from 'lucide-react';

import { customerStatusLabel } from '@/lib/customer-status';
import { usePerspective } from '@/lib/perspective-context';
import { formatDomain, capitalize, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Account {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  customerStatus?: 'auth0_customer' | 'okta_customer' | 'common_customer' | null;
  status: string;
  researchSummary: string | null;
  processedAt: string | null;
  tier?: 'A' | 'B' | 'C' | null;
  priorityScore?: number | null;
  auth0Skus?: string[];
  auth0AccountOwner?: string | null;
  oktaTier?: 'A' | 'B' | 'C' | 'DQ' | null;
  oktaPriorityScore?: number | null;
  oktaSkus?: string[];
  oktaAccountOwner?: string | null;
  reviewStatus?: 'new' | 'reviewed' | 'working' | 'dismissed';
}

interface AccountTableProps {
  accounts: Account[];
  selectable?: boolean;
  selectedIds: Set<number>;
  onSelectionChange: (id: number, selected: boolean) => void;
  sortBy?: string;
  onSortChange?: (sortBy: string) => void;
  /** Query string from the accounts list to preserve filter context on navigation */
  listQuery?: string;
}

function tierBadgeClass(tier: 'A' | 'B' | 'C' | 'DQ' | null | undefined): string {
  if (tier === 'A') return 'border-emerald-300 bg-emerald-100 text-emerald-800';
  if (tier === 'B') return 'border-blue-300 bg-blue-100 text-blue-800';
  if (tier === 'C') return 'border-slate-300 bg-slate-100 text-slate-800';
  if (tier === 'DQ') return 'border-red-300 bg-red-100 text-red-800';
  return '';
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

function getStalenessColor(processedAt: string | null): string {
  if (!processedAt) return '';
  const diffDays = Math.floor((Date.now() - new Date(processedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return 'bg-green-500';
  if (diffDays < 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  sortKey: string | null;
  currentSort?: string;
  onSort?: (sortBy: string) => void;
  className?: string;
}) {
  if (!sortKey || !onSort) {
    return <TableHead className={className}>{label}</TableHead>;
  }

  const isActive = currentSort === sortKey;

  return (
    <TableHead
      className={cn('cursor-pointer select-none group', className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          <ArrowDown className="h-3.5 w-3.5 text-foreground" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground" />
        )}
      </span>
    </TableHead>
  );
}

function AccountTableInner({ accounts, selectable = true, selectedIds, onSelectionChange, sortBy, onSortChange, listQuery }: AccountTableProps) {
  const router = useRouter();
  const { perspective } = usePerspective();
  const isOkta = perspective === 'okta';

  const tierSortKey = isOkta ? 'okta_tier' : 'tier';
  const prioritySortKey = isOkta ? 'okta_priority_score' : 'priority_score';

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable && <TableHead className="w-10" />}
          <SortableHeader label="Company" sortKey="company_name" currentSort={sortBy} onSort={onSortChange} />
          <SortableHeader label="Industry" sortKey={null} currentSort={sortBy} onSort={onSortChange} className="hidden md:table-cell" />
          <SortableHeader label="Tier" sortKey={tierSortKey} currentSort={sortBy} onSort={onSortChange} />
          <SortableHeader label="Priority" sortKey={prioritySortKey} currentSort={sortBy} onSort={onSortChange} />
          <TableHead className="hidden lg:table-cell">Owner</TableHead>
          <TableHead className="hidden lg:table-cell">SKUs</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Review</TableHead>
          <SortableHeader label="Processed" sortKey="processed_at" currentSort={sortBy} onSort={onSortChange} className="hidden md:table-cell" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => {
          const displayTier = isOkta ? account.oktaTier : account.tier;
          const displayPriority = isOkta ? account.oktaPriorityScore : account.priorityScore;
          const displayOwner = isOkta ? account.oktaAccountOwner : account.auth0AccountOwner;
          const displaySkus = isOkta ? account.oktaSkus : account.auth0Skus;
          const selected = selectedIds.has(account.id);
          const customerStatus = customerStatusLabel(account.customerStatus);
          const stalenessColor = getStalenessColor(account.processedAt);

          return (
            <TableRow
              key={account.id}
              className={cn(
                'cursor-pointer',
                selected && 'bg-blue-50/70'
              )}
              onClick={() => {
                const detailUrl = listQuery
                  ? `/accounts/${account.id}?${listQuery}`
                  : `/accounts/${account.id}`;
                router.push(detailUrl);
              }}
            >
              {selectable && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => onSelectionChange(account.id, checked === true)}
                    aria-label={`Select ${account.companyName}`}
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="min-w-0">
                  <div className="truncate font-medium max-w-[220px]">{account.companyName}</div>
                  <div className="truncate text-xs text-muted-foreground max-w-[220px]">
                    {formatDomain(account.domain)}
                    {customerStatus && <span className="ml-1.5 text-muted-foreground/70">· {customerStatus}</span>}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                {account.industry}
              </TableCell>
              <TableCell>
                {displayTier ? (
                  <Badge variant="outline" className={cn('font-semibold text-xs', tierBadgeClass(displayTier))}>
                    {displayTier === 'DQ' ? 'DQ' : displayTier}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {displayPriority !== null && displayPriority !== undefined ? (
                  <span className={cn(
                    'text-sm font-medium tabular-nums',
                    displayPriority >= 75 ? 'text-red-600' : displayPriority >= 50 ? 'text-amber-600' : 'text-muted-foreground'
                  )}>
                    {displayPriority}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {displayOwner ? (
                  <span className={cn('flex items-center gap-1 text-xs', isOkta ? 'text-purple-700' : 'text-blue-700')}>
                    <UserRound className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{displayOwner}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {displaySkus && displaySkus.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {displaySkus.slice(0, 2).map((sku) => (
                      <Badge key={sku} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {sku}
                      </Badge>
                    ))}
                    {displaySkus.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{displaySkus.length - 2}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(account.status)} className="text-xs">
                  {capitalize(account.status)}
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {account.reviewStatus && account.reviewStatus !== 'new' ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0',
                      account.reviewStatus === 'working' && 'border-amber-300 bg-amber-50 text-amber-700',
                      account.reviewStatus === 'reviewed' && 'border-emerald-300 bg-emerald-50 text-emerald-700',
                      account.reviewStatus === 'dismissed' && 'border-red-200 bg-red-50 text-red-600',
                    )}
                  >
                    {account.reviewStatus === 'working' ? 'Working' :
                     account.reviewStatus === 'reviewed' ? 'Reviewed' : 'Dismissed'}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">New</span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                  {stalenessColor && <span className={cn('inline-block h-1.5 w-1.5 rounded-full', stalenessColor)} />}
                  {formatDate(account.processedAt)}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

const AccountTable = React.memo(AccountTableInner);
export default AccountTable;
