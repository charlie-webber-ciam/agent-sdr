import { useEffect, useRef, useState, useCallback } from 'react';

interface UseJobPollingOptions<T> {
  url: string;
  isActive: (data: T) => boolean;
  onData: (data: T) => void;
  onError?: (err: Error) => void;
  intervalMs?: number;
  enabled?: boolean;
}

export function useJobPolling<T>({
  url,
  isActive,
  onData,
  onError,
  intervalMs = 3000,
  enabled = true,
}: UseJobPollingOptions<T>): { loading: boolean; refetch: () => Promise<void> } {
  const [loading, setLoading] = useState(true);
  // Ref that always points to the latest fetch function so setInterval never
  // captures a stale closure.
  const fetchRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Build the fetch function — always uses the latest props via the ref.
  const doFetch = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data: T = await res.json();
      onData(data);
      if (!isActive(data)) {
        stopPolling();
      }
    } catch (err) {
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Keep the ref always pointing at the latest doFetch.
  fetchRef.current = doFetch;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Initial fetch
    fetchRef.current();

    // Start polling — the callback always reads through fetchRef so it
    // never goes stale even if the component re-renders with new callbacks.
    intervalRef.current = setInterval(() => {
      fetchRef.current();
    }, intervalMs);

    return () => stopPolling();
  }, [url, intervalMs, enabled, stopPolling]);

  const refetch = useCallback(async () => {
    await fetchRef.current();
  }, []);

  return { loading, refetch };
}
