import OpenAI from 'openai';
import { createHash } from 'crypto';

import {
  Account,
  VectorPerspective,
  deleteAccountVectorIndexRow,
  getAccount,
  getAccountVectorIndexRows,
  upsertAccountVectorIndex,
} from './db';

const VECTOR_PERSPECTIVES: VectorPerspective[] = ['auth0', 'okta', 'overall'];
const VECTOR_DISTANCE_THRESHOLD = 0.72;

interface VectorDocument {
  perspective: VectorPerspective;
  pointId: string;
  text: string;
  contentHash: string;
  summarySnippet: string;
}

export interface AccountVectorPayload {
  accountId: number;
  companyName: string;
  domain: string | null;
  industry: string;
  perspective: VectorPerspective;
  tier: string | null;
  oktaTier: string | null;
  priorityScore: number | null;
  oktaPriorityScore: number | null;
  auth0AccountOwner: string | null;
  oktaAccountOwner: string | null;
  processedAt: string | null;
  summarySnippet: string;
}

export interface RetrievedAccountVectorPoint {
  id: string;
  payload: AccountVectorPayload;
  vector: number[];
}

interface QdrantPoint {
  id: string;
  vector: number[] | Record<string, number[]>;
  payload: AccountVectorPayload;
}

interface NormalizedSection {
  label: string;
  value: string;
}

interface EmbeddingConfig {
  fingerprint: string;
  requestBody: Record<string, unknown>;
}

function getEmbeddingApiKey(): string {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Embedding API key is not configured. Set EMBEDDING_API_KEY or OPENAI_API_KEY.');
  }
  return apiKey;
}

function getEmbeddingBaseUrl(): string | undefined {
  return process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
}

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
}

function getEmbeddingClient(): OpenAI {
  return new OpenAI({
    apiKey: getEmbeddingApiKey(),
    baseURL: getEmbeddingBaseUrl(),
  });
}

function getQdrantBaseUrl(): string {
  const baseUrl = process.env.QDRANT_URL;
  if (!baseUrl) {
    throw new Error('QDRANT_URL is not configured.');
  }
  return baseUrl.replace(/\/+$/, '');
}

function getQdrantHeaders(): HeadersInit {
  const apiKey = process.env.QDRANT_API_KEY;
  return apiKey ? { 'api-key': apiKey } : {};
}

function isGeminiEmbeddingModel(model: string): boolean {
  return model.toLowerCase().includes('gemini-embedding-001');
}

function getEmbeddingConfig(model: string): EmbeddingConfig {
  if (isGeminiEmbeddingModel(model)) {
    return {
      fingerprint: `${model}:semantic-similarity:normalized:v2`,
      requestBody: {
        task_type: 'SEMANTIC_SIMILARITY',
        taskType: 'SEMANTIC_SIMILARITY',
      },
    };
  }

  return {
    fingerprint: model,
    requestBody: {},
  };
}

function sanitizeCollectionSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function getQdrantCollectionName(): string {
  const prefix = sanitizeCollectionSegment(process.env.QDRANT_COLLECTION_PREFIX || 'agent_sdr');
  const model = sanitizeCollectionSegment(getEmbeddingModel());
  return `${prefix}_account_research_${model}`;
}

function getPointId(accountId: number, perspective: VectorPerspective): string {
  const hash = createHash('sha1')
    .update(`account-vector:${perspective}:${accountId}`)
    .digest('hex');

  const chars = hash.slice(0, 32).split('');
  chars[12] = '5';
  const variantNibble = parseInt(chars[16], 16);
  chars[16] = ((variantNibble & 0x3) | 0x8).toString(16);
  const hex = chars.join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function getAccountVectorPointId(accountId: number, perspective: VectorPerspective): string {
  return getPointId(accountId, perspective);
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/>\s?/g, '')
    .replace(/\|/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

function normalizeText(input: string | null | undefined): string {
  if (!input) return '';
  return stripMarkdown(input)
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function isMeaningfulContent(value: string | null | undefined): boolean {
  const normalized = normalizeText(value);
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  if (lower === 'no information found' || lower === 'no summary available') {
    return false;
  }

  return normalized.length >= 20;
}

function getEmbeddingDocumentCharBudget(): number {
  const model = getEmbeddingModel().toLowerCase();

  if (model.includes('gemini-embedding-001')) {
    // Gemini has a smaller input window than the OpenAI embeddings used previously.
    return 6000;
  }

  if (model.includes('text-embedding-3-small') || model.includes('text-embedding-3-large')) {
    return 24000;
  }

  return 6000;
}

function collectSections(sections: Array<[string, string | null | undefined]>): NormalizedSection[] {
  return sections
    .filter(([, value]) => isMeaningfulContent(value))
    .map(([label, value]) => ({
      label,
      value: normalizeText(value),
    }));
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, maxChars);

  const sliced = text.slice(0, maxChars - 3);
  const preferredBreak = Math.max(
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('; '),
    sliced.lastIndexOf(', '),
    sliced.lastIndexOf(' ')
  );

  if (preferredBreak >= Math.floor((maxChars - 3) * 0.6)) {
    return `${sliced.slice(0, preferredBreak).trimEnd()}...`;
  }

  return `${sliced.trimEnd()}...`;
}

function buildBoundedDocument(header: string, sections: NormalizedSection[]): { text: string; summarySnippet: string } | null {
  const budget = getEmbeddingDocumentCharBudget();
  const parts = [header.trim()];
  let used = parts[0].length;

  for (const section of sections) {
    const prefix = `${section.label}: `;
    const remaining = budget - used - 1;

    if (remaining <= prefix.length + 40) {
      break;
    }

    const availableForValue = remaining - prefix.length;
    const boundedValue = truncateText(section.value, availableForValue);
    parts.push(`${prefix}${boundedValue}`);
    used += 1 + prefix.length + boundedValue.length;
  }

  if (parts.length === 1) {
    return null;
  }

  const body = parts.slice(1).join('\n');
  return {
    text: parts.join('\n'),
    summarySnippet: createSnippet(body.replace(/\n+/g, ' ')),
  };
}

function createSnippet(text: string): string {
  if (text.length <= 280) return text;
  return `${text.slice(0, 277).trimEnd()}...`;
}

function normalizeEmbeddingVector(vector: number[]): number[] {
  let magnitude = 0;

  for (const value of vector) {
    magnitude += value * value;
  }

  const norm = Math.sqrt(magnitude);
  if (!Number.isFinite(norm) || norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

export function buildAccountVectorDocuments(account: Account): VectorDocument[] {
  const sharedIntro = `Company: ${account.company_name}\nDomain: ${account.domain || 'Unknown'}\nIndustry: ${account.industry}`;

  const auth0Sections = collectSections([
    ['Auth0 Executive Summary', account.research_summary],
    ['Current Auth Solution', account.current_auth_solution],
    ['Customer Base', account.customer_base_info],
    ['Security and Compliance', account.security_incidents],
    ['News and Funding', account.news_and_funding],
    ['Tech Transformation', account.tech_transformation],
  ]);

  const oktaSections = collectSections([
    ['Okta Executive Summary', account.okta_research_summary],
    ['Current IAM Solution', account.okta_current_iam_solution],
    ['Workforce Profile', account.okta_workforce_info],
    ['Security and Compliance', account.okta_security_incidents],
    ['News and Funding', account.okta_news_and_funding],
    ['Tech Transformation', account.okta_tech_transformation],
    ['Okta Ecosystem', account.okta_ecosystem],
  ]);

  const definitions: Array<{ perspective: VectorPerspective; sections: NormalizedSection[] }> = [
    { perspective: 'auth0', sections: auth0Sections },
    { perspective: 'okta', sections: oktaSections },
    {
      perspective: 'overall',
      sections: [
        ...auth0Sections,
        ...oktaSections,
      ],
    },
  ];

  return definitions
    .map(({ perspective, sections }) => {
      const document = buildBoundedDocument(
        `${sharedIntro}\nPerspective: ${perspective.toUpperCase()}`,
        sections
      );

      if (!document) return null;

      return {
        perspective,
        pointId: getPointId(account.id, perspective),
        text: document.text,
        contentHash: createHash('sha256').update(document.text).digest('hex'),
        summarySnippet: document.summarySnippet,
      };
    })
    .filter((document): document is VectorDocument => document !== null);
}

async function qdrantRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getQdrantBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getQdrantHeaders(),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qdrant request failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function getCollectionPointCount(collectionName: string): Promise<number> {
  const response = await qdrantRequest<{
    result?: {
      count?: number;
    };
  }>(`/collections/${collectionName}/points/count`, {
    method: 'POST',
    body: JSON.stringify({
      exact: true,
    }),
  });

  return response.result?.count || 0;
}

async function recreateCollection(collectionName: string, vectorSize: number): Promise<void> {
  try {
    await qdrantRequest(`/collections/${collectionName}`, {
      method: 'DELETE',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('404')) {
      throw error;
    }
  }

  await qdrantRequest(`/collections/${collectionName}`, {
    method: 'PUT',
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    }),
  });
}

async function ensureCollection(vectorSize: number): Promise<void> {
  const collectionName = getQdrantCollectionName();

  try {
    const existing = await qdrantRequest<{
      result?: {
        config?: {
          params?: {
            vectors?: { size?: number } | Record<string, { size?: number }>;
          };
        };
      };
    }>(`/collections/${collectionName}`);

    const vectorsConfig = existing.result?.config?.params?.vectors;
    const existingSize = Array.isArray(vectorsConfig)
      ? undefined
      : typeof vectorsConfig === 'object' && vectorsConfig !== null && 'size' in vectorsConfig
        ? Number(vectorsConfig.size)
        : undefined;

    if (existingSize && existingSize !== vectorSize) {
      const pointCount = await getCollectionPointCount(collectionName);

      if (pointCount === 0) {
        await recreateCollection(collectionName, vectorSize);
        return;
      }

      throw new Error(
        `Qdrant collection "${collectionName}" expects vectors of size ${existingSize}, but embeddings are size ${vectorSize}. The collection already has ${pointCount} point(s), so it was not recreated automatically.`
      );
    }

    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('404')) {
      if (!message.includes('Not found') && !message.includes('doesn\'t exist')) {
        throw error;
      }
    }
  }

  await qdrantRequest(`/collections/${collectionName}`, {
    method: 'PUT',
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    }),
  });
}

async function upsertPoints(points: QdrantPoint[]): Promise<void> {
  if (points.length === 0) return;

  await qdrantRequest(`/collections/${getQdrantCollectionName()}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({ points }),
  });
}

export async function deleteVectorPoints(pointIds: string[]): Promise<void> {
  if (pointIds.length === 0) return;

  try {
    await qdrantRequest(`/collections/${getQdrantCollectionName()}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({
        points: pointIds,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('404')) {
      throw error;
    }
  }
}

function normalizeRetrievedVector(vector: unknown): number[] {
  if (Array.isArray(vector)) {
    return vector.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }

  if (vector && typeof vector === 'object') {
    const firstVector = Object.values(vector as Record<string, unknown>)[0];
    if (Array.isArray(firstVector)) {
      return firstVector.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }
  }

  return [];
}

export async function retrieveVectorPoints(pointIds: string[]): Promise<RetrievedAccountVectorPoint[]> {
  if (pointIds.length === 0) return [];

  const response = await qdrantRequest<{
    result?: Array<{
      id: string;
      payload?: AccountVectorPayload;
      vector?: unknown;
      vectors?: unknown;
    }>;
  }>(`/collections/${getQdrantCollectionName()}/points`, {
    method: 'POST',
    body: JSON.stringify({
      ids: pointIds,
      with_payload: true,
      with_vector: true,
    }),
  });

  return (response.result || [])
    .map((point) => ({
      id: String(point.id),
      payload: point.payload as AccountVectorPayload,
      vector: normalizeRetrievedVector(point.vector ?? point.vectors),
    }))
    .filter((point) => point.payload && point.vector.length > 0);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i];
    leftMagnitude += left[i] * left[i];
    rightMagnitude += right[i] * right[i];
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  if (denominator === 0) return 0;
  return dot / denominator;
}

export function getVectorDistanceThreshold(): number {
  return VECTOR_DISTANCE_THRESHOLD;
}

export async function indexAccountResearchVectors(accountOrId: number | Account): Promise<{
  indexed: VectorPerspective[];
  skipped: VectorPerspective[];
  failed: VectorPerspective[];
}> {
  const account = typeof accountOrId === 'number' ? getAccount(accountOrId) : accountOrId;
  if (!account) {
    throw new Error('Account not found for vector indexing.');
  }

  const documents = buildAccountVectorDocuments(account);
  const existingRows = new Map(
    getAccountVectorIndexRows(account.id).map((row) => [row.perspective, row])
  );

  const desiredPerspectives = new Set(documents.map((doc) => doc.perspective));
  const obsoletePerspectives = VECTOR_PERSPECTIVES.filter(
    (perspective) => !desiredPerspectives.has(perspective) && existingRows.has(perspective)
  );

  if (obsoletePerspectives.length > 0) {
    await deleteVectorPoints(obsoletePerspectives.map((perspective) => getPointId(account.id, perspective)));
    for (const perspective of obsoletePerspectives) {
      deleteAccountVectorIndexRow(account.id, perspective);
    }
  }

  if (documents.length === 0) {
    return { indexed: [], skipped: [], failed: [] };
  }

  const embeddingModel = getEmbeddingModel();
  const embeddingConfig = getEmbeddingConfig(embeddingModel);
  const toIndex = documents.filter((document) => {
    const existing = existingRows.get(document.perspective);
    return !existing
      || existing.content_hash !== document.contentHash
      || existing.embedding_model !== embeddingConfig.fingerprint
      || existing.vector_status !== 'indexed';
  });

  const skipped = documents
    .filter((document) => !toIndex.some((candidate) => candidate.perspective === document.perspective))
    .map((document) => document.perspective);

  if (toIndex.length === 0) {
    return { indexed: [], skipped, failed: [] };
  }

  try {
    const client = getEmbeddingClient();
    const embeddingResponse = await client.embeddings.create({
      model: embeddingModel,
      input: toIndex.map((document) => document.text),
      ...embeddingConfig.requestBody,
    } as any);

    const embeddings = embeddingResponse.data.map((item) => {
      const values = item.embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      return isGeminiEmbeddingModel(embeddingModel) ? normalizeEmbeddingVector(values) : values;
    });
    const vectorSize = embeddings[0]?.length || 0;

    if (vectorSize === 0) {
      throw new Error('Embedding response did not include vector data.');
    }

    await ensureCollection(vectorSize);

    const now = new Date().toISOString();
    const points: QdrantPoint[] = toIndex.map((document, index) => ({
      id: document.pointId,
      vector: embeddings[index],
      payload: {
        accountId: account.id,
        companyName: account.company_name,
        domain: account.domain,
        industry: account.industry,
        perspective: document.perspective,
        tier: account.tier,
        oktaTier: account.okta_tier,
        priorityScore: account.priority_score,
        oktaPriorityScore: account.okta_priority_score,
        auth0AccountOwner: account.auth0_account_owner,
        oktaAccountOwner: account.okta_account_owner,
        processedAt: account.processed_at || account.okta_processed_at || null,
        summarySnippet: document.summarySnippet,
      },
    }));

    await upsertPoints(points);

    for (let index = 0; index < toIndex.length; index += 1) {
      const document = toIndex[index];
      upsertAccountVectorIndex({
        account_id: account.id,
        perspective: document.perspective,
        qdrant_point_id: document.pointId,
        content_hash: document.contentHash,
        vector_status: 'indexed',
        last_indexed_at: now,
        last_error: null,
        embedding_model: embeddingConfig.fingerprint,
        dimensions: embeddings[index]?.length || vectorSize,
      });
    }

    return {
      indexed: toIndex.map((document) => document.perspective),
      skipped,
      failed: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    for (const document of toIndex) {
      upsertAccountVectorIndex({
        account_id: account.id,
        perspective: document.perspective,
        qdrant_point_id: document.pointId,
        content_hash: document.contentHash,
        vector_status: 'failed',
        last_indexed_at: null,
        last_error: message,
        embedding_model: embeddingConfig.fingerprint,
        dimensions: existingRows.get(document.perspective)?.dimensions || null,
      });
    }

    return {
      indexed: [],
      skipped,
      failed: toIndex.map((document) => document.perspective),
    };
  }
}

export async function indexAccountResearchVectorsBestEffort(accountId: number): Promise<void> {
  try {
    const result = await indexAccountResearchVectors(accountId);
    const summary = [
      result.indexed.length ? `indexed=${result.indexed.join(',')}` : null,
      result.skipped.length ? `skipped=${result.skipped.join(',')}` : null,
      result.failed.length ? `failed=${result.failed.join(',')}` : null,
    ].filter(Boolean).join(' ');

    console.log(`[Account Vectors] Account ${accountId}: ${summary || 'no vector changes'}`);
  } catch (error) {
    console.error(`[Account Vectors] Failed to index account ${accountId}:`, error);
  }
}
