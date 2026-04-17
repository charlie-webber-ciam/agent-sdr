'use client';

import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ChevronUp, Copy, Loader2, Mail, MessageSquare, Phone, Sparkles } from 'lucide-react';

type AgentType = 'email' | 'sequence' | 'cold-call';

const AVAILABLE_MODELS = [
  'claude-4-6-opus',
  'gpt-5.2',
  'gpt-5.4',
  'claude-4-5-sonnet',
  'gpt-5-nano',
  'gemini-3-flash-preview',
  'llama-4-maverick-17b',
];

interface EmailResult {
  subject: string;
  body: string;
  reasoning: string;
  keyInsights: string[];
}

interface SequenceTouch {
  touchNumber: number;
  channel: 'email' | 'linkedin';
  subject?: string;
  body: string;
  angle: string;
  dayDelay: number;
}

interface SequenceResult {
  touches: SequenceTouch[];
  strategy: string;
}

interface ColdCallResult {
  opener: string;
  transitionQuestion: string;
  discoveryQuestions: string[];
  objectionHandles: Array<{ objection: string; response: string }>;
  closingAsk: string;
  reasoning: string;
  keyInsights: string[];
}

interface AgentsSectionProps {
  accountId: number;
  accountName: string;
}

const AGENT_CONFIG: Record<AgentType, { label: string; icon: typeof Mail; description: string }> = {
  email: { label: 'Email', icon: Mail, description: 'Generate a personalized cold email' },
  sequence: { label: 'Sequence', icon: MessageSquare, description: 'Generate a multi-touch outreach sequence' },
  'cold-call': { label: 'Cold Call', icon: Phone, description: 'Generate a cold call opener & script' },
};

export default function AgentsSection({ accountId, accountName }: AgentsSectionProps) {
  const [activeAgent, setActiveAgent] = useState<AgentType>('email');
  const [prospectName, setProspectName] = useState('');
  const [prospectTitle, setProspectTitle] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailResult, setEmailResult] = useState<EmailResult | null>(null);
  const [sequenceResult, setSequenceResult] = useState<SequenceResult | null>(null);
  const [coldCallResult, setColdCallResult] = useState<ColdCallResult | null>(null);

  const [showReasoning, setShowReasoning] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Track which agent initiated the current generation so we store the result
  // correctly even if a re-render changes activeAgent during the async call
  const generatingAgentRef = useRef<AgentType | null>(null);

  const currentResult = activeAgent === 'email' ? emailResult : activeAgent === 'sequence' ? sequenceResult : coldCallResult;

  async function handleGenerate() {
    if (!prospectName.trim() || !prospectTitle.trim()) {
      setError('Prospect name and title are required');
      return;
    }

    // Capture which agent we're generating for — survives re-renders
    const agentType = activeAgent;
    generatingAgentRef.current = agentType;

    setLoading(true);
    setError(null);

    try {
      let endpoint: string;
      let body: Record<string, unknown>;

      if (agentType === 'email') {
        endpoint = `/api/accounts/${accountId}/generate-email`;
        body = {
          recipientName: prospectName.trim(),
          recipientPersona: prospectTitle.trim(),
          emailType: 'cold',
          researchContext: 'auth0',
          customInstructions: customInstructions.trim() || undefined,
          model: selectedModel,
        };
      } else if (agentType === 'sequence') {
        endpoint = `/api/accounts/${accountId}/generate-sequence`;
        body = {
          recipientName: prospectName.trim(),
          recipientPersona: prospectTitle.trim(),
          researchContext: 'auth0',
          customInstructions: customInstructions.trim() || undefined,
          sequenceLength: 5,
          model: selectedModel,
        };
      } else {
        endpoint = `/api/accounts/${accountId}/generate-cold-call`;
        body = {
          recipientName: prospectName.trim(),
          recipientPersona: prospectTitle.trim(),
          researchContext: 'auth0',
          customInstructions: customInstructions.trim() || undefined,
          model: selectedModel,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      // Use the captured agent type, not current activeAgent which may have changed
      if (agentType === 'email') setEmailResult(data.email);
      else if (agentType === 'sequence') setSequenceResult(data.sequence);
      else setColdCallResult(data.coldCall);

      // Ensure we're showing the tab that just finished generating
      setActiveAgent(agentType);
      setShowReasoning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      generatingAgentRef.current = null;
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function CopyButton({ text, field }: { text: string; field: string }) {
    const isCopied = copiedField === field;
    return (
      <button
        onClick={() => copyToClipboard(text, field)}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Shared Inputs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="prospect-name" className="text-xs font-medium text-muted-foreground">Prospect Name</Label>
          <Input
            id="prospect-name"
            placeholder="e.g. Sarah Chen"
            value={prospectName}
            onChange={(e) => setProspectName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prospect-title" className="text-xs font-medium text-muted-foreground">Title / Persona</Label>
          <Input
            id="prospect-title"
            placeholder="e.g. CTO, VP Engineering"
            value={prospectTitle}
            onChange={(e) => setProspectTitle(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="custom-instructions" className="text-xs font-medium text-muted-foreground">
          Instructions <span className="text-muted-foreground/60">(optional)</span>
        </Label>
        <Textarea
          id="custom-instructions"
          placeholder="e.g. Focus on their recent funding round, mention passwordless login..."
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* Agent Type Selector + Model + Generate */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
          {(Object.entries(AGENT_CONFIG) as [AgentType, typeof AGENT_CONFIG['email']][]).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={type}
                onClick={() => !loading && setActiveAgent(type)}
                disabled={loading}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                  activeAgent === type
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </button>
            );
          })}
        </div>

        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="h-7 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <Button
          onClick={handleGenerate}
          disabled={loading || !prospectName.trim() || !prospectTitle.trim()}
          size="sm"
          className="ml-auto gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Generate
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Agent Description */}
      {!currentResult && !loading && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">{AGENT_CONFIG[activeAgent].description}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Uses account research, overview, and notes for context
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Generating {AGENT_CONFIG[activeAgent].label.toLowerCase()} for {prospectName || 'prospect'}...
          </p>
        </div>
      )}

      {/* Email Output */}
      {activeAgent === 'email' && emailResult && !loading && (
        <div className="space-y-3">
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium">{emailResult.subject}</p>
                </div>
                <CopyButton text={`Subject: ${emailResult.subject}\n\n${emailResult.body}`} field="email-full" />
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Body</p>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{emailResult.body}</div>
              </div>
            </CardContent>
          </Card>

          {/* Reasoning (collapsible) */}
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Reasoning & Insights
          </button>
          {showReasoning && (
            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{emailResult.reasoning}</p>
              {emailResult.keyInsights.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {emailResult.keyInsights.map((insight, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{insight}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sequence Output */}
      {activeAgent === 'sequence' && sequenceResult && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              {sequenceResult.touches.length}-touch sequence
            </p>
            <CopyButton
              text={sequenceResult.touches.map((t) =>
                `Touch ${t.touchNumber} (${t.channel}${t.subject ? `, Subject: ${t.subject}` : ''}, Day ${t.dayDelay}):\n${t.body}`
              ).join('\n\n---\n\n')}
              field="sequence-full"
            />
          </div>

          <div className="space-y-2">
            {sequenceResult.touches.map((touch) => (
              <Card key={touch.touchNumber} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {touch.touchNumber}
                    </span>
                    <Badge variant={touch.channel === 'linkedin' ? 'secondary' : 'outline'} className="text-[10px]">
                      {touch.channel === 'linkedin' ? 'LinkedIn' : 'Email'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Day {touch.dayDelay}</span>
                    {touch.angle && (
                      <span className="ml-auto text-[10px] text-muted-foreground italic">{touch.angle}</span>
                    )}
                  </div>
                  {touch.subject && (
                    <p className="mb-1 text-xs text-muted-foreground">
                      <span className="font-medium">Subject:</span> {touch.subject}
                    </p>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{touch.body}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Strategy (collapsible) */}
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Sequence Strategy
          </button>
          {showReasoning && (
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{sequenceResult.strategy}</p>
            </div>
          )}
        </div>
      )}

      {/* Cold Call Output */}
      {activeAgent === 'cold-call' && coldCallResult && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Call script for {prospectName}</p>
            <CopyButton
              text={[
                `OPENER:\n${coldCallResult.opener}`,
                `TRANSITION:\n${coldCallResult.transitionQuestion}`,
                `DISCOVERY QUESTIONS:\n${coldCallResult.discoveryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
                `OBJECTION HANDLES:\n${coldCallResult.objectionHandles.map((o) => `"${o.objection}" → ${o.response}`).join('\n')}`,
                `CLOSING:\n${coldCallResult.closingAsk}`,
              ].join('\n\n')}
              field="cold-call-full"
            />
          </div>

          {/* Opener */}
          <Card className="shadow-sm border-l-2 border-l-green-500">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-green-600 mb-1">Opener</p>
              <p className="text-sm leading-relaxed">{coldCallResult.opener}</p>
            </CardContent>
          </Card>

          {/* Transition */}
          <Card className="shadow-sm border-l-2 border-l-blue-500">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-blue-600 mb-1">Transition</p>
              <p className="text-sm leading-relaxed">{coldCallResult.transitionQuestion}</p>
            </CardContent>
          </Card>

          {/* Discovery Questions */}
          <Card className="shadow-sm border-l-2 border-l-amber-500">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600 mb-1.5">Discovery Questions</p>
              <ol className="space-y-1.5">
                {coldCallResult.discoveryQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground font-medium shrink-0">{i + 1}.</span>
                    <span className="leading-relaxed">{q}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Objection Handles */}
          {coldCallResult.objectionHandles.length > 0 && (
            <Card className="shadow-sm border-l-2 border-l-purple-500">
              <CardContent className="p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-purple-600 mb-1.5">Objection Handles</p>
                <div className="space-y-2">
                  {coldCallResult.objectionHandles.map((oh, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium text-muted-foreground">&ldquo;{oh.objection}&rdquo;</p>
                      <p className="mt-0.5 leading-relaxed text-foreground">{oh.response}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Closing */}
          <Card className="shadow-sm border-l-2 border-l-rose-500">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-rose-600 mb-1">Closing Ask</p>
              <p className="text-sm leading-relaxed">{coldCallResult.closingAsk}</p>
            </CardContent>
          </Card>

          {/* Reasoning (collapsible) */}
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Reasoning & Insights
          </button>
          {showReasoning && (
            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{coldCallResult.reasoning}</p>
              {coldCallResult.keyInsights.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {coldCallResult.keyInsights.map((insight, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{insight}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
