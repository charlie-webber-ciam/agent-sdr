'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import MarkdownEditableField from '@/components/overview/MarkdownEditableField';
import { AlertCircle, BookOpen, Loader2, Sparkles } from 'lucide-react';

interface StrategicPovSectionProps {
  value: string;
  onChange: (value: string) => void;
  onGeneratePov: () => void;
  generatingPov: boolean;
  saving: boolean;
  generatingDraft: boolean;
  isDirty: boolean;
  hasPov: boolean;
}

export default function StrategicPovSection({
  value,
  onChange,
  onGeneratePov,
  generatingPov,
  saving,
  generatingDraft,
  isDirty,
  hasPov,
}: StrategicPovSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Strategic POV</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your account narrative. One compelling POV tying their priorities to Auth0's value.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onGeneratePov}
          disabled={saving || generatingDraft || generatingPov}
          className="h-7"
        >
          {generatingPov ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-1 h-3 w-3" />
              {hasPov ? 'Regenerate POV' : 'Generate POV'}
            </>
          )}
        </Button>
      </div>

      {isDirty && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Save your overview changes before generating the strategic POV.</AlertDescription>
        </Alert>
      )}

      <MarkdownEditableField
        value={value}
        onChange={onChange}
        rows={14}
        compact={false}
        placeholder="Generate the strategic POV from the saved overview, then edit it directly here."
        emptyLabel="Click to write a strategic POV, or generate one above..."
      />
    </div>
  );
}
