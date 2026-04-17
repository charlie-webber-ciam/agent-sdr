'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  UserPlus,
} from 'lucide-react';

import { CopyButton } from '@/components/CopyButton';
import { useToast } from '@/lib/toast-context';
import type {
  LeadReportGenerateResponse,
  LeadReportLead,
} from '@/lib/lead-report-email-writer-schema';

type LeadProgressStatus = 'idle' | 'running' | 'done' | 'error';

interface ParseResponse {
  success: boolean;
  parserMode: 'deterministic' | 'llm';
  parseErrors: string[];
  leads: LeadReportLead[];
}

export default function LeadReportEmailWriter() {
  const toast = useToast();

  const [rawText, setRawText] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [parserMode, setParserMode] = useState<'deterministic' | 'llm' | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [leads, setLeads] = useState<LeadReportLead[]>([]);
  const [results, setResults] = useState<Record<number, LeadReportGenerateResponse>>({});
  const [leadErrors, setLeadErrors] = useState<Record<number, string>>({});
  const [leadStatuses, setLeadStatuses] = useState<Record<number, LeadProgressStatus>>({});
  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchedCount = useMemo(
    () => leads.filter((lead) => lead.match.kind === 'matched').length,
    [leads]
  );
  const researchedMatchedCount = useMemo(
    () => leads.filter((lead) => lead.match.kind === 'matched' && lead.match.hasResearchContext).length,
    [leads]
  );
  const unmatchedCount = leads.length - matchedCount;
  const completedCount = Object.values(leadStatuses).filter((status) => status === 'done').length;
  const failedCount = Object.values(leadStatuses).filter((status) => status === 'error').length;

  const sortedResults = useMemo(
    () => Object.values(results).sort((a, b) => a.rowNumber - b.rowNumber),
    [results]
  );

  const handleParse = async () => {
    if (!rawText.trim()) {
      setError('Paste a lead report first.');
      return;
    }

    setParsing(true);
    setError(null);
    setResults({});
    setLeadErrors({});
    setLeadStatuses({});

    try {
      const response = await fetch('/api/email-writer/lead-report/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });

      const data = (await response.json()) as ParseResponse & { error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse lead report');
      }

      setParserMode(data.parserMode);
      setParseErrors(data.parseErrors || []);
      setLeads(data.leads || []);
      toast.success(`Parsed ${data.leads.length} lead${data.leads.length === 1 ? '' : 's'}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse lead report';
      setError(message);
      toast.error(message);
    } finally {
      setParsing(false);
    }
  };

  const handleGenerateAll = async () => {
    if (leads.length === 0) {
      setError('Parse a lead report first.');
      return;
    }

    setGenerating(true);
    setError(null);
    setResults({});
    setLeadErrors({});
    setLeadStatuses(Object.fromEntries(leads.map((lead) => [lead.rowNumber, 'idle' as const])));

    let cursor = 0;
    const concurrency = Math.min(3, leads.length);

    const worker = async () => {
      while (cursor < leads.length) {
        const lead = leads[cursor++];

        setLeadStatuses((current) => ({ ...current, [lead.rowNumber]: 'running' }));

        try {
          const response = await fetch('/api/email-writer/lead-report/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead,
              customInstructions: customInstructions.trim() || undefined,
            }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || `Failed on row ${lead.rowNumber}`);
          }

          const result = data.result as LeadReportGenerateResponse;
          setResults((current) => ({ ...current, [lead.rowNumber]: result }));
          setLeadStatuses((current) => ({ ...current, [lead.rowNumber]: 'done' }));
        } catch (err) {
          const message = err instanceof Error ? err.message : `Failed on row ${lead.rowNumber}`;
          setLeadErrors((current) => ({ ...current, [lead.rowNumber]: message }));
          setLeadStatuses((current) => ({ ...current, [lead.rowNumber]: 'error' }));
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      toast.success('Lead report processing finished.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lead report processing failed';
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-amber-50 via-white to-blue-50 px-6 py-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-gray-900">Lead Report Email Writer</h2>
            <p className="max-w-4xl text-sm text-gray-600">
              Paste a lead report, auto-match rows to existing accounts, attach matched prospects, and generate one email per lead.
              Unmatched companies fall back to the lightweight live-research flow.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Lead Report Paste</label>
            <textarea
              value={rawText}
              onChange={(event) => {
                setRawText(event.target.value);
                setError(null);
              }}
              rows={16}
              placeholder="Paste the Salesforce or lead report text here..."
              className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Custom Instructions</label>
            <textarea
              value={customInstructions}
              onChange={(event) => setCustomInstructions(event.target.value)}
              rows={3}
              placeholder="Optional batch-level guidance for the emails."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing || generating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {parsing ? 'Parsing...' : 'Parse & Match'}
            </button>
            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={generating || parsing || leads.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generating ? 'Writing Emails...' : 'Write 1 Email Each'}
            </button>
          </div>
        </div>
      </section>

      {leads.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                {leads.length} leads
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {matchedCount} matched
              </span>
              <span className="rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                {researchedMatchedCount} matched with saved research
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {unmatchedCount} unmatched
              </span>
              {parserMode && (
                <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  Parser: {parserMode === 'llm' ? 'LLM' : 'Deterministic'}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto p-6 pt-5">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="pb-3 pr-4">Lead</th>
                  <th className="pb-3 pr-4">Company</th>
                  <th className="pb-3 pr-4">Match</th>
                  <th className="pb-3 pr-4">Context</th>
                  <th className="pb-3 pr-4">Campaign</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => {
                  const status = leadStatuses[lead.rowNumber] || 'idle';
                  return (
                    <tr key={`${lead.rowNumber}-${lead.email || lead.fullName}`} className="align-top">
                      <td className="py-3 pr-4">
                        <p className="text-sm font-semibold text-gray-900">{lead.fullName}</p>
                        <p className="text-xs text-gray-500">{lead.title}</p>
                        {lead.email && <p className="mt-1 text-xs text-gray-500">{lead.email}</p>}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-700">{lead.company}</td>
                      <td className="py-3 pr-4">
                        {lead.match.kind === 'matched' ? (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">{lead.match.accountName}</p>
                            <p className="text-xs text-gray-500">
                              {lead.match.domain || 'No domain'}{lead.match.industry ? ` • ${lead.match.industry}` : ''}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No account match</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          lead.match.kind === 'matched' && lead.match.hasResearchContext
                            ? 'bg-emerald-100 text-emerald-700'
                            : lead.match.kind === 'matched'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {lead.match.kind === 'matched' && lead.match.hasResearchContext
                            ? 'Saved account context'
                            : lead.match.kind === 'matched'
                              ? 'Matched account + live research'
                              : 'Live research'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-600">
                        <div className="max-w-[260px]">
                          <p className="truncate">{lead.campaignName || '-'}</p>
                          {lead.memberStatus && <p className="mt-1 text-xs text-gray-500">{lead.memberStatus}</p>}
                        </div>
                      </td>
                      <td className="py-3">
                        {status === 'running' && (
                          <span className="inline-flex items-center gap-2 text-sm text-blue-700">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Writing...
                          </span>
                        )}
                        {status === 'done' && (
                          <span className="inline-flex items-center gap-2 text-sm text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Ready
                          </span>
                        )}
                        {status === 'error' && (
                          <span className="text-sm text-red-700">{leadErrors[lead.rowNumber] || 'Failed'}</span>
                        )}
                        {status === 'idle' && <span className="text-sm text-gray-500">Not started</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {parseErrors.length > 0 && (
            <div className="border-t border-gray-200 px-6 py-4">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-amber-700">
                  {parseErrors.length} parse warning{parseErrors.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  {parseErrors.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </section>
      )}

      {(completedCount > 0 || failedCount > 0) && (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {completedCount} completed
              </span>
              {failedCount > 0 && (
                <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  {failedCount} failed
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 p-6">
            {sortedResults.map((result) => (
              <div key={`${result.rowNumber}-${result.email || result.fullName}`} className="rounded-2xl border border-gray-200 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-gray-900">{result.fullName}</p>
                      <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                        Row {result.rowNumber}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{result.title} at {result.company}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        result.matchType === 'matched_account_context'
                          ? 'bg-emerald-100 text-emerald-700'
                          : result.matchType === 'matched_account_light_research'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {result.matchType === 'matched_account_context'
                          ? 'Matched account context'
                          : result.matchType === 'matched_account_light_research'
                            ? 'Matched account + live research'
                            : 'Live research only'}
                      </span>
                      {result.prospectStatus !== 'unattached' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                          <UserPlus className="h-3.5 w-3.5" />
                          Prospect {result.prospectStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton
                      text={`Subject: ${result.generatedEmail.subject}\n\n${result.generatedEmail.body}`}
                      label="Copy Email"
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    />
                    {result.accountId && (
                      <Link
                        href={`/accounts/${result.accountId}`}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Account
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Subject</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{result.generatedEmail.subject}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reasoning</p>
                      <p className="mt-1 text-sm text-gray-700">{result.generatedEmail.reasoning}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <p className="whitespace-pre-wrap text-sm text-gray-800">{result.generatedEmail.body}</p>
                    </div>
                    {result.generatedEmail.keyInsights.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Key Insights</p>
                        <ul className="mt-2 space-y-1 text-sm text-gray-700">
                          {result.generatedEmail.keyInsights.map((item, index) => (
                            <li key={`${item}-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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
