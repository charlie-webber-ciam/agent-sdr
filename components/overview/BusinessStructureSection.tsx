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
import { BUSINESS_STRUCTURE_TYPES, BusinessStructureItem } from '@/lib/account-overview';
import { Building2, Plus, Trash2 } from 'lucide-react';

interface BusinessStructureSectionProps {
  items: BusinessStructureItem[];
  onUpdate: (index: number, field: keyof BusinessStructureItem, value: string | string[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

function formatEnumLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function BusinessStructureSection({
  items,
  onUpdate,
  onAdd,
  onRemove,
}: BusinessStructureSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Business Structure</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How they're organised. Brands, business units, apps, and regions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} className="h-7">
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-8 text-center">
          <Building2 className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No structure items yet</p>
          <p className="mt-1 text-xs text-gray-400">Add brands, entities, business units, or apps.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={[]}>
          {items.map((item, index) => (
            <AccordionItem
              key={`structure-${index}`}
              value={`structure-${index}`}
              className="mb-2 rounded-lg border border-gray-200 bg-white px-4 last:mb-0"
            >
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="text-sm font-medium text-gray-900">
                    {item.name.trim() || <span className="text-gray-400 italic">Entity {index + 1}</span>}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{formatEnumLabel(item.type)}</Badge>
                  {item.region.trim() && (
                    <Badge variant="outline" className="text-[10px] border-blue-200 bg-blue-50 text-blue-700">{item.region}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3 pt-1">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => onUpdate(index, 'name', e.target.value)}
                        placeholder="e.g. Supercheap Auto"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={item.type}
                          onValueChange={(value) => onUpdate(index, 'type', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUSINESS_STRUCTURE_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {formatEnumLabel(type)}
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
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs">Region</Label>
                      <Input
                        value={item.region}
                        onChange={(e) => onUpdate(index, 'region', e.target.value)}
                        placeholder="e.g. ANZ, Global, APAC"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Associated apps</Label>
                      <Input
                        value={item.associatedApps.join(', ')}
                        onChange={(e) =>
                          onUpdate(
                            index,
                            'associatedApps',
                            e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                          )
                        }
                        placeholder="Comma-separated app or platform names"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={item.notes}
                      onChange={(e) => onUpdate(index, 'notes', e.target.value)}
                      rows={2}
                      placeholder="How this entity fits into the wider structure."
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
