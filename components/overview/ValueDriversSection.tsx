'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import MarkdownEditableField from '@/components/overview/MarkdownEditableField';
import {
  AccountValueDriver,
  AUTH0_VALUE_DRIVER_LABELS,
  Auth0ValueDriver,
} from '@/lib/account-overview';
import { Plus, TrendingUp, Trash2 } from 'lucide-react';

interface ValueDriversSectionProps {
  valueDrivers: AccountValueDriver[];
  onUpdate: (index: number, field: 'driver' | 'rationale' | 'evidence', value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export default function ValueDriversSection({
  valueDrivers,
  onUpdate,
  onAdd,
  onRemove,
}: ValueDriversSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Auth0 Value Drivers</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How Auth0 creates value here. The 1-3 drivers that best match their challenges.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{valueDrivers.length}/3</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={onAdd}
            disabled={valueDrivers.length >= 3}
            className="h-7"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      {valueDrivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-8 text-center">
          <TrendingUp className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No value drivers yet</p>
          <p className="mt-1 text-xs text-gray-400">Generate a draft or add one manually.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[]}>
          {valueDrivers.map((driver, index) => (
            <AccordionItem
              key={`driver-${index}`}
              value={`driver-${index}`}
              className="mb-2 rounded-lg border-l-4 border border-gray-200 border-l-blue-400 bg-white px-4 last:mb-0"
            >
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="text-sm font-medium text-gray-900">
                    {AUTH0_VALUE_DRIVER_LABELS[driver.driver] || 'Select driver'}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3 pt-1">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Value driver</Label>
                      <Select
                        value={driver.driver}
                        onValueChange={(value) => onUpdate(index, 'driver', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select a value driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(AUTH0_VALUE_DRIVER_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <Label className="text-xs">Why it fits</Label>
                    <div className="mt-1">
                      <MarkdownEditableField
                        value={driver.rationale}
                        onChange={(v) => onUpdate(index, 'rationale', v)}
                        rows={2}
                        placeholder="e.g. Growing user base (50M+) requires a platform that scales without re-platforming"
                        emptyLabel="Click to add rationale..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Evidence</Label>
                    <div className="mt-1">
                      <MarkdownEditableField
                        value={driver.evidence}
                        onChange={(v) => onUpdate(index, 'evidence', v)}
                        rows={2}
                        placeholder="Signals, facts, or markdown source links that support the fit."
                        emptyLabel="Click to add evidence..."
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
