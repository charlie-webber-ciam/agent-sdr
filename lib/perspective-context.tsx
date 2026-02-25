'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Perspective = 'auth0' | 'okta';
export type OktaPatch = 'emerging' | 'crp' | 'ent' | 'stg' | 'pubsec';

interface PerspectiveContextValue {
  perspective: Perspective;
  setPerspective: (p: Perspective) => void;
  oktaPatch: OktaPatch;
  setOktaPatch: (p: OktaPatch) => void;
}

const VALID_PATCHES: OktaPatch[] = ['emerging', 'crp', 'ent', 'stg', 'pubsec'];

const PerspectiveContext = createContext<PerspectiveContextValue>({
  perspective: 'auth0',
  setPerspective: () => {},
  oktaPatch: 'ent',
  setOktaPatch: () => {},
});

export function PerspectiveProvider({ children }: { children: ReactNode }) {
  const [perspective, setPerspectiveState] = useState<Perspective>('auth0');
  const [oktaPatch, setOktaPatchState] = useState<OktaPatch>('ent');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sdr-perspective');
    if (stored === 'auth0' || stored === 'okta') {
      setPerspectiveState(stored);
    }
    const storedPatch = localStorage.getItem('sdr-okta-patch');
    if (storedPatch && VALID_PATCHES.includes(storedPatch as OktaPatch)) {
      setOktaPatchState(storedPatch as OktaPatch);
    }
    setMounted(true);
  }, []);

  const setPerspective = (p: Perspective) => {
    setPerspectiveState(p);
    localStorage.setItem('sdr-perspective', p);
  };

  const setOktaPatch = (p: OktaPatch) => {
    setOktaPatchState(p);
    localStorage.setItem('sdr-okta-patch', p);
  };

  // Avoid hydration mismatch by rendering children only after mount
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <PerspectiveContext.Provider value={{ perspective, setPerspective, oktaPatch, setOktaPatch }}>
      {children}
    </PerspectiveContext.Provider>
  );
}

export function usePerspective() {
  return useContext(PerspectiveContext);
}
