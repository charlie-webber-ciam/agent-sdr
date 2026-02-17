'use client';

import { ReactNode, useState } from 'react';

const AVAILABLE_MODELS = [
  'gpt-5.2',
  'claude-4-6-opus',
  'claude-4-5-sonnet',
  'gpt-5-nano',
  'gemini-3-flash-preview',
  'llama-4-maverick-17b',
];

export interface SidebarSection {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface ReportSidebarProps {
  perspective: 'auth0' | 'okta';
  onPerspectiveChange: (p: 'auth0' | 'okta') => void;
  activeSectionId: string | null;
  sections: SidebarSection[];
  hasAuth0Research: boolean;
  hasOktaResearch: boolean;
  onPrint: () => void;
  onDelete: () => void;
  onReprocess: (type: 'auth0' | 'okta' | 'both', model?: string) => void;
  isReprocessing?: boolean;
  showCategorization?: boolean;
  onToggleCategorization?: () => void;
}

export default function ReportSidebar({
  perspective,
  onPerspectiveChange,
  activeSectionId,
  sections,
  hasAuth0Research,
  hasOktaResearch,
  onPrint,
  onDelete,
  onReprocess,
  isReprocessing = false,
  showCategorization = false,
  onToggleCategorization,
}: ReportSidebarProps) {
  const [reprocessModel, setReprocessModel] = useState('gpt-5.2');
  const [showReprocessPanel, setShowReprocessPanel] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="w-60 flex-shrink-0 hidden lg:block">
      <div className="sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
        {/* Research Perspective Toggle */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Research</h4>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onPerspectiveChange('auth0')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                perspective === 'auth0'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${perspective === 'auth0' ? 'bg-blue-600' : 'bg-gray-300'}`} />
              Auth0 CIAM
              {!hasAuth0Research && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">N/A</span>
              )}
            </button>
            <button
              onClick={() => onPerspectiveChange('okta')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                perspective === 'okta'
                  ? 'bg-purple-100 text-purple-800'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${perspective === 'okta' ? 'bg-purple-600' : 'bg-gray-300'}`} />
              Okta Workforce
              {!hasOktaResearch && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">N/A</span>
              )}
            </button>
          </div>
        </div>

        {/* Section Links */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Sections</h4>
          <div className="flex flex-col gap-0.5">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                  activeSectionId === section.id
                    ? perspective === 'okta'
                      ? 'bg-purple-50 text-purple-800 font-medium'
                      : 'bg-blue-50 text-blue-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {section.icon && <span className="w-4 h-4 flex-shrink-0">{section.icon}</span>}
                <span className="truncate">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Tools</h4>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => scrollToSection('section-notes')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                activeSectionId === 'section-notes'
                  ? 'bg-yellow-50 text-yellow-800 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Notes
            </button>
            <button
              onClick={() => scrollToSection('section-email')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                activeSectionId === 'section-email'
                  ? 'bg-green-50 text-green-800 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Writer
            </button>
            <button
              onClick={() => scrollToSection('section-sequence')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                activeSectionId === 'section-sequence'
                  ? 'bg-cyan-50 text-cyan-800 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Sequence Builder
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Actions</h4>
          <div className="flex flex-col gap-1">
            {onToggleCategorization && (
              <button
                onClick={onToggleCategorization}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                  showCategorization
                    ? 'bg-indigo-50 text-indigo-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Categorization
              </button>
            )}
            {/* Reprocess */}
            <div>
              <button
                onClick={() => !isReprocessing && setShowReprocessPanel(!showReprocessPanel)}
                disabled={isReprocessing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left w-full disabled:opacity-50 ${
                  showReprocessPanel
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isReprocessing ? 'Reprocessing...' : 'Reprocess'}
                <svg className={`w-3 h-3 ml-auto transition-transform ${showReprocessPanel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showReprocessPanel && !isReprocessing && (
                <div className="mt-1 ml-2 pl-4 border-l-2 border-gray-200 space-y-2 py-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Model</label>
                    <select
                      value={reprocessModel}
                      onChange={(e) => setReprocessModel(e.target.value)}
                      className="w-full mt-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {AVAILABLE_MODELS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => { onReprocess('auth0', reprocessModel); setShowReprocessPanel(false); }}
                      className="text-left px-2 py-1 text-xs rounded text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      Auth0 Only
                    </button>
                    <button
                      onClick={() => { onReprocess('okta', reprocessModel); setShowReprocessPanel(false); }}
                      className="text-left px-2 py-1 text-xs rounded text-purple-700 hover:bg-purple-50 transition-colors"
                    >
                      Okta Only
                    </button>
                    <button
                      onClick={() => { onReprocess('both', reprocessModel); setShowReprocessPanel(false); }}
                      className="text-left px-2 py-1 text-xs rounded text-green-700 hover:bg-green-50 transition-colors"
                    >
                      Both
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onPrint}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
