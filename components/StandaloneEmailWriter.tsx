'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
} from 'lucide-react';

import { CopyButton } from '@/components/CopyButton';
import { useToast } from '@/lib/toast-context';
import {
  AUTH0_VALUE_DRIVERS,
  type GeneratedEmailDraft,
  type ResearchBrief,
} from '@/lib/standalone-email-writer-schema';

const BRIEF_FIELD_CONFIG: Array<{
  key: keyof Pick<
    ResearchBrief,
    | 'companyName'
    | 'domain'
    | 'industry'
    | 'prospectName'
    | 'prospectTitle'
    | 'whatTheyDo'
    | 'likelyBusinessModel'
    | 'recentTriggerOrObservation'
    | 'biggestProblem'
    | 'whyThisProblemLikelyMattersToThisProspect'
    | 'businessImpact'
    | 'desiredOutcome'
    | 'commandMessage'
  >;
  label: string;
  rows?: number;
}> = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'domain', label: 'Domain' },
  { key: 'industry', label: 'Industry' },
  { key: 'prospectName', label: 'Prospect Name' },
  { key: 'prospectTitle', label: 'Prospect Title' },
  { key: 'whatTheyDo', label: 'What They Do', rows: 3 },
  { key: 'likelyBusinessModel', label: 'Likely Business Model', rows: 2 },
  { key: 'recentTriggerOrObservation', label: 'Trigger Or Observation', rows: 3 },
  { key: 'biggestProblem', label: 'Biggest Problem', rows: 3 },
  { key: 'whyThisProblemLikelyMattersToThisProspect', label: 'Why It Matters To This Prospect', rows: 3 },
  { key: 'businessImpact', label: 'Business Impact', rows: 3 },
  { key: 'desiredOutcome', label: 'Desired Outcome', rows: 2 },
  { key: 'commandMessage', label: 'Command Of The Message: Auth0 Value Framework', rows: 5 },
];

function formatDraftForCopy(draft: GeneratedEmailDraft): string {
  return `Subject: ${draft.subject}\n\n${draft.body}`;
}

function prettyAngle(angle: GeneratedEmailDraft['angle']): string {
  if (angle === 'loss-aversion') return 'Loss Aversion';
  return angle.charAt(0).toUpperCase() + angle.slice(1);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function StandaloneEmailWriter() {
  const toast = useToast();

  const [companyNameOrDomain, setCompanyNameOrDomain] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [prospectTitle, setProspectTitle] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [drafts, setDrafts] = useState<GeneratedEmailDraft[]>([]);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(0);
  const [promotedAccountId, setPromotedAccountId] = useState<number | null>(null);
  const [lowConfidenceConfirmed, setLowConfidenceConfirmed] = useState(false);

  const [researching, setResearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDraft = drafts[selectedDraftIndex] ?? null;
  const confidenceTone = brief?.confidence === 'high'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : brief?.confidence === 'medium'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-red-200 bg-red-50 text-red-700';

  const canGenerate = useMemo(() => {
    if (!brief) return false;
    if (generating) return false;
    if (brief.confidence === 'low' && !lowConfidenceConfirmed) return false;
    return true;
  }, [brief, generating, lowConfidenceConfirmed]);

  const handleResearch = async () => {
    if (!companyNameOrDomain.trim() || !prospectName.trim() || !prospectTitle.trim()) {
      setError('Company, prospect name, and prospect title are required.');
      return;
    }

    setResearching(true);
    setError(null);
    setDrafts([]);
    setPromotedAccountId(null);

    try {
      const response = await fetch('/api/email-writer/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyNameOrDomain: companyNameOrDomain.trim(),
          prospectName: prospectName.trim(),
          prospectTitle: prospectTitle.trim(),
          customContext: customContext.trim() || undefined,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to research company');
      }

      const nextBrief = data.brief as ResearchBrief;
      setBrief(nextBrief);
      setSelectedDraftIndex(0);
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
    if (!brief) {
      setError('Research the company first.');
      return;
    }

    if (brief.confidence === 'low' && !lowConfidenceConfirmed) {
      setError('Review and confirm the low-confidence brief before generating emails.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/email-writer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate drafts');
      }

      setDrafts(data.drafts as GeneratedEmailDraft[]);
      setSelectedDraftIndex(0);
      toast.success('Three email variants generated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate drafts';
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePromote = async () => {
    if (!brief) {
      setError('Research the company first.');
      return;
    }

    setPromoting(true);
    setError(null);

    try {
      const response = await fetch('/api/email-writer/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          selectedDraft: selectedDraft || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to promote brief');
      }

      setPromotedAccountId(data.accountId as number);
      toast.success('Saved into Accounts.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to promote brief';
      setError(message);
      toast.error(message);
    } finally {
      setPromoting(false);
    }
  };

  const updateBriefField = (field: keyof ResearchBrief, value: string) => {
    setBrief((current) => {
      if (!current) return current;
      if (field === 'domain') {
        return { ...current, domain: value.trim() || null };
      }
      return { ...current, [field]: value } as ResearchBrief;
    });
  };

  const toggleValueDriver = (driver: (typeof AUTH0_VALUE_DRIVERS)[number]) => {
    setBrief((current) => {
      if (!current) return current;

      const hasDriver = current.auth0ValueDrivers.includes(driver);
      const nextDrivers = hasDriver
        ? current.auth0ValueDrivers.filter((item) => item !== driver)
        : [...current.auth0ValueDrivers, driver].slice(0, 3);

      return {
        ...current,
        auth0ValueDrivers: nextDrivers.length > 0 ? nextDrivers : [driver],
      };
    });
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-900">Live Research Email Writer</h2>
              <p className="max-w-3xl text-sm text-gray-600">
                Research the company, edit the pain hypothesis, then generate three short problem-led outbound emails.
              </p>
            </div>
            <div className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              GPT-5.4 research + writing
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Company Name Or Domain *</label>
              <input
                type="text"
                value={companyNameOrDomain}
                onChange={(event) => setCompanyNameOrDomain(event.target.value)}
                placeholder="e.g., vercel.com or Vercel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Prospect Name *</label>
                <input
                  type="text"
                  value={prospectName}
                  onChange={(event) => setProspectName(event.target.value)}
                  placeholder="e.g., Sarah Chen"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Prospect Title *</label>
                <input
                  type="text"
                  value={prospectTitle}
                  onChange={(event) => setProspectTitle(event.target.value)}
                  placeholder="e.g., VP Engineering"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Custom Context</label>
              <textarea
                value={customContext}
                onChange={(event) => setCustomContext(event.target.value)}
                rows={3}
                placeholder="Optional context that should shape the research angle or the email."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Custom Instructions</label>
              <textarea
                value={customInstructions}
                onChange={(event) => setCustomInstructions(event.target.value)}
                rows={3}
                placeholder="Optional writing constraints or extra emphasis."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-800">Workflow</p>
              <div className="mt-2 space-y-2 text-sm text-gray-600">
                <p>1. Run quick web research to identify the company’s likely biggest problem for this prospect.</p>
                <p>2. Edit the brief until the problem framing is sharp and specific.</p>
                <p>3. Generate three short variants, then optionally promote the result into Accounts.</p>
              </div>
            </div>

            <button
              type="button"
              disabled={researching}
              onClick={handleResearch}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {researching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {researching ? 'Researching company...' : 'Research Company'}
            </button>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 shadow-sm">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">What this brief is optimizing for</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>The personalization should attach to a real commercial problem, not surface-level trivia.</p>
                  <p>Use the Auth0 Value Framework to connect company objectives to one clear problem and outcome.</p>
                  <p>The final output is a plain-text cold email that sounds curious and useful, not salesy.</p>
                </div>
              </div>
            </div>

            {promotedAccountId && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Saved to Accounts</p>
                    <p className="mt-1">The reviewed brief is now available as a completed Auth0 account record.</p>
                  </div>
                  <Link
                    href={`/accounts/${promotedAccountId}`}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-3 py-1.5 font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    Open Account
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {brief && (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Research Brief</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Edit the hypothesis before writing so the email stays attached to the prospect’s biggest problem.
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
                        Review the trigger, problem, and desired outcome carefully before generating emails.
                      </p>
                    </div>
                    <label className="flex items-start gap-2 text-sm text-red-800">
                      <input
                        type="checkbox"
                        checked={lowConfidenceConfirmed}
                        onChange={(event) => setLowConfidenceConfirmed(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                      />
                      <span>I reviewed the problem hypothesis and want to use this brief anyway.</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {BRIEF_FIELD_CONFIG.map((field) => {
                const value = brief[field.key];
                const isTextarea = Boolean(field.rows);
                const wide = isTextarea || field.key === 'commandMessage' || field.key === 'recentTriggerOrObservation';
                return (
                  <div key={field.key} className={wide ? 'md:col-span-2' : ''}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}</label>
                    {isTextarea ? (
                      <textarea
                        value={typeof value === 'string' ? value : value ?? ''}
                        onChange={(event) => updateBriefField(field.key, event.target.value)}
                        rows={field.rows}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <input
                        type="text"
                        value={typeof value === 'string' ? value : value ?? ''}
                        onChange={(event) => updateBriefField(field.key, event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Auth0 Value Drivers</label>
                <div className="flex flex-wrap gap-2">
                  {AUTH0_VALUE_DRIVERS.map((driver) => {
                    const active = brief.auth0ValueDrivers.includes(driver);
                    return (
                      <button
                        key={driver}
                        type="button"
                        onClick={() => toggleValueDriver(driver)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          active
                            ? 'border-blue-300 bg-blue-100 text-blue-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {driver}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
              <button
                type="button"
                disabled={!canGenerate}
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {drafts.length > 0 ? 'Regenerate 3 Emails' : 'Generate 3 Emails'}
              </button>
              <button
                type="button"
                disabled={promoting}
                onClick={handlePromote}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Promote To Account
              </button>
            </div>
          </div>
        </section>
      )}

      {drafts.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Email Variants</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Three short angles built from the reviewed brief. Select one if you want that draft stored with the promoted account.
                </p>
              </div>
              {selectedDraft && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Selected for save: {prettyAngle(selectedDraft.angle)}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 p-6">
            {drafts.map((draft, index) => {
              const selected = index === selectedDraftIndex;
              return (
                <div
                  key={`${draft.angle}-${index}`}
                  className={`rounded-2xl border p-5 transition-colors ${
                    selected ? 'border-blue-300 bg-blue-50/70' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
                          {prettyAngle(draft.angle)}
                        </span>
                        <span className="text-xs text-gray-500">{wordCount(draft.body)} words</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Subject</p>
                        <p className="mt-1 text-base font-semibold text-gray-900">{draft.subject}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDraftIndex(index)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          selected
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {selected ? 'Selected' : 'Select For Save'}
                      </button>
                      <CopyButton
                        text={formatDraftForCopy(draft)}
                        label="Copy"
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="whitespace-pre-wrap text-sm text-gray-800">{draft.body}</p>
                  </div>

                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Why this angle</p>
                    <p className="mt-1 text-sm text-gray-700">{draft.rationale}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
