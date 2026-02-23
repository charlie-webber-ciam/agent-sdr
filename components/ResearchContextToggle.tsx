'use client';

interface ResearchContextToggleProps {
  value: 'auth0' | 'okta';
  onChange: (ctx: 'auth0' | 'okta') => void;
  account?: any;
  hint?: string;
}

export function ResearchContextToggle({ value, onChange, account, hint }: ResearchContextToggleProps) {
  const auth0Available = !account || !!account.processedAt;
  const oktaAvailable = !account || !!account.oktaProcessedAt;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Research Context *</label>
      <div className="flex gap-2">
        <button
          onClick={() => onChange('auth0')}
          disabled={!auth0Available}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            value === 'auth0'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            Auth0 CIAM
            {!auth0Available && <span className="text-xs">&#x26A0;&#xFE0F;</span>}
          </span>
        </button>
        <button
          onClick={() => onChange('okta')}
          disabled={!oktaAvailable}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            value === 'okta'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            Okta Workforce
            {!oktaAvailable && <span className="text-xs">&#x26A0;&#xFE0F;</span>}
          </span>
        </button>
      </div>
      {hint && (
        <p className="mt-2 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}
