'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Loader2,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import { CopyButton } from '@/components/CopyButton';
import { useToast } from '@/lib/toast-context';
import {
  POSITIONING_ANGLES,
  type EventResearchBrief,
  type GeneratedInvitation,
} from '@/lib/event-invitation-writer-schema';

type Mode = 'standalone' | 'account';

interface AccountSearchItem {
  id: number;
  companyName: string;
  domain: string | null;
  industry: string | null;
  status: string;
  processedAt: string | null;
  oktaProcessedAt: string | null;
}

function mapSearchAccount(raw: {
  id: number;
  companyName: string;
  domain?: string | null;
  industry?: string | null;
  status?: string;
  processedAt?: string | null;
  oktaProcessedAt?: string | null;
}): AccountSearchItem {
  return {
    id: raw.id,
    companyName: raw.companyName,
    domain: raw.domain ?? null,
    industry: raw.industry ?? null,
    status: raw.status ?? 'unknown',
    processedAt: raw.processedAt ?? null,
    oktaProcessedAt: raw.oktaProcessedAt ?? null,
  };
}

function prettyAngle(angle: (typeof POSITIONING_ANGLES)[number]): string {
  return angle
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const BRIEF_FIELD_CONFIG: Array<{
  key: keyof Pick<
    EventResearchBrief,
    'companyName' | 'domain' | 'industry' | 'whatTheyDo' | 'currentAuthChallenges' | 'likelyEventRelevance'
  >;
  label: string;
  rows?: number;
}> = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'domain', label: 'Domain' },
  { key: 'industry', label: 'Industry' },
  { key: 'whatTheyDo', label: 'What They Do', rows: 3 },
  { key: 'currentAuthChallenges', label: 'Current Auth Challenges', rows: 3 },
  { key: 'likelyEventRelevance', label: 'Likely Event Relevance', rows: 3 },
];

export default function EventInvitationWriter() {
  const toast = useToast();

  // Mode
  const [mode, setMode] = useState<Mode>('standalone');

  // Shared inputs
  const [eventDescription, setEventDescription] = useState('');
  const [registrationLink, setRegistrationLink] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [prospectTitle, setProspectTitle] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  // Standalone inputs
  const [prospectCompany, setProspectCompany] = useState('');

  // Account mode
  const [accountQuery, setAccountQuery] = useState('');
  const [accounts, setAccounts] = useState<AccountSearchItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [activeAccount, setActiveAccount] = useState<AccountSearchItem | null>(null);

  // Research & generation state
  const [brief, setBrief] = useState<EventResearchBrief | null>(null);
  const [invitations, setInvitations] = useState<GeneratedInvitation[]>([]);
  const [lowConfidenceConfirmed, setLowConfidenceConfirmed] = useState(false);

  // Loading states
  const [researching, setResearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confidenceTone = brief?.confidence === 'high'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : brief?.confidence === 'medium'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-red-200 bg-red-50 text-red-700';

  // Reset brief and invitations when mode changes
  useEffect(() => {
    setBrief(null);
    setInvitations([]);
    setError(null);
  }, [mode]);

  // Account search
  const fetchAccounts = useCallback(async (searchQuery: string): Promise<AccountSearchItem[]> => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    params.set('status', 'completed');
    params.set('limit', '25');
    params.set('offset', '0');

    const response = await fetch(`/api/accounts?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch accounts');
    }

    const rawAccounts = Array.isArray(data.accounts) ? data.accounts : [];
    return rawAccounts.map(mapSearchAccount);
  }, []);

  useEffect(() => {
    if (mode !== 'account') return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingAccounts(true);
      try {
        const next = await fetchAccounts(accountQuery.trim());
        if (!cancelled) setAccounts(next);
      } catch {
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [accountQuery, mode, fetchAccounts]);

  const canGenerate = useMemo(() => {
    if (generating) return false;
    if (!eventDescription.trim() || !registrationLink.trim() || !prospectName.trim() || !prospectTitle.trim()) return false;
    if (mode === 'standalone' && !brief) return false;
    if (mode === 'account' && !activeAccount) return false;
    if (brief?.confidence === 'low' && !lowConfidenceConfirmed) return false;
    return true;
  }, [brief, generating, eventDescription, registrationLink, prospectName, prospectTitle, mode, activeAccount, lowConfidenceConfirmed]);

  const handleResearch = async () => {
    if (!eventDescription.trim() || !prospectCompany.trim() || !prospectName.trim() || !prospectTitle.trim()) {
      setError('Event description, prospect company, name, and title are required.');
      return;
    }

    setResearching(true);
    setError(null);
    setInvitations([]);

    try {
      const response = await fetch('/api/event-invites/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventDescription: eventDescription.trim(),
          registrationLink: registrationLink.trim() || 'https://placeholder.com',
          prospectName: prospectName.trim(),
          prospectTitle: prospectTitle.trim(),
          prospectCompany: prospectCompany.trim(),
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to research company');
      }

      const nextBrief = data.brief as EventResearchBrief;
      setBrief(nextBrief);
      setLowConfidenceConfirmed(nextBrief.confidence !== 'low');
      toast.success('Research brief ready for review.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to research company';
      setError(message);
      toast.error(message);
    } finally {
      setResearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!eventDescription.trim() || !registrationLink.trim() || !prospectName.trim()) {
      setError('Event description, registration link, and prospect name are required.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        eventDescription: eventDescription.trim(),
        registrationLink: registrationLink.trim(),
        prospectName: prospectName.trim(),
        customInstructions: customInstructions.trim() || undefined,
      };

      if (mode === 'standalone' && brief) {
        payload.brief = brief;
      } else if (mode === 'account' && activeAccount) {
        payload.accountId = activeAccount.id;
      }

      const response = await fetch('/api/event-invites/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate invitations');
      }

      setInvitations(data.invitations as GeneratedInvitation[]);
      if (data.brief && !brief) {
        setBrief(data.brief as EventResearchBrief);
      }
      toast.success('Three invitation variants generated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate invitations';
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const updateBriefField = (field: keyof EventResearchBrief, value: string) => {
    setBrief((current) => {
      if (!current) return current;
      if (field === 'domain') {
        return { ...current, domain: value.trim() || null };
      }
      return { ...current, [field]: value } as EventResearchBrief;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and mode toggle */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-violet-50 via-white to-emerald-50 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900">Event Invitation Writer</h2>
              <p className="max-w-3xl text-sm text-gray-600">
                Generate personalised event invitations that connect the event content to a prospect&apos;s specific challenges.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('standalone')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    mode === 'standalone'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Live Research
                </button>
                <button
                  type="button"
                  onClick={() => setMode('account')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    mode === 'account'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Saved Account
                </button>
              </div>
              <div className="rounded-full border border-violet-200 bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                GPT-5.4
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className={mode === 'account' ? 'grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]' : ''}>
            {/* Account selector (account mode only) */}
            {mode === 'account' && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Account Context</h3>
                  <span className="text-xs text-gray-500">
                    {loadingAccounts ? 'Searching...' : `${accounts.length} accounts`}
                  </span>
                </div>

                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={accountQuery}
                    onChange={(e) => setAccountQuery(e.target.value)}
                    placeholder="Search accounts..."
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-9 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {accountQuery && (
                    <button
                      type="button"
                      onClick={() => setAccountQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {activeAccount && (
                  <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{activeAccount.companyName}</p>
                        <p className="text-xs text-gray-500">
                          {activeAccount.domain || 'No domain'}{activeAccount.industry ? ` · ${activeAccount.industry}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveAccount(null)}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {loadingAccounts && (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-sm text-gray-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  )}

                  {!loadingAccounts && accounts.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                      No accounts found.
                    </div>
                  )}

                  {!loadingAccounts && accounts.map((account) => {
                    const selected = activeAccount?.id === account.id;
                    return (
                      <div
                        key={account.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          selected ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <p className="truncate text-sm font-semibold text-gray-900">{account.companyName}</p>
                        <p className="truncate text-xs text-gray-500">
                          {account.domain || 'No domain'}{account.industry ? ` · ${account.industry}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {account.processedAt && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                              Auth0
                            </span>
                          )}
                          {account.oktaProcessedAt && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                              Okta
                            </span>
                          )}
                        </div>
                        {!selected && (
                          <button
                            type="button"
                            onClick={() => setActiveAccount(account)}
                            className="mt-2 w-full rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                          >
                            Use This Account
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main form */}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Event Description *</label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  rows={8}
                  placeholder={"Paste the full event description here, including:\n- Event name\n- Date and time\n- Location (virtual/in-person)\n- Description and agenda\n- Key topics and learning outcomes"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Registration Link *</label>
                <input
                  type="url"
                  value={registrationLink}
                  onChange={(e) => setRegistrationLink(e.target.value)}
                  placeholder="https://events.auth0.com/devcamp-advanced-spa"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Prospect Name *</label>
                  <input
                    type="text"
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    placeholder="e.g., Sarah Chen"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Prospect Title *</label>
                  <input
                    type="text"
                    value={prospectTitle}
                    onChange={(e) => setProspectTitle(e.target.value)}
                    placeholder="e.g., VP Engineering"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {mode === 'standalone' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Prospect Company *</label>
                  <input
                    type="text"
                    value={prospectCompany}
                    onChange={(e) => setProspectCompany(e.target.value)}
                    placeholder="e.g., Vercel or vercel.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Custom Instructions</label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={2}
                  placeholder="Optional writing constraints or extra emphasis."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                {mode === 'standalone' && (
                  <button
                    type="button"
                    disabled={researching}
                    onClick={handleResearch}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {researching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {researching ? 'Researching...' : 'Research Company'}
                  </button>
                )}

                <button
                  type="button"
                  disabled={!canGenerate || generating}
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {invitations.length > 0 ? 'Regenerate Invitations' : 'Generate 3 Invitations'}
                </button>
              </div>

              {mode === 'standalone' && !brief && !researching && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-5 w-5 text-violet-600" />
                    <div className="space-y-1 text-sm text-gray-600">
                      <p className="font-medium text-gray-800">Workflow</p>
                      <p>1. Paste the event description and enter the prospect details.</p>
                      <p>2. Research the company to assess event relevance.</p>
                      <p>3. Edit the brief, then generate three personalised invitation variants.</p>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'account' && !activeAccount && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-4 text-center text-sm text-gray-500">
                  Select an account from the list to use its research context for personalisation.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Error display */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Research brief (standalone mode) */}
      {brief && mode === 'standalone' && (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Research Brief</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Edit the company context and event relevance assessment before generating invitations.
                </p>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${confidenceTone}`}>
                Confidence: {brief.confidence}
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {brief.confidence === 'low' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-red-800">Low-confidence research brief</p>
                      <p className="mt-1 text-sm text-red-700">
                        Review the challenges and relevance assessment carefully before generating invitations.
                      </p>
                    </div>
                    <label className="flex items-start gap-2 text-sm text-red-800">
                      <input
                        type="checkbox"
                        checked={lowConfidenceConfirmed}
                        onChange={(e) => setLowConfidenceConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                      />
                      <span>I reviewed the brief and want to use it anyway.</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {BRIEF_FIELD_CONFIG.map((field) => {
                const value = brief[field.key];
                const isTextarea = Boolean(field.rows);
                const wide = isTextarea;
                return (
                  <div key={field.key} className={wide ? 'md:col-span-2' : ''}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}</label>
                    {isTextarea ? (
                      <textarea
                        value={typeof value === 'string' ? value : value ?? ''}
                        onChange={(e) => updateBriefField(field.key, e.target.value)}
                        rows={field.rows}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <input
                        type="text"
                        value={typeof value === 'string' ? value : value ?? ''}
                        onChange={(e) => updateBriefField(field.key, e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {brief.evidence.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Evidence</label>
                <div className="space-y-3">
                  {brief.evidence.map((item) => (
                    <div key={item.url} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                          <p className="text-sm text-gray-600">{item.snippet}</p>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Source
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Generated invitations */}
      {invitations.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <h3 className="text-lg font-semibold text-gray-900">Invitation Variants</h3>
            <p className="mt-1 text-sm text-gray-600">
              Three personalised invitations with different positioning angles. Copy the one that fits best.
            </p>
          </div>

          <div className="space-y-4 p-6">
            {invitations.map((invitation, index) => (
              <div
                key={`${invitation.positioningAngle}-${index}`}
                className="rounded-2xl border border-gray-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-violet-300 bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                      {prettyAngle(invitation.positioningAngle)}
                    </span>
                    <span className="text-xs text-gray-500">{wordCount(invitation.body)} words</span>
                  </div>
                  <CopyButton
                    text={invitation.body}
                    label="Copy"
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  />
                </div>

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{invitation.body}</p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Why this angle</p>
                    <p className="mt-1 text-sm text-gray-700">{invitation.positioning}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Key event highlight</p>
                    <p className="mt-1 text-sm text-gray-700">{invitation.keyEventHighlight}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
