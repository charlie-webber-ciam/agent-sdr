'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
  compact?: boolean;
}

export default function MarkdownContent({ content, className, compact = false }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-li:text-gray-700',
        compact ? 'prose-sm' : 'prose',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: (props) => (
            <a
              className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          ul: (props) => (
            <ul className="my-3 list-disc space-y-1 pl-5" {...props} />
          ),
          ol: (props) => (
            <ol className="my-3 list-decimal space-y-1 pl-5" {...props} />
          ),
          p: (props) => (
            <p className="mb-3 leading-relaxed text-gray-700 last:mb-0" {...props} />
          ),
          blockquote: (props) => (
            <blockquote className="my-3 border-l-4 border-blue-200 bg-blue-50/70 px-4 py-2 italic text-gray-700" {...props} />
          ),
          code: (props) => (
            <code className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[0.9em] text-gray-800" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
