'use client';

import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, RotateCcw, Save, Sparkles } from 'lucide-react';

interface OverviewActionBarProps {
  isDirty: boolean;
  saving: boolean;
  generatingDraft: boolean;
  generatingPov: boolean;
  hasExistingContent: boolean;
  onReset: () => void;
  onGenerateDraft: () => void;
  onSave: () => void;
}

export default function OverviewActionBar({
  isDirty,
  saving,
  generatingDraft,
  generatingPov,
  hasExistingContent,
  onReset,
  onGenerateDraft,
  onSave,
}: OverviewActionBarProps) {
  const isVisible = isDirty || saving || generatingDraft || generatingPov;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 px-6 py-3 shadow-lg backdrop-blur"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isDirty && !saving && !generatingDraft && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  You have unsaved changes
                </span>
              )}
              {generatingDraft && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  Generating overview draft...
                </span>
              )}
              {saving && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  Saving...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={!isDirty || saving || generatingDraft}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerateDraft}
                disabled={saving || generatingDraft || generatingPov}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {generatingDraft ? 'Generating...' : hasExistingContent ? 'Regenerate Draft' : 'Generate Draft'}
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={!isDirty || saving || generatingDraft || generatingPov}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Overview'}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
