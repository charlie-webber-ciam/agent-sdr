'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import SectionRerunModal from './SectionRerunModal';

interface MarkdownSectionProps {
  title: string;
  content: string | null;
  icon?: React.ReactNode;
  id?: string;
  // Comment support
  comment?: string | null;
  onCommentSave?: (content: string) => Promise<void>;
  onCommentDelete?: () => Promise<void>;
  // Re-run support
  sectionKey?: string;
  perspective?: 'auth0' | 'okta';
  allSectionKeys?: string[];
  onRerun?: (sections: string[], additionalContext: string) => Promise<void>;
  isRerunning?: boolean;
}

export default function MarkdownSection({
  title,
  content,
  icon,
  id,
  comment,
  onCommentSave,
  onCommentDelete,
  sectionKey,
  perspective,
  allSectionKeys,
  onRerun,
  isRerunning = false,
}: MarkdownSectionProps) {
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentText, setCommentText] = useState(comment || '');
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);

  const handleSaveComment = async () => {
    if (!commentText.trim() || !onCommentSave) return;
    setIsSavingComment(true);
    try {
      await onCommentSave(commentText.trim());
      setShowCommentForm(false);
      setIsEditingComment(false);
    } catch (err) {
      console.error('Failed to save comment:', err);
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!onCommentDelete) return;
    try {
      await onCommentDelete();
      setCommentText('');
      setShowCommentForm(false);
      setIsEditingComment(false);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  return (
    <div id={id} className="mb-8 scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        {icon && <div className="text-blue-600 flex-shrink-0">{icon}</div>}
        <h3 className="text-2xl font-semibold text-gray-900 flex-1">{title}</h3>
        {/* Re-run button */}
        {sectionKey && perspective && allSectionKeys && onRerun && (
          <SectionRerunModal
            sectionKey={sectionKey}
            sectionLabel={title}
            perspective={perspective}
            allSectionKeys={allSectionKeys}
            onRerun={onRerun}
            isRunning={isRerunning}
          />
        )}
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

      {/* User Comment Section */}
      {onCommentSave && (
        <div className="mt-3">
          {comment && !isEditingComment ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">User Note</span>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => { setIsEditingComment(true); setCommentText(comment); }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDeleteComment}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none prose-p:text-gray-700 prose-p:mb-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {comment}
                </ReactMarkdown>
              </div>
            </div>
          ) : showCommentForm || isEditingComment ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">
                  {isEditingComment ? 'Edit Note' : 'Add Note'}
                </span>
              </div>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add your notes about this section... (supports markdown)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveComment}
                  disabled={isSavingComment || !commentText.trim()}
                  className="px-3 py-1.5 bg-yellow-600 text-white rounded text-xs font-medium hover:bg-yellow-700 transition-colors disabled:bg-gray-400"
                >
                  {isSavingComment ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowCommentForm(false); setIsEditingComment(false); setCommentText(comment || ''); }}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCommentForm(true)}
              className="text-xs text-gray-400 hover:text-yellow-600 font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Add comment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
