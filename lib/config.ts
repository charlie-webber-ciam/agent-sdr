/**
 * Processing Configuration
 *
 * Centralized configuration for account processing behavior.
 * Controls parallel vs sequential processing, concurrency limits, and retry behavior.
 */

export const PROCESSING_CONFIG = {
  // Enable parallel processing (feature flag)
  enableParallel: process.env.ENABLE_PARALLEL_PROCESSING !== 'false',

  // Number of accounts to process concurrently
  concurrency: 50,

  // Maximum retry attempts for rate limit errors
  maxRetries: parseInt(process.env.MAX_API_RETRIES || '3', 10),

  // Initial retry delay in milliseconds (exponential backoff)
  retryDelay: 1000,

  // Delay between accounts to avoid rate limiting (milliseconds)
  accountDelay: parseInt(process.env.ACCOUNT_DELAY_MS || '500', 10),
} as const;

/**
 * Validates configuration values
 */
export function validateConfig(): void {
  const { concurrency, maxRetries } = PROCESSING_CONFIG;

  if (concurrency < 1 || concurrency > 50) {
    console.warn(`Invalid concurrency: ${concurrency}. Using default: 50`);
    (PROCESSING_CONFIG as any).concurrency = 50;
  }

  if (maxRetries < 0 || maxRetries > 10) {
    console.warn(`Invalid MAX_API_RETRIES: ${maxRetries}. Using default: 3`);
    (PROCESSING_CONFIG as any).maxRetries = 3;
  }
}

// Run validation on import
validateConfig();
