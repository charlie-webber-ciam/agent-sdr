'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Bot, Copy, MessageSquare, Search, X } from 'lucide-react';

import { usePerspective } from '@/lib/perspective-context';
import { usePageChatContext } from '@/lib/page-chat-context';
import { cn } from '@/lib/utils';

type Perspective = 'auth0' | 'okta';

interface ChatMessage {
  id: number;
  thread_id: number;
  role: 'user' | 'assistant' | 'tool';
  content_markdown: string | null;
  content_json: string | null;
  tool_name: string | null;
  created_at: string;
}

interface ContextAccountOption {
  id: number;
  companyName: string;
  domain: string | null;
  industry: string;
}

interface ContextProspectOption {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  title: string | null;
}

interface EmailResultPayload {
  type?: string;
  subject: string;
  body: string;
  reasoning?: string;
  keyInsights?: string[];
}

interface ManualContext {
  accountId: number | null;
  prospectId: number | null;
}

interface ManualEmailDraftInput {
  prospectName: string;
  prospectTitle: string;
  accountName: string;
  outreachReason: string;
}

const EMPTY_MANUAL_EMAIL_DRAFT: ManualEmailDraftInput = {
  prospectName: '',
  prospectTitle: '',
  accountName: '',
  outreachReason: '',
};

function parseEmailPayload(contentJson: string | null): EmailResultPayload | null {
  if (!contentJson) return null;
  try {
    const parsed = JSON.parse(contentJson);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.subject === 'string' && typeof parsed.body === 'string') {
      return parsed as EmailResultPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function formatProspectName(prospect: ContextProspectOption): string {
  return `${prospect.firstName} ${prospect.lastName}`;
}

function buildManualProspectEmailPrompt(input: ManualEmailDraftInput): string {
  return [
    'Draft a cold outbound email for a prospect who does not have a CRM account or prospect record.',
    'Treat this as a structured manual prospect email request.',
    `Prospect name: ${input.prospectName.trim()}`,
    `Prospect title: ${input.prospectTitle.trim()}`,
    `Account name: ${input.accountName.trim()}`,
    `Reason for emailing / inbound campaign: ${input.outreachReason.trim()}`,
    'Use the account name for brief company research and keep the campaign or reason reflected in the draft.',
  ].join('\n');
}

function CopyButton({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
    >
      <Copy className="h-3.5 w-3.5" />
      {copied ? 'Copied' : label}
    </button>
  );
}

function EmailResultCard({
  payload,
  copiedKey,
  onCopy,
}: {
  payload: EmailResultPayload;
  copiedKey: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  const fullEmail = `Subject: ${payload.subject}\n\n${payload.body}`;

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Email Draft</p>
        <div className="flex items-center gap-1.5">
          <CopyButton
            label="Subject"
            value={payload.subject}
            copied={copiedKey === 'subject'}
            onCopy={(value) => onCopy(value, 'subject')}
          />
          <CopyButton
            label="Body"
            value={payload.body}
            copied={copiedKey === 'body'}
            onCopy={(value) => onCopy(value, 'body')}
          />
          <CopyButton
            label="Full"
            value={fullEmail}
            copied={copiedKey === 'full'}
            onCopy={(value) => onCopy(value, 'full')}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
          <p className="text-sm font-medium text-foreground">{payload.subject}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Body</p>
          <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">{payload.body}</pre>
        </div>
      </div>
    </div>
  );
}

export default function GlobalChatDock() {
  const { perspective } = usePerspective();
  const { pageAccountId, pageProspectId } = usePageChatContext();

  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [manualContext, setManualContext] = useState<ManualContext | null>(null);

  const [accounts, setAccounts] = useState<ContextAccountOption[]>([]);
  const [prospects, setProspects] = useState<ContextProspectOption[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showManualEmailForm, setShowManualEmailForm] = useState(false);
  const [manualEmailDraft, setManualEmailDraft] = useState<ManualEmailDraftInput>(EMPTY_MANUAL_EMAIL_DRAFT);

  const messagesBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const storedManual = localStorage.getItem('sdr-chat-manual-context');
      if (storedManual) {
        const parsed = JSON.parse(storedManual) as ManualContext | null;
        if (parsed && typeof parsed === 'object') {
          setManualContext({
            accountId: parsed.accountId ?? null,
            prospectId: parsed.prospectId ?? null,
          });
        }
      }

      const storedOpen = localStorage.getItem('sdr-chat-open');
      if (storedOpen === 'true') setIsOpen(true);
    } catch {
      // Ignore persisted-state parse errors.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('sdr-chat-manual-context', JSON.stringify(manualContext));
  }, [manualContext, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('sdr-chat-open', isOpen ? 'true' : 'false');
  }, [isOpen, hydrated]);

  const contextSource = manualContext === null ? 'page' : 'manual';
  const selectedAccountId = manualContext ? manualContext.accountId : pageAccountId;
  const selectedProspectId = manualContext ? manualContext.prospectId : pageProspectId;

  const effectiveContext = useMemo(
    () => ({
      accountId: selectedAccountId ?? null,
      prospectId: selectedProspectId ?? null,
      perspective: perspective as Perspective,
    }),
    [selectedAccountId, selectedProspectId, perspective]
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const prospectMap = useMemo(
    () => new Map(prospects.map((prospect) => [prospect.id, prospect])),
    [prospects]
  );

  const selectedAccountLabel = selectedAccountId
    ? accountMap.get(selectedAccountId)?.companyName || `Account #${selectedAccountId}`
    : 'No account';

  const selectedProspectLabel = selectedProspectId
    ? (() => {
        const prospect = prospectMap.get(selectedProspectId);
        return prospect ? formatProspectName(prospect) : `Prospect #${selectedProspectId}`;
      })()
    : 'No prospect';

  const loadContextOptions = useCallback(async (accountId: number | null) => {
    const params = new URLSearchParams();
    if (accountId) params.set('accountId', String(accountId));

    const response = await fetch(`/api/chat/context-options?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to load chat context options');
    }

    setAccounts(data.accounts || []);
    setProspects(data.prospects || []);
  }, []);

  const loadThread = useCallback(async () => {
    setLoadingThread(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('scoped', 'true');
      params.set('perspective', effectiveContext.perspective);
      if (effectiveContext.accountId) params.set('accountId', String(effectiveContext.accountId));
      if (effectiveContext.prospectId) params.set('prospectId', String(effectiveContext.prospectId));

      const response = await fetch(`/api/chat/threads?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load chat thread');
      }

      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat thread');
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, [effectiveContext.accountId, effectiveContext.perspective, effectiveContext.prospectId]);

  useEffect(() => {
    if (!isOpen) return;
    loadContextOptions(selectedAccountId ?? null).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load context options');
    });
  }, [isOpen, selectedAccountId, loadContextOptions]);

  useEffect(() => {
    if (!isOpen) return;
    loadThread();
  }, [isOpen, loadThread]);

  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, sending]);

  const postChatMessage = useCallback(async (
    message: string,
    contextOverride?: {
      accountId: number | null;
      prospectId: number | null;
      perspective: Perspective;
    }
  ) => {
    const response = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context: contextOverride ?? effectiveContext,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to send message');
    }

    return data;
  }, [effectiveContext]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    setInput('');

    try {
      const data = await postChatMessage(trimmed);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleManualEmailSubmit = async () => {
    const prospectName = manualEmailDraft.prospectName.trim();
    const prospectTitle = manualEmailDraft.prospectTitle.trim();
    const accountName = manualEmailDraft.accountName.trim();
    const outreachReason = manualEmailDraft.outreachReason.trim();

    if (!prospectName || !prospectTitle || !accountName || !outreachReason || sending) {
      setError('Prospect name, title, account name, and reason are required for a manual email draft.');
      return;
    }

    const prompt = buildManualProspectEmailPrompt({
      prospectName,
      prospectTitle,
      accountName,
      outreachReason,
    });

    setSending(true);
    setError(null);
    setManualContext({ accountId: null, prospectId: null });

    try {
      const data = await postChatMessage(prompt, {
        accountId: null,
        prospectId: null,
        perspective: perspective as Perspective,
      });

      setMessages(data.messages || []);
      setShowManualEmailForm(false);
      setManualEmailDraft(EMPTY_MANUAL_EMAIL_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to draft manual prospect email');
    } finally {
      setSending(false);
    }
  };

  const handleAccountChange = (value: string) => {
    if (value === '') {
      setManualContext({ accountId: null, prospectId: null });
      return;
    }

    const nextAccountId = Number.parseInt(value, 10);
    if (!Number.isFinite(nextAccountId)) return;

    setManualContext({
      accountId: nextAccountId,
      prospectId: null,
    });
  };

  const handleProspectChange = (value: string) => {
    if (value === '') {
      setManualContext({
        accountId: selectedAccountId ?? null,
        prospectId: null,
      });
      return;
    }

    const prospectId = Number.parseInt(value, 10);
    if (!Number.isFinite(prospectId)) return;
    const selectedProspect = prospects.find((prospect) => prospect.id === prospectId);

    setManualContext({
      accountId: selectedProspect?.accountId ?? selectedAccountId ?? null,
      prospectId,
    });
  };

  const copyValue = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1500);
  };

  const nonToolMessages = messages.filter((message) => message.role !== 'tool');

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
          aria-label="Open AI chat"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-[70] flex h-[min(82vh,760px)] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold leading-tight">SDR Copilot</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Search className="h-3 w-3" />
                    GPT-5.4 + web search
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close AI chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-2 gap-2">
              <select
                value={selectedAccountId ?? ''}
                onChange={(event) => handleAccountChange(event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">No account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.companyName}
                  </option>
                ))}
              </select>
              <select
                value={selectedProspectId ?? ''}
                onChange={(event) => handleProspectChange(event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">No prospect</option>
                {prospects.map((prospect) => (
                  <option key={prospect.id} value={prospect.id}>
                    {formatProspectName(prospect)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                  contextSource === 'manual' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                )}>
                  {contextSource === 'manual' ? 'Manual' : 'Page'}
                </span>
                <p className="truncate text-[11px] text-muted-foreground">{selectedAccountLabel} / {selectedProspectLabel}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setManualContext(null)}
                  className="rounded px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  Use page
                </button>
                <button
                  type="button"
                  onClick={() => setManualContext({ accountId: null, prospectId: null })}
                  className="rounded px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-background px-4 py-3">
            {loadingThread && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Loading conversation...
              </div>
            )}

            {!loadingThread && nonToolMessages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                Ask about this account/prospect, request research, or ask for a prospect email draft.
              </div>
            )}

            {nonToolMessages.map((message) => {
              const isUser = message.role === 'user';
              const emailPayload = !isUser ? parseEmailPayload(message.content_json) : null;

              return (
                <div
                  key={message.id}
                  className={cn('max-w-[92%] rounded-xl px-3 py-2 text-sm shadow-sm', isUser
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'mr-auto border border-border bg-card text-foreground')}
                >
                  {message.content_markdown && (
                    <div className={cn(
                      isUser
                        ? 'prose prose-invert prose-sm max-w-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2'
                        : 'prose prose-sm max-w-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2'
                    )}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                        {message.content_markdown}
                      </ReactMarkdown>
                    </div>
                  )}

                  {!isUser && emailPayload && (
                    <EmailResultCard
                      payload={emailPayload}
                      copiedKey={copiedKey}
                      onCopy={copyValue}
                    />
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="mr-auto rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                Thinking...
              </div>
            )}

            <div ref={messagesBottomRef} />
          </div>

          <div className="border-t border-border bg-muted/20 p-3">
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">No-account prospect email</p>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    Draft for a prospect not linked to a CRM account by entering their details manually.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualEmailForm((current) => !current);
                    setError(null);
                  }}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {showManualEmailForm ? 'Hide form' : 'Open form'}
                </button>
              </div>

              {showManualEmailForm && (
                <div className="mt-3 space-y-2">
                  <input
                    value={manualEmailDraft.prospectName}
                    onChange={(event) => setManualEmailDraft((current) => ({ ...current, prospectName: event.target.value }))}
                    placeholder="Prospect name"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    value={manualEmailDraft.prospectTitle}
                    onChange={(event) => setManualEmailDraft((current) => ({ ...current, prospectTitle: event.target.value }))}
                    placeholder="Prospect title"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    value={manualEmailDraft.accountName}
                    onChange={(event) => setManualEmailDraft((current) => ({ ...current, accountName: event.target.value }))}
                    placeholder="Account name"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <textarea
                    value={manualEmailDraft.outreachReason}
                    onChange={(event) => setManualEmailDraft((current) => ({ ...current, outreachReason: event.target.value }))}
                    placeholder="Reason for emailing / inbound campaign"
                    className="min-h-[84px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    rows={3}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] leading-5 text-muted-foreground">
                      This sends with no CRM account selected and uses the typed company name for brief research.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowManualEmailForm(false);
                          setManualEmailDraft(EMPTY_MANUAL_EMAIL_DRAFT);
                          setError(null);
                        }}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleManualEmailSubmit}
                        disabled={sending}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Draft email
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask with current context..."
                className="min-h-[42px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows={2}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
