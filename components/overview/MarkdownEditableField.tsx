'use client';

import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import MarkdownContent from '@/components/MarkdownContent';
import { Pencil } from 'lucide-react';

interface MarkdownEditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  compact?: boolean;
  emptyLabel?: string;
}

export default function MarkdownEditableField({
  value,
  onChange,
  placeholder,
  rows = 4,
  compact = true,
  emptyLabel = 'Click to add content...',
}: MarkdownEditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  if (editing) {
    return (
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        placeholder={placeholder}
        rows={rows}
      />
    );
  }

  if (!value.trim()) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50/50 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-gray-400 hover:bg-gray-50"
      >
        <Pencil className="h-3 w-3 shrink-0" />
        {emptyLabel}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group relative w-full cursor-text rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-gray-200 hover:bg-gray-50/50"
    >
      <div className="pointer-events-none absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm ring-1 ring-gray-200">
          <Pencil className="h-2.5 w-2.5" />
          Edit
        </span>
      </div>
      <MarkdownContent content={value} compact={compact} />
    </button>
  );
}
