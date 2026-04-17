'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, FileText, Pencil, Sparkles } from 'lucide-react';

interface OverviewHeaderProps {
  accountName: string;
  isDirty: boolean;
  generatedAt: string | null;
  povGeneratedAt: string | null;
  lastEditedAt: string | null;
  documentCount: number;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OverviewHeader({
  accountName,
  isDirty,
  generatedAt,
  povGeneratedAt,
  lastEditedAt,
  documentCount,
}: OverviewHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Overview</h2>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Default workspace
            </Badge>
            {isDirty && (
              <Badge variant="outline" className="animate-pulse border-amber-200 bg-amber-50 text-amber-700">
                Unsaved changes
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Structured account planning for {accountName}
          </p>
        </div>
      </div>

      <TooltipProvider>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Draft</p>
                  <p className="truncate text-xs font-medium text-gray-900">{formatTimestamp(generatedAt)}</p>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Overview draft generation timestamp</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">POV</p>
                  <p className="truncate text-xs font-medium text-gray-900">{formatTimestamp(povGeneratedAt)}</p>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Strategic POV generation timestamp</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-50">
                  <Pencil className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Edited</p>
                  <p className="truncate text-xs font-medium text-gray-900">{formatTimestamp(lastEditedAt)}</p>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Last manual edit timestamp</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">PDFs</p>
                  <p className="truncate text-xs font-medium text-gray-900">{documentCount} attached</p>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Number of attached PDF documents</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
