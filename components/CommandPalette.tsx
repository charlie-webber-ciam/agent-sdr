'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { primaryLinks, toolLinks } from '@/lib/nav-links';

interface AccountResult {
  id: number;
  companyName: string;
  domain: string;
  industry: string;
  tier: string | null;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState<AccountResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery('');
      setAccounts([]);
    }
  }, [open]);

  // Debounced account search
  const searchAccounts = useCallback((search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.length < 2) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/accounts?search=${encodeURIComponent(search)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts ?? []);
        }
      } catch {
        // Silently fail — palette still shows pages
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleValueChange = (value: string) => {
    setQuery(value);
    searchAccounts(value);
  };

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const allPages = [...primaryLinks, ...toolLinks];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className={cn(
        'fixed inset-0 z-[100]',
        open ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      // cmdk filter handles page matching; we do account search server-side
      shouldFilter={false}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog panel */}
      <div className="fixed inset-x-0 top-[20%] z-[101] mx-auto w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
          <Command.Input
            value={query}
            onValueChange={handleValueChange}
            placeholder="Search accounts, pages, and tools..."
            className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-muted-foreground">
              {loading ? 'Searching...' : 'No results found.'}
            </Command.Empty>

            {/* Accounts — only show when there's a query */}
            {accounts.length > 0 && (
              <Command.Group
                heading="Accounts"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {accounts.map((account) => (
                  <Command.Item
                    key={`account-${account.id}`}
                    value={`account-${account.id}-${account.companyName}`}
                    onSelect={() => navigate(`/accounts/${account.id}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{account.companyName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[account.domain, account.industry, account.tier ? `Tier ${account.tier}` : null]
                          .filter(Boolean)
                          .join(' \u00b7 ')}
                      </p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Pages & Tools — always visible, filtered by cmdk internally when shouldFilter is false we filter manually */}
            <Command.Group
              heading="Pages"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {allPages
                .filter((page) =>
                  !query || page.label.toLowerCase().includes(query.toLowerCase())
                )
                .map((page) => {
                  const Icon = page.icon;
                  return (
                    <Command.Item
                      key={page.href}
                      value={page.label}
                      onSelect={() => navigate(page.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{page.label}</span>
                    </Command.Item>
                  );
                })}
            </Command.Group>
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>Navigate with <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">&uarr;&darr;</kbd></span>
            <span><kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </Command.Dialog>
  );
}
