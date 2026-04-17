'use client';

import MarkdownEditableField from '@/components/overview/MarkdownEditableField';

interface BusinessModelSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export default function BusinessModelSection({ value, onChange }: BusinessModelSectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">How They Make Money</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Revenue streams, customer segments, and pricing.
        </p>
      </div>

      <MarkdownEditableField
        value={value}
        onChange={onChange}
        rows={6}
        placeholder="e.g. SaaS platform with freemium + enterprise tiers. 40% revenue from channel partners. Growing consumer user base (currently 12M MAU) drives identity complexity."
        emptyLabel="Click to describe their revenue model..."
      />
    </div>
  );
}
