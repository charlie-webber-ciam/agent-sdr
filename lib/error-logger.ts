/**
 * Detailed error logging utility for account processing failures.
 * Extracts and logs all available error details to the console.
 */

export function logDetailedError(context: string, error: unknown): void {
  console.error(`\n${'─'.repeat(60)}`);
  console.error(`ERROR: ${context}`);
  console.error(`Timestamp: ${new Date().toISOString()}`);

  if (error instanceof Error) {
    console.error(`Message: ${error.message}`);
    console.error(`Name: ${error.name}`);

    if (error.stack) {
      console.error(`Stack Trace:\n${error.stack}`);
    }

    if ('cause' in error && error.cause) {
      console.error(`Cause:`, error.cause);
    }

    // OpenAI SDK errors
    if ('status' in error) {
      console.error(`HTTP Status: ${(error as { status: number }).status}`);
    }
    if ('code' in error) {
      console.error(`Error Code: ${(error as { code: string }).code}`);
    }
    if ('type' in error) {
      console.error(`Error Type: ${(error as { type: string }).type}`);
    }
    if ('headers' in error && error.headers) {
      const headers = error.headers as Record<string, string>;
      const rateLimitHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        if (
          key.toLowerCase().startsWith('x-ratelimit') ||
          key.toLowerCase().startsWith('retry-after')
        ) {
          rateLimitHeaders[key] = value;
        }
      }
      if (Object.keys(rateLimitHeaders).length > 0) {
        console.error(`Rate Limit Headers:`, rateLimitHeaders);
      }
    }

    // Network / fetch errors
    if ('errno' in error) {
      console.error(`Errno: ${(error as { errno: string }).errno}`);
    }
    if ('syscall' in error) {
      console.error(`Syscall: ${(error as { syscall: string }).syscall}`);
    }

    // OpenAI agent SDK specific
    if ('response' in error) {
      const resp = (error as { response: unknown }).response;
      if (resp && typeof resp === 'object') {
        if ('status' in resp) {
          console.error(`Response Status: ${(resp as { status: number }).status}`);
        }
        if ('statusText' in resp) {
          console.error(`Response Status Text: ${(resp as { statusText: string }).statusText}`);
        }
        if ('body' in resp) {
          try {
            console.error(`Response Body:`, JSON.stringify((resp as { body: unknown }).body, null, 2));
          } catch {
            console.error(`Response Body (raw):`, (resp as { body: unknown }).body);
          }
        }
      }
    }
  } else if (typeof error === 'string') {
    console.error(`Error String: ${error}`);
  } else {
    try {
      console.error(`Error Object:`, JSON.stringify(error, null, 2));
    } catch {
      console.error(`Error (non-serializable):`, error);
    }
  }

  console.error(`${'─'.repeat(60)}\n`);
}
