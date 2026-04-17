'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, Sparkles, Loader2, Eye, EyeOff, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import MarkdownContent from '@/components/MarkdownContent';

interface PerspectiveSectionProps {
  value: string;
  existingNotes: string | null;
  accountId: number;
  researchCompleted: boolean;
  onSave: (value: string) => void;
}

export default function PerspectiveSection({
  value,
  existingNotes,
  accountId,
  researchCompleted,
  onSave,
}: PerspectiveSectionProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [generating, setGenerating] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(value);
    setSaveStatus('idle');
    setEditing(false);
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      if (statusTimeout.current) clearTimeout(statusTimeout.current);
    };
  }, []);

  const markSaved = useCallback(() => {
    setSaveStatus('saved');
    if (statusTimeout.current) clearTimeout(statusTimeout.current);
    statusTimeout.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const handleChange = useCallback((val: string) => {
    setText(val);
    setSaveStatus('saving');
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      onSave(val);
      markSaved();
    }, 1000);
  }, [onSave, markSaved]);

  const handleBlur = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setSaveStatus('saving');
    onSave(text);
    markSaved();
  }, [onSave, text, markSaved]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/generate-perspective`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }
      const data = await res.json();
      setText(data.content);
      onSave(data.content);
    } catch (err) {
      console.error('Failed to generate perspective:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex w-full items-center justify-between px-5 py-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-left">
              <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
              <span className="text-sm font-medium text-gray-900">Perspective</span>
              {saveStatus === 'saving' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Saving...</span>}
              {saveStatus === 'saved' && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Saved</span>}
              {saveStatus === 'idle' && text && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">Has content</span>}
            </button>
          </CollapsibleTrigger>
          <Button
            size="sm"
            variant="outline"
            disabled={generating || !researchCompleted}
            onClick={handleGenerate}
            className="h-7 gap-1.5 text-xs"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Generate with AI
          </Button>
        </div>

        <CollapsibleContent>
          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
            {existingNotes && (
              <div>
                <button
                  onClick={() => setShowExisting(!showExisting)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showExisting ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  Existing SDR Notes
                </button>
                {showExisting && (
                  <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap">
                    {existingNotes}
                  </div>
                )}
              </div>
            )}

            {text && !editing ? (
              <div className="group relative">
                <button
                  onClick={() => setEditing(true)}
                  className="absolute right-2 top-2 rounded-md border border-gray-200 bg-white p-1.5 text-gray-400 opacity-0 shadow-sm transition-opacity hover:text-gray-600 group-hover:opacity-100"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <div
                  className="cursor-pointer rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3"
                  onClick={() => setEditing(true)}
                >
                  <MarkdownContent content={text} compact />
                </div>
              </div>
            ) : (
              <Textarea
                value={text}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={() => {
                  handleBlur();
                  if (text) setTimeout(() => setEditing(false), 150);
                }}
                placeholder="Write your perspective on this account — strategic angle, key signals, outreach approach..."
                className="min-h-[120px] resize-y text-sm"
                autoFocus={editing}
              />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
