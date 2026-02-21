/**
 * Processing Configuration
 *
 * Centralized configuration for account processing behavior.
 * Controls parallel vs sequential processing, concurrency limits, and retry behavior.
 */

export const PROCESSING_CONFIG = {
  // Enable parallel processing (feature flag)
  enableParallel: process.env.ENABLE_PARALLEL_PROCESSING !== 'false',

  // Number of accounts to process concurrently (1-10)
  // Conservative: 3, Moderate: 5, Aggressive: 8
  concurrency: parseInt(process.env.PROCESSING_CONCURRENCY || '10', 10),

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

  if (concurrency < 1 || concurrency > 10) {
    console.warn(`Invalid PROCESSING_CONCURRENCY: ${concurrency}. Using default: 10`);
    (PROCESSING_CONFIG as any).concurrency = 10;
  }

  if (maxRetries < 0 || maxRetries > 10) {
    console.warn(`Invalid MAX_API_RETRIES: ${maxRetries}. Using default: 3`);
    (PROCESSING_CONFIG as any).maxRetries = 3;
  }
}

// Run validation on import
validateConfig();
