'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownSectionProps {
  title: string;
  content: string | null;
  icon?: React.ReactNode;
}

export default function MarkdownSection({
  title,
  content,
  icon
}: MarkdownSectionProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        {icon && <div className="text-blue-600 flex-shrink-0">{icon}</div>}
        <h3 className="text-2xl font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        {content ? (
          <div className="prose prose-blue max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-li:text-gray-700">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={{
              h1: ({ node, ...props }) => (
                <h1 className="text-2xl font-bold mb-4 text-gray-900" {...props} />
              ),
              h2: ({ node, ...props }) => (
                <h2 className="text-xl font-semibold mb-3 text-gray-900" {...props} />
              ),
              h3: ({ node, ...props }) => (
                <h3 className="text-lg font-medium mb-2 text-gray-900" {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul className="list-disc pl-6 space-y-2 my-4" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal pl-6 space-y-2 my-4" {...props} />
              ),
              li: ({ node, ...props }) => (
                <li className="text-gray-700 leading-relaxed" {...props} />
              ),
              p: ({ node, ...props }) => (
                <p className="mb-4 text-gray-700 leading-relaxed" {...props} />
              ),
              a: ({ node, ...props }) => (
                <a
                  className="text-blue-600 hover:text-blue-700 underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                />
              ),
              strong: ({ node, ...props }) => (
                <strong className="font-semibold text-gray-900" {...props} />
              ),
              em: ({ node, ...props }) => (
                <em className="italic text-gray-800" {...props} />
              ),
              code: ({ node, ...props }) => (
                <code
                  className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800 border border-gray-200"
                  {...props}
                />
              ),
              blockquote: ({ node, ...props }) => (
                <blockquote
                  className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-600 bg-blue-50"
                  {...props}
                />
              ),
            }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-gray-500 italic">No information available</p>
        )}
      </div>
    </div>
  );
}
