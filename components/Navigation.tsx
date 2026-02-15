'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { usePerspective } from '@/lib/perspective-context';

export default function Navigation() {
  const pathname = usePathname();
  const { perspective, setPerspective } = usePerspective();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === path;
    return pathname?.startsWith(path);
  };

  const linkClass = (path: string) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
      isActive(path)
        ? 'text-gray-900 bg-gray-200'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  const mobileLinkClass = (path: string) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive(path)
        ? 'text-gray-900 bg-gray-200'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`;

  const navLinks: { href: string; label: string; activePath?: string }[] = [
    { href: '/', label: 'Dashboard' },
    { href: '/accounts', label: 'Accounts' },
    { href: '/quick-research', label: 'Quick Research' },
    { href: '/upload', label: 'Upload' },
    { href: '/employee-counts/jobs', label: 'Employee Counts', activePath: '/employee-counts' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo + desktop links */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${perspective === 'okta' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                <span className="text-white font-bold text-sm">{perspective === 'okta' ? 'O' : 'A'}</span>
              </div>
              <span className="text-base font-bold text-gray-900">
                {perspective === 'okta' ? 'Okta SDR Agent' : 'Auth0 SDR Agent'}
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex gap-1">
              {navLinks.map(({ href, label, activePath }) => (
                <Link key={href} href={href} className={linkClass(activePath ?? href)}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop right-side controls */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setPerspective('auth0')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  perspective === 'auth0'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Auth0 CIAM
              </button>
              <button
                onClick={() => setPerspective('okta')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  perspective === 'okta'
                    ? 'bg-white text-purple-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Okta Workforce
              </button>
            </div>
            <Link
              href="/upload"
              className="px-4 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 font-medium transition-all"
            >
              + New Upload
            </Link>
          </div>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
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
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(({ href, label, activePath }) => (
                <Link
                  key={href}
                  href={href}
                  className={mobileLinkClass(activePath ?? href)}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}

              <div className="border-t border-gray-200 my-2" />

              {/* Perspective toggle */}
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

              {/* Upload button */}
              <Link
                href="/upload"
                className="block w-full text-center px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 font-medium transition-all"
                onClick={() => setMenuOpen(false)}
              >
                + New Upload
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
