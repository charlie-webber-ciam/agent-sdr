'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MarkdownEditableField from '@/components/overview/MarkdownEditableField';
import { AccountTrigger } from '@/lib/account-overview';
import { Plus, Trash2, Zap } from 'lucide-react';

interface TriggersSectionProps {
  triggers: AccountTrigger[];
  onUpdate: (index: number, field: 'title' | 'detail' | 'source' | 'dateLabel', value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export default function TriggersSection({
  triggers,
  onUpdate,
  onAdd,
  onRemove,
}: TriggersSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Triggers</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            What makes them active right now? Funding, leadership changes, or strategic pivots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{triggers.length}/2</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={onAdd}
            disabled={triggers.length >= 2}
            className="h-7"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      {triggers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-8 text-center">
          <Zap className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No triggers yet</p>
          <p className="mt-1 text-xs text-gray-400">Add one or let the draft generator infer the best supported ones.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[]}>
          {triggers.map((trigger, index) => (
            <AccordionItem
              key={`trigger-${index}`}
              value={`trigger-${index}`}
              className="mb-2 rounded-lg border-l-4 border border-gray-200 border-l-violet-400 bg-white px-4 last:mb-0"
            >
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <Zap className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {trigger.title.trim() || <span className="text-gray-400 italic">Trigger {index + 1}</span>}
                  </span>
                  {trigger.dateLabel.trim() && (
                    <Badge variant="outline" className="ml-1 text-[10px]">{trigger.dateLabel}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3 pt-1">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={trigger.title}
                        onChange={(e) => onUpdate(index, 'title', e.target.value)}
                        placeholder="e.g. New CDO hire signals modernisation mandate"
                        className="mt-1"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => onRemove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs">Detail</Label>
                    <div className="mt-1">
                      <MarkdownEditableField
                        value={trigger.detail}
                        onChange={(v) => onUpdate(index, 'detail', v)}
                        rows={2}
                        placeholder="Why this signal matters now and what it could mean for identity."
                        emptyLabel="Click to add detail..."
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Source</Label>
                      <div className="mt-1">
                        <MarkdownEditableField
                          value={trigger.source}
                          onChange={(v) => onUpdate(index, 'source', v)}
                          rows={2}
                          placeholder="[FY25 annual report](https://...)"
                          emptyLabel="Click to add source..."
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Date or timing</Label>
                      <Input
                        value={trigger.dateLabel}
                        onChange={(e) => onUpdate(index, 'dateLabel', e.target.value)}
                        placeholder="e.g. Feb 2026"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
