'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import MarkdownContent from '@/components/MarkdownContent';
import { ExternalLink, Mail, Plus, Users } from 'lucide-react';

type KeyPerson = {
  id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  department: string | null;
  notes: string | null;
  role_type: 'decision_maker' | 'champion' | 'influencer' | 'blocker' | 'end_user' | 'unknown' | null;
  relationship_status: 'new' | 'engaged' | 'warm' | 'cold';
  source: 'manual' | 'salesforce_import' | 'ai_research';
  updated_at: string;
};

type AddPersonForm = {
  first_name: string;
  last_name: string;
  title: string;
  role_type: 'decision_maker' | 'champion' | 'influencer' | 'blocker' | 'end_user' | 'unknown';
  department: string;
  email: string;
  linkedin_url: string;
  notes: string;
};

const INITIAL_PERSON_FORM: AddPersonForm = {
  first_name: '',
  last_name: '',
  title: '',
  role_type: 'decision_maker',
  department: '',
  email: '',
  linkedin_url: '',
  notes: '',
};

interface KeyPeopleSectionProps {
  keyPeople: KeyPerson[];
  onAddPerson: (form: AddPersonForm) => Promise<void>;
  onOpenProspects: () => void;
  addingPerson: boolean;
  personError: string | null;
}

function formatEnumLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getRoleBadgeClass(roleType: KeyPerson['role_type']): string {
  switch (roleType) {
    case 'decision_maker':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'champion':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'influencer':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'blocker':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'end_user':
      return 'border-slate-200 bg-slate-50 text-slate-700';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700';
  }
}

const ROLE_TYPES = ['decision_maker', 'champion', 'influencer', 'blocker', 'end_user', 'unknown'] as const;

export default function KeyPeopleSection({
  keyPeople,
  onAddPerson,
  onOpenProspects,
  addingPerson,
  personError,
}: KeyPeopleSectionProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [form, setForm] = useState<AddPersonForm>(INITIAL_PERSON_FORM);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setLocalError('First name and last name are required.');
      return;
    }

    await onAddPerson(form);
    setForm(INITIAL_PERSON_FORM);
    setIsPopoverOpen(false);
  };

  const displayError = localError || personError;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Key Decision Makers</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Who buys and who influences? Keep the key players here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenProspects} className="h-7 text-xs">
            Manage in Prospects
          </Button>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7">
                <Plus className="mr-1 h-3 w-3" />
                Add Person
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Add Key Person</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">First name *</Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Last name *</Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. CTO"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Role type</Label>
                    <Select
                      value={form.role_type}
                      onValueChange={(value) => setForm((f) => ({ ...f, role_type: value as AddPersonForm['role_type'] }))}
                    >
                      <SelectTrigger className="mt-1 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_TYPES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {formatEnumLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Department</Label>
                    <Input
                      value={form.department}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      placeholder="e.g. Engineering"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="name@company.com"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">LinkedIn URL</Label>
                  <Input
                    value={form.linkedin_url}
                    onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                    placeholder="https://linkedin.com/in/..."
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="Influence, context, or why this person matters."
                    className="mt-1 text-sm"
                  />
                </div>
                {displayError && (
                  <p className="text-xs text-red-600">{displayError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsPopoverOpen(false)} disabled={addingPerson}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSubmit} disabled={addingPerson}>
                    {addingPerson ? 'Adding...' : 'Add Person'}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {keyPeople.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-10 text-center">
          <Users className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No key people pinned yet</p>
          <p className="mt-1 text-xs text-gray-400">Add one here or manage the broader contact set in the Prospects tab.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2 pr-3">
            {keyPeople.map((person) => (
              <div key={person.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {person.first_name} {person.last_name}
                      </h4>
                      <Badge variant="outline" className={`text-[10px] ${getRoleBadgeClass(person.role_type)}`}>
                        {formatEnumLabel(person.role_type || 'unknown')}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      {person.title || 'No title yet'}
                      {person.department ? ` \u00B7 ${person.department}` : ''}
                    </p>
                    {person.notes && (
                      <div className="text-xs">
                        <MarkdownContent content={person.notes} compact />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      {person.email && (
                        <a className="text-blue-600 hover:text-blue-700" href={`mailto:${person.email}`} title={person.email}>
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {person.linkedin_url && (
                        <a className="text-blue-600 hover:text-blue-700" href={person.linkedin_url} target="_blank" rel="noreferrer" title="LinkedIn">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{formatTimestamp(person.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
