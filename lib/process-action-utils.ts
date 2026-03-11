import { NextResponse } from 'next/server';
import { humanizeError } from './error-messages';
import { logDetailedError } from './error-logger';
import { getErrorMessage } from './worker-error-utils';

export class ProcessActionError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProcessActionError';
    this.status = status;
  }
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ProcessActionError(400, 'Invalid JSON body');
  }
}

export function parseJobId(value: unknown, field = 'jobId'): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ProcessActionError(400, `Invalid ${field}`);
  }

  return parsed;
}

export function assertProcessAction(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) {
    throw new ProcessActionError(status, message);
  }
}

export function runInBackground(context: string, task: () => Promise<void>): void {
  task().catch(error => {
    logDetailedError(`[Background] ${context}`, error);
  });
}

export function processActionErrorResponse(
  context: string,
  error: unknown,
  fallbackMessage: string
): NextResponse {
  if (error instanceof ProcessActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const rawMessage = getErrorMessage(error, fallbackMessage);
  logDetailedError(context, error);

  return NextResponse.json(
    {
      error: fallbackMessage,
      detail: humanizeError(rawMessage),
    },
    { status: 500 }
  );
}
