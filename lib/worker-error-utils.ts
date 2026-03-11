import { logDetailedError } from './error-logger';

export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized === '{}' ? fallback : serialized;
  } catch {
    return fallback;
  }
}

export function logWorkerError(context: string, error: unknown): string {
  const message = getErrorMessage(error);
  logDetailedError(context, error);
  return message;
}

export function parseJsonWithFallback<T>(
  raw: string | null | undefined,
  fallback: T,
  context: string
): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logDetailedError(`${context} - invalid JSON`, error);
    return fallback;
  }
}

export function parseFilters(raw: string | null | undefined, context: string): Record<string, unknown> {
  const parsed = parseJsonWithFallback<unknown>(raw, {}, context);

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  if (raw) {
    logDetailedError(`${context} - expected object filters`, new Error('Filters payload must be a JSON object'));
  }

  return {};
}

export function safeErrorCleanup(context: string, cleanup: () => void): void {
  try {
    cleanup();
  } catch (cleanupError) {
    logDetailedError(`${context} - cleanup failed`, cleanupError);
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}
