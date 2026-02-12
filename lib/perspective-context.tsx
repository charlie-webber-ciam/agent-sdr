'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Perspective = 'auth0' | 'okta';

interface PerspectiveContextValue {
  perspective: Perspective;
  setPerspective: (p: Perspective) => void;
}

const PerspectiveContext = createContext<PerspectiveContextValue>({
  perspective: 'auth0',
  setPerspective: () => {},
});

export function PerspectiveProvider({ children }: { children: ReactNode }) {
  const [perspective, setPerspectiveState] = useState<Perspective>('auth0');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sdr-perspective');
    if (stored === 'auth0' || stored === 'okta') {
      setPerspectiveState(stored);
    }
    setMounted(true);
  }, []);

  const setPerspective = (p: Perspective) => {
    setPerspectiveState(p);
    localStorage.setItem('sdr-perspective', p);
  };

  // Avoid hydration mismatch by rendering children only after mount
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <PerspectiveContext.Provider value={{ perspective, setPerspective }}>
      {children}
    </PerspectiveContext.Provider>
  );
}

export function usePerspective() {
  return useContext(PerspectiveContext);
}
