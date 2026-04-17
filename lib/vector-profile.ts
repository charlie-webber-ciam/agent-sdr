export const DEFAULT_VECTOR_WRITE_PROFILE_VERSION = 'v2';
export const DEFAULT_VECTOR_READ_PROFILE_VERSION = DEFAULT_VECTOR_WRITE_PROFILE_VERSION;

function sanitizeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function sanitizeProfileVersion(value: string | null | undefined, fallback: string): string {
  const sanitized = sanitizeSegment(value || '');
  return sanitized || fallback;
}

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
}

export function getVectorWriteProfileVersion(): string {
  return sanitizeProfileVersion(process.env.VECTOR_PROFILE_VERSION, DEFAULT_VECTOR_WRITE_PROFILE_VERSION);
}

export function getVectorReadProfileVersion(): string {
  return sanitizeProfileVersion(process.env.VECTOR_READ_PROFILE_VERSION, getVectorWriteProfileVersion());
}

export function getQdrantCollectionName(profileVersion: string, embeddingModel = getEmbeddingModel()): string {
  const prefix = sanitizeSegment(process.env.QDRANT_COLLECTION_PREFIX || 'agent_sdr');
  const model = sanitizeSegment(embeddingModel);
  const version = sanitizeProfileVersion(profileVersion, DEFAULT_VECTOR_WRITE_PROFILE_VERSION);
  return `${prefix}_account_research_${model}_${version}`;
}
