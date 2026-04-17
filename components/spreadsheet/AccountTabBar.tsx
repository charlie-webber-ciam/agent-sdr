'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight, LayoutGrid, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountSummary {
  id: number;
  companyName: string;
  domain: string;
  tier: string | null;
}

type ViewMode = 'single' | 'cross';

interface AccountTabBarProps {
  selectedAccountId: number | null;
  onSelectAccount: (id: number) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  selectedAccountIds?: Set<number>;
  onToggleAccountId?: (id: number) => void;
  refreshKey?: number;
  onAccountsLoaded?: (accounts: AccountSummary[]) => void;
  onPrefetch?: (id: number) => void;
}

export default function AccountTabBar({
  selectedAccountId,
  onSelectAccount,
  viewMode = 'single',
  onViewModeChange,
  selectedAccountIds = new Set(),
  onToggleAccountId,
  refreshKey = 0,
  onAccountsLoaded,
  onPrefetch,
}: AccountTabBarProps) {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedBtnRef = useRef<HTMLButtonElement>(null);

  const scrollSelectedIntoView = useCallback(() => {
    setTimeout(() => {
      selectedBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 50);
  }, []);

  const isSingle = viewMode === 'single';

  // Scroll selected tab into view when selection changes
  useEffect(() => {
    if (selectedAccountId && isSingle) scrollSelectedIntoView();
  }, [selectedAccountId, isSingle, scrollSelectedIntoView]);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch('/api/accounts?limit=5000');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const mapped: AccountSummary[] = data.accounts.map((a: any) => ({
          id: a.id,
          companyName: a.companyName,
          domain: a.domain,
          tier: a.tier,
        }));
        setAccounts(mapped);
        onAccountsLoaded?.(mapped);

        // Auto-select first account or restore from localStorage
        if (mapped.length > 0 && !selectedAccountId && viewMode === 'single') {
          const savedId = localStorage.getItem('spreadsheet_account_id');
          const savedAccount = savedId ? mapped.find(a => a.id === parseInt(savedId)) : null;
          onSelectAccount(savedAccount ? savedAccount.id : mapped[0].id);
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const s = search.toLowerCase();
    return accounts.filter(a =>
      a.companyName.toLowerCase().includes(s) || a.domain.toLowerCase().includes(s)
    );
  }, [accounts, search]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const handleClick = (id: number) => {
    if (viewMode === 'cross') {
      onToggleAccountId?.(id);
    } else {
      onSelectAccount(id);
      localStorage.setItem('spreadsheet_account_id', String(id));
    }
  };

  const isCross = !isSingle;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-gray-100" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* Mode toggle */}
        {onViewModeChange && (
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => onViewModeChange('single')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                !isCross
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <User className="h-3.5 w-3.5" />
              Single Account
            </button>
            <button
              onClick={() => onViewModeChange('cross')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                isCross
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              All Accounts
            </button>
          </div>
        )}

        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder={isCross ? 'Filter accounts...' : 'Search accounts...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {isCross && selectedAccountIds.size > 0 && (
          <span className="text-xs text-gray-500">
            {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => scroll('left')}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-1 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {filtered.length === 0 ? (
            <span className="px-3 py-2 text-sm text-gray-400">
              {accounts.length === 0 ? 'No accounts found' : 'No matches'}
            </span>
          ) : (
            filtered.map((account) => {
              const isSelectedSingle = !isCross && selectedAccountId === account.id;
              const isSelectedCross = isCross && selectedAccountIds.has(account.id);
              return (
                <button
                  key={account.id}
                  ref={isSelectedSingle ? selectedBtnRef : undefined}
                  onClick={() => handleClick(account.id)}
                  onMouseEnter={() => !isSelectedSingle && onPrefetch?.(account.id)}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                    isSelectedSingle
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isSelectedCross
                      ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-400'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {account.companyName}
                  {account.tier && (
                    <span className={cn(
                      'ml-1.5 inline-block rounded px-1 py-0.5 text-[10px] font-semibold leading-none',
                      isSelectedSingle
                        ? 'bg-blue-500 text-blue-100'
                        : account.tier === 'A' ? 'bg-green-100 text-green-700'
                        : account.tier === 'B' ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-200 text-gray-500'
                    )}>
                      {account.tier}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={() => scroll('right')}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
