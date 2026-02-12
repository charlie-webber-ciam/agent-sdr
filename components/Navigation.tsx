'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePerspective } from '@/lib/perspective-context';

export default function Navigation() {
  const pathname = usePathname();
  const { perspective, setPerspective } = usePerspective();

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

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${perspective === 'okta' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                <span className="text-white font-bold text-sm">{perspective === 'okta' ? 'O' : 'A'}</span>
              </div>
              <span className="text-base font-bold text-gray-900">
                {perspective === 'okta' ? 'Okta SDR Agent' : 'Auth0 SDR Agent'}
              </span>
            </Link>

            <div className="flex gap-1">
              <Link href="/" className={linkClass('/')}>
                Dashboard
              </Link>
              <Link href="/accounts" className={linkClass('/accounts')}>
                Accounts
              </Link>
              <Link href="/quick-research" className={linkClass('/quick-research')}>
                Quick Research
              </Link>
              <Link href="/upload" className={linkClass('/upload')}>
                Upload
              </Link>
              <Link href="/employee-counts/jobs" className={linkClass('/employee-counts')}>
                Employee Counts
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
        </div>
      </div>
    </nav>
  );
}
