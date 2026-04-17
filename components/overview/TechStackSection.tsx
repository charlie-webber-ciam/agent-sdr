'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TECH_STACK_CATEGORIES, TechStackItem } from '@/lib/account-overview';
import { Cpu, Plus, Trash2 } from 'lucide-react';

interface TechStackSectionProps {
  items: TechStackItem[];
  onUpdate: (index: number, field: keyof TechStackItem, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

function formatEnumLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const CATEGORY_COLORS: Record<string, string> = {
  identity: 'border-blue-200 bg-blue-50 text-blue-700',
  customer_data: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cloud: 'border-sky-200 bg-sky-50 text-sky-700',
  commerce: 'border-amber-200 bg-amber-50 text-amber-700',
  crm: 'border-violet-200 bg-violet-50 text-violet-700',
  security: 'border-red-200 bg-red-50 text-red-700',
  developer: 'border-gray-200 bg-gray-50 text-gray-700',
  analytics: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  other: 'border-gray-200 bg-gray-50 text-gray-700',
};

export default function TechStackSection({
  items,
  onUpdate,
  onAdd,
  onRemove,
}: TechStackSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Tech Stack</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            What they're using now. Identity stack, cloud, and key platforms.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} className="h-7">
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-8 text-center">
          <Cpu className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No tech stack entries yet</p>
          <p className="mt-1 text-xs text-gray-400">Add visible vendors, platforms, or internal stack clues.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[]}>
          {items.map((item, index) => (
            <AccordionItem
              key={`tech-${index}`}
              value={`tech-${index}`}
              className="mb-2 rounded-lg border border-gray-200 bg-white px-4 last:mb-0"
            >
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="text-sm font-medium text-gray-900">
                    {item.name.trim() || <span className="text-gray-400 italic">Technology {index + 1}</span>}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other}`}>
                    {formatEnumLabel(item.category)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3 pt-1">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={item.category}
                        onValueChange={(value) => onUpdate(index, 'category', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TECH_STACK_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {formatEnumLabel(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Technology</Label>
                        <Input
                          value={item.name}
                          onChange={(e) => onUpdate(index, 'name', e.target.value)}
                          placeholder="e.g. Adobe Commerce, Azure AD B2C, AWS"
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
                  </div>

                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={item.notes}
                      onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                      rows={2}
                      placeholder="e.g. Using competitor for workforce SSO — may consolidate under single vendor"
                      className="mt-1"
                    />
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
