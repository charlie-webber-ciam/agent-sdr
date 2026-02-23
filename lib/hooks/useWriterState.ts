import { useState, useRef, useCallback } from 'react';

interface UseWriterStateOptions<TResult> {
  accountId: number;
  account?: any;
  endpoint: string;
  buildPayload: () => Record<string, unknown>;
  getResult: (data: any) => TResult;
  researchContext: 'auth0' | 'okta';
  primaryFieldValid: boolean;
  primaryFieldError?: string;
  onSuccess?: (result: TResult) => void;
}

export function useWriterState<TResult>({
  accountId,
  account,
  endpoint,
  buildPayload,
  getResult,
  researchContext,
  primaryFieldValid,
  primaryFieldError = 'Please fill in the required field',
  onSuccess,
}: UseWriterStateOptions<TResult>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  // Keep callbacks in refs so callers don't need to memoize them
  const buildPayloadRef = useRef(buildPayload);
  buildPayloadRef.current = buildPayload;
  const getResultRef = useRef(getResult);
  getResultRef.current = getResult;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const generate = useCallback(async () => {
    if (!primaryFieldValid) {
      setError(primaryFieldError);
      return;
    }

    // Validate research context availability
    if (account) {
      if (researchContext === 'auth0' && !account.processedAt) {
        setError('Auth0 research not available for this account. Please select Okta or run Auth0 research first.');
        return;
      }
      if (researchContext === 'okta' && !account.oktaProcessedAt) {
        setError('Okta research not available for this account. Please select Auth0 or run Okta research first.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/accounts/${accountId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayloadRef.current()),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      const extracted = getResultRef.current(data);
      setResult(extracted);
      onSuccessRef.current?.(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [accountId, account, endpoint, researchContext, primaryFieldValid, primaryFieldError]);

  return { loading, error, result, setError, setResult, generate };
}
