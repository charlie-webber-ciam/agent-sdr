'use client';

import { Spinner } from '@/components/Spinner';

interface GenerateButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  loadingLabel: string;
  label: string;
  gradient?: string;
}

export function GenerateButton({
  onClick,
  loading,
  disabled,
  loadingLabel,
  label,
  gradient = 'from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700',
}: GenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`w-full bg-gradient-to-r ${gradient} text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
    >
      {loading ? (
        <>
          <Spinner className="h-5 w-5 text-white" />
          {loadingLabel}
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
