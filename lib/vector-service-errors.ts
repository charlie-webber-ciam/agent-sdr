export interface VectorServiceErrorResponse {
  code: 'vector_collection_missing' | 'qdrant_unreachable' | 'qdrant_not_configured' | 'unknown';
  error: string;
  detail?: string;
  status: number;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isMissingVectorCollectionError(error: unknown): boolean {
  const message = errorMessage(error);
  return message.includes('Qdrant request failed (404)') && (
    message.includes('Collection `')
    || message.includes('doesn\'t exist')
    || message.includes('Not found')
  );
}

export function classifyVectorServiceError(error: unknown): VectorServiceErrorResponse | null {
  const message = errorMessage(error);

  if (isMissingVectorCollectionError(error)) {
    return {
      code: 'vector_collection_missing',
      error: 'Similarity search is not ready yet.',
      detail: 'The expected Qdrant collection is missing. Start Qdrant, confirm the embedding endpoint is configured, then backfill vectors to create the active collection.',
      status: 503,
    };
  }

  if (message.includes('QDRANT_URL is not configured')) {
    return {
      code: 'qdrant_not_configured',
      error: 'Similarity search is not configured.',
      detail: 'Set QDRANT_URL, start Qdrant, and verify the embedding endpoint before loading similarity results.',
      status: 503,
    };
  }

  if (
    message.includes('Qdrant request failed')
    || /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/i.test(message)
  ) {
    return {
      code: 'qdrant_unreachable',
      error: 'Similarity search is unavailable right now.',
      detail: 'Qdrant could not be reached. Ensure Qdrant is running and the embedding endpoint is configured before loading similarity results.',
      status: 503,
    };
  }

  return null;
}
