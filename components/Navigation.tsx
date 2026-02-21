'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { usePerspective } from '@/lib/perspective-context';

const primaryLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/prospects', label: 'Prospects' },
  { href: '/opportunities', label: 'Opportunities' },
];

const toolLinks = [
  { href: '/quick-research', label: 'Quick Research' },
  { href: '/upload', label: 'Upload CSV' },
  { href: '/import-opportunities', label: 'Import Opportunities' },
  { href: '/employee-counts/jobs', label: 'Employee Counts', activePath: '/employee-counts' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { perspective, setPerspective } = usePerspective();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    if (path === '/') return pathname === path;
    return pathname?.startsWith(path);
  };

  const isToolActive = toolLinks.some(({ href, activePath }) => isActive(activePath ?? href));

  const linkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
      active
        ? 'text-gray-900 bg-gray-200'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  // Close tools dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">

          {/* Logo + desktop links */}
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${perspective === 'okta' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                <span className="text-white font-bold text-sm">{perspective === 'okta' ? 'O' : 'A'}</span>
              </div>
              <span className="text-base font-bold text-gray-900 hidden lg:block">
                {perspective === 'okta' ? 'Okta SDR' : 'Auth0 SDR'}
              </span>
            </Link>

            {/* Desktop primary links */}
            <div className="hidden md:flex items-center gap-0.5">
              {primaryLinks.map(({ href, label }) => (
                <Link key={href} href={href} className={linkClass(isActive(href))}>
                  {label}
                </Link>
              ))}

              {/* Tools dropdown */}
              <div ref={toolsRef} className="relative">
                <button
                  onClick={() => setToolsOpen(o => !o)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isToolActive || toolsOpen
                      ? 'text-gray-900 bg-gray-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Tools
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${toolsOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <AnimatePresence>
                  {toolsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-50"
                    >
                      {toolLinks.map(({ href, label, activePath }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setToolsOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            isActive(activePath ?? href)
                              ? 'text-gray-900 bg-gray-100 font-medium'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Desktop right: perspective toggle + hamburger on mobile */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setPerspective('auth0')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  perspective === 'auth0'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Auth0
              </button>
              <button
                onClick={() => setPerspective('okta')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  perspective === 'okta'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Okta
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-gray-200 bg-white/95 backdrop-blur-xl"
          >
            <div className="px-4 py-3 space-y-0.5">
              {primaryLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(href) ? 'text-gray-900 bg-gray-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </Link>
              ))}

              <div className="pt-2 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tools</p>
              </div>

              {toolLinks.map(({ href, label, activePath }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(activePath ?? href) ? 'text-gray-900 bg-gray-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </Link>
              ))}

              <div className="border-t border-gray-200 pt-3 mt-2">
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setPerspective('auth0')}
                    className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      perspective === 'auth0'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Auth0 CIAM
                  </button>
                  <button
                    onClick={() => setPerspective('okta')}
                    className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      perspective === 'okta'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Okta Workforce
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
