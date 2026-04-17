'use client';

import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MarkdownEditableField from '@/components/overview/MarkdownEditableField';
import { AccountPriority } from '@/lib/account-overview';
import { BarChart3, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface PrioritiesSectionProps {
  priorities: AccountPriority[];
  onUpdate: (rank: number, field: 'title' | 'rationale' | 'evidence', value: string) => void;
}

function getCompletionStatus(priority: AccountPriority): 'empty' | 'partial' | 'complete' {
  const hasTitle = priority.title.trim().length > 0;
  const hasRationale = priority.rationale.trim().length > 0;
  const hasEvidence = priority.evidence.trim().length > 0;

  if (hasTitle && hasRationale && hasEvidence) return 'complete';
  if (hasTitle || hasRationale || hasEvidence) return 'partial';
  return 'empty';
}

function CompletionDot({ status }: { status: 'empty' | 'partial' | 'complete' }) {
  const colors = {
    empty: 'bg-gray-200',
    partial: 'bg-amber-400',
    complete: 'bg-emerald-400',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
}

export default function PrioritiesSection({ priorities, onUpdate }: PrioritiesSectionProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const filledCount = priorities.filter((p) => p.title.trim()).length;
  const allExpanded = expandedItems.length === 5;

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedItems([]);
    } else {
      setExpandedItems(priorities.map((p) => `priority-${p.rank}`));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Account Priorities</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            What matters most to their strategy and growth right now?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{filledCount}/5</span>
          <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 px-2 text-xs">
            {allExpanded ? <ChevronsDownUp className="mr-1 h-3 w-3" /> : <ChevronsUpDown className="mr-1 h-3 w-3" />}
            {allExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {filledCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-10 text-center">
          <BarChart3 className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No priorities defined yet</p>
          <p className="mt-1 text-xs text-gray-400">Generate a draft or expand each priority to fill in details.</p>
        </div>
      ) : null}

      <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems}>
        {priorities.map((priority) => {
          const status = getCompletionStatus(priority);
          return (
            <AccordionItem
              key={priority.rank}
              value={`priority-${priority.rank}`}
              className="rounded-lg border border-gray-200 bg-white px-4 mb-2 last:mb-0"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                    {priority.rank}
                  </div>
                  <span className="text-sm font-medium text-gray-900 text-left">
                    {priority.title.trim() || <span className="text-gray-400 italic">Priority {priority.rank}</span>}
                  </span>
                  <CompletionDot status={status} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3 pt-1">
                  <div>
                    <Label htmlFor={`priority-title-${priority.rank}`} className="text-xs">Priority</Label>
                    <Input
                      id={`priority-title-${priority.rank}`}
                      value={priority.title}
                      onChange={(e) => onUpdate(priority.rank, 'title', e.target.value)}
                      placeholder="e.g. Scale identity infrastructure without adding vendor lock-in"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Why it matters</Label>
                    <div className="mt-1">
                      <MarkdownEditableField
                        value={priority.rationale}
                        onChange={(v) => onUpdate(priority.rank, 'rationale', v)}
                        rows={2}
                        placeholder="What business pressure or outcome makes this important?"
                        emptyLabel="Click to add rationale..."
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Evidence</Label>
                    <div className="mt-1">
                      <MarkdownEditableField
                        value={priority.evidence}
                        onChange={(v) => onUpdate(priority.rank, 'evidence', v)}
                        rows={2}
                        placeholder="Markdown supported. Links help: [Annual Report](url) or **bold** key facts."
                        emptyLabel="Click to add evidence..."
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
