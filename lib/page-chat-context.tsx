'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface ActiveProspectContext {
  prospectId: number;
  accountId: number;
}

interface PageChatContextValue {
  routeAccountId: number | null;
  pageAccountId: number | null;
  pageProspectId: number | null;
  setActiveProspect: (prospectId: number, accountId: number) => void;
  clearActiveProspect: () => void;
}

const PageChatContext = createContext<PageChatContextValue>({
  routeAccountId: null,
  pageAccountId: null,
  pageProspectId: null,
  setActiveProspect: () => {},
  clearActiveProspect: () => {},
});

function parseAccountIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/accounts\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

export function PageChatContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeProspect, setActiveProspectState] = useState<ActiveProspectContext | null>(null);

  const routeAccountId = useMemo(() => parseAccountIdFromPath(pathname), [pathname]);

  useEffect(() => {
    // Any route change should clear transient prospect context so the chat does not carry stale selections.
    setActiveProspectState(null);
  }, [pathname]);

  const setActiveProspect = useCallback((prospectId: number, accountId: number) => {
    setActiveProspectState({ prospectId, accountId });
  }, []);

  const clearActiveProspect = useCallback(() => {
    setActiveProspectState(null);
  }, []);

  const value = useMemo<PageChatContextValue>(() => {
    const pageProspectId = activeProspect?.prospectId ?? null;
    const pageAccountId = activeProspect?.accountId ?? routeAccountId;

    return {
      routeAccountId,
      pageAccountId,
      pageProspectId,
      setActiveProspect,
      clearActiveProspect,
    };
  }, [activeProspect, routeAccountId, setActiveProspect, clearActiveProspect]);

  return (
    <PageChatContext.Provider value={value}>
      {children}
    </PageChatContext.Provider>
  );
}

export function usePageChatContext() {
  return useContext(PageChatContext);
}

