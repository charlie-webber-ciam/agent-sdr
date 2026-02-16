const ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /rate.?limit|429/i, message: 'The AI service is busy. This will automatically retry.' },
  { pattern: /ECONNREFUSED|fetch failed|ENOTFOUND/i, message: "Couldn't reach the research service. Check your internet connection." },
  { pattern: /timeout|ETIMEDOUT|timed?\s*out/i, message: 'The research took too long and timed out. Try again.' },
  { pattern: /SQLITE_BUSY/i, message: 'The database is temporarily busy. Try again in a moment.' },
  { pattern: /OPENAI_API_KEY|authentication|unauthorized|401/i, message: 'API authentication failed. Check your API key configuration.' },
  { pattern: /quota|billing|insufficient_quota/i, message: 'API quota exceeded. Check your billing and usage limits.' },
  { pattern: /model.*not.*found|model_not_found/i, message: 'The configured AI model is not available. Check your model settings.' },
];

export function humanizeError(rawError: string | null | undefined): string {
  if (!rawError) return 'Something went wrong. You can retry this account.';

  for (const { pattern, message } of ERROR_PATTERNS) {
    if (pattern.test(rawError)) {
      return message;
    }
  }

  return 'Something went wrong. You can retry this account.';
}
