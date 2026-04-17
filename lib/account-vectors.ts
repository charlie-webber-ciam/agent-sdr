import OpenAI from 'openai';
import { createHash } from 'crypto';

import {
  Account,
  AccountNote,
  AccountTag,
  Prospect,
  SalesforceOpportunity,
  SectionComment,
  VectorPerspective,
  deleteAccountVectorIndexRow,
  getAccount,
  getAccountNotes,
  getAccountTags,
  getAccountVectorIndexRows,
  getOpportunitiesByAccount,
  getProspectsByAccount,
  getSectionComments,
  upsertAccountVectorIndex,
} from './db';
import {
  getEmbeddingModel,
  getQdrantCollectionName,
  getVectorReadProfileVersion,
  getVectorWriteProfileVersion,
} from './vector-profile';

const VECTOR_PERSPECTIVES: VectorPerspective[] = ['auth0', 'okta', 'overall'];
const VECTOR_DISTANCE_THRESHOLD = 0.72;
const OPENAI_EMBEDDING_CHAR_BUDGET = 24000;

interface VectorDocument {
  perspective: VectorPerspective;
  pointId: string;
  text: string;
  contentHash: string;
  summarySnippet: string;
}

interface AccountVectorContext {
  account: Account;
  auth0ResearchLines: string[];
  oktaResearchLines: string[];
  auth0MatrixLines: string[];
  oktaMatrixLines: string[];
  opportunityLines: string[];
  prospectLines: string[];
  auth0AnnotationLines: string[];
  oktaAnnotationLines: string[];
  sharedAnnotationLines: string[];
  activityLines: string[];
  useCases: string[];
  oktaUseCases: string[];
  auth0Skus: string[];
  oktaSkus: string[];
  opportunityCount: number;
  prospectCount: number;
  noteCount: number;
  commentCount: number;
}

export interface AccountVectorPayload {
  accountId: number;
  companyName: string;
  domain: string | null;
  industry: string;
  perspective: VectorPerspective;
  profileVersion: string;
  customerStatus: Account['customer_status'];
  tier: string | null;
  oktaTier: string | null;
  priorityScore: number | null;
  oktaPriorityScore: number | null;
  auth0AccountOwner: string | null;
  oktaAccountOwner: string | null;
  processedAt: string | null;
  summarySnippet: string;
  useCases: string[];
  oktaUseCases: string[];
  auth0Skus: string[];
  oktaSkus: string[];
  oktaOpportunityType: string | null;
  opportunityCount: number;
  prospectCount: number;
  noteCount: number;
  commentCount: number;
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

interface EmbeddingConfig {
  fingerprint: string;
  requestBody: Record<string, unknown>;
}

interface ProfileBlock {
  title: string;
  lines: string[];
  baseBudget: number;
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

function hasNarrativeContent(value: string | null | undefined): boolean {
  const normalized = normalizeText(value);
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  if (lower === 'no information found' || lower === 'no summary available') {
    return false;
  }

  return normalized.length >= 20;
}

function hasCompactContent(value: string | null | undefined): boolean {
  return normalizeText(value).length > 0;
}

function getEmbeddingDocumentCharBudget(): number {
  const model = getEmbeddingModel().toLowerCase();

  if (model.includes('gemini-embedding-001')) {
    return 6000;
  }

  if (model.includes('text-embedding-3-small') || model.includes('text-embedding-3-large')) {
    return OPENAI_EMBEDDING_CHAR_BUDGET;
  }

  return 6000;
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

function createSnippet(text: string): string {
  if (text.length <= 280) return text;
  return `${text.slice(0, 277).trimEnd()}...`;
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeStringList(value: string | null | undefined): string[] {
  if (!value) return [];

  const parsed = safeJsonParse<unknown>(value);
  if (Array.isArray(parsed)) {
    return Array.from(new Set(
      parsed
        .map((item) => normalizeText(typeof item === 'string' ? item : String(item)))
        .filter(Boolean)
    ));
  }

  const normalized = normalizeText(value);
  if (!normalized) return [];

  return Array.from(new Set(
    normalized
      .split(/[,\n;]/)
      .map((item) => normalizeText(item))
      .filter(Boolean)
  ));
}

function collectNarrativeLines(entries: Array<[string, string | null | undefined]>): string[] {
  return entries
    .filter(([, value]) => hasNarrativeContent(value))
    .map(([label, value]) => `${label}: ${normalizeText(value)}`);
}

function addCompactLine(lines: string[], label: string, value: string | null | undefined): void {
  const normalized = normalizeText(value);
  if (!normalized) return;
  lines.push(`${label}: ${normalized}`);
}

function addCompactListLine(lines: string[], label: string, values: string[]): void {
  if (values.length === 0) return;
  lines.push(`${label}: ${values.join(', ')}`);
}

function rolePriority(roleType: Prospect['role_type']): number {
  switch (roleType) {
    case 'decision_maker':
      return 0;
    case 'champion':
      return 1;
    case 'influencer':
      return 2;
    case 'blocker':
      return 3;
    case 'end_user':
      return 4;
    default:
      return 5;
  }
}

function valueTierPriority(valueTier: string | null): number {
  switch ((valueTier || '').toUpperCase()) {
    case 'HVT':
      return 0;
    case 'MVT':
      return 1;
    case 'LVT':
      return 2;
    default:
      return 3;
  }
}

function sortProspects(prospects: Prospect[]): Prospect[] {
  return [...prospects].sort((left, right) => {
    const roleDelta = rolePriority(left.role_type) - rolePriority(right.role_type);
    if (roleDelta !== 0) return roleDelta;

    const valueTierDelta = valueTierPriority(left.value_tier) - valueTierPriority(right.value_tier);
    if (valueTierDelta !== 0) return valueTierDelta;

    const leftActivity = left.last_activity_date || '';
    const rightActivity = right.last_activity_date || '';
    if (leftActivity !== rightActivity) {
      return rightActivity.localeCompare(leftActivity);
    }

    return left.sort_order - right.sort_order || left.id - right.id;
  });
}

function serializeOpportunity(opportunity: SalesforceOpportunity): string {
  const parts = [
    `Opportunity: ${normalizeText(opportunity.opportunity_name)}`,
  ];

  if (hasCompactContent(opportunity.stage)) parts.push(`Stage ${normalizeText(opportunity.stage)}`);
  if (hasCompactContent(opportunity.last_stage_change_date)) parts.push(`Changed ${normalizeText(opportunity.last_stage_change_date)}`);
  if (hasNarrativeContent(opportunity.business_use_case)) parts.push(`Use case ${normalizeText(opportunity.business_use_case)}`);
  if (hasNarrativeContent(opportunity.identify_pain)) parts.push(`Pain ${normalizeText(opportunity.identify_pain)}`);
  if (hasNarrativeContent(opportunity.decision_criteria)) parts.push(`Criteria ${normalizeText(opportunity.decision_criteria)}`);
  if (hasNarrativeContent(opportunity.champions)) {
    const championTitle = hasCompactContent(opportunity.champion_title) ? ` (${normalizeText(opportunity.champion_title)})` : '';
    parts.push(`Champion ${normalizeText(opportunity.champions)}${championTitle}`);
  }
  if (hasNarrativeContent(opportunity.competition)) parts.push(`Competition ${normalizeText(opportunity.competition)}`);

  return parts.join('; ');
}

function serializeProspect(prospect: Prospect): string {
  const name = `${normalizeText(prospect.first_name)} ${normalizeText(prospect.last_name)}`.trim();
  const title = normalizeText(prospect.title);
  const department = normalizeText(prospect.department);
  const roleType = normalizeText(prospect.role_type);
  const valueTier = normalizeText(prospect.value_tier);
  const readiness = normalizeText(prospect.contact_readiness);
  const summarySource = hasNarrativeContent(prospect.ai_summary)
    ? prospect.ai_summary
    : hasNarrativeContent(prospect.notes)
      ? prospect.notes
      : prospect.description;

  const descriptors = [
    title,
    department,
    roleType,
    valueTier,
    readiness,
  ].filter(Boolean);

  const parts = [name || 'Unnamed prospect'];
  if (descriptors.length > 0) {
    parts.push(`(${descriptors.join(' | ')})`);
  }

  if (hasNarrativeContent(summarySource)) {
    parts.push(`- ${normalizeText(summarySource)}`);
  }

  return parts.join(' ');
}

function serializeSectionComment(comment: SectionComment): string {
  return `Comment ${comment.perspective}/${comment.section_key}: ${normalizeText(comment.content)}`;
}

function serializeAccountNote(note: AccountNote): string {
  return `Note: ${normalizeText(note.content)}`;
}

function buildAccountVectorContext(account: Account): AccountVectorContext {
  const useCases = normalizeStringList(account.use_cases);
  const oktaUseCases = normalizeStringList(account.okta_use_cases);
  const auth0Skus = normalizeStringList(account.auth0_skus);
  const oktaSkus = normalizeStringList(account.okta_skus);

  const opportunities = getOpportunitiesByAccount(account.id);
  const prospects = sortProspects(getProspectsByAccount(account.id));
  const tags = getAccountTags(account.id);
  const comments = getSectionComments(account.id);
  const notes = getAccountNotes(account.id);

  const auth0MatrixLines: string[] = [];
  if (hasCompactContent(account.tier)) addCompactLine(auth0MatrixLines, 'Auth0 Tier', account.tier);
  if (account.priority_score !== null) auth0MatrixLines.push(`Auth0 Priority Score: ${account.priority_score}/10`);
  addCompactLine(auth0MatrixLines, 'Estimated ARR', account.estimated_annual_revenue);
  addCompactLine(auth0MatrixLines, 'Estimated User Volume', account.estimated_user_volume);
  addCompactListLine(auth0MatrixLines, 'Use Cases', useCases);
  addCompactListLine(auth0MatrixLines, 'Relevant SKUs', auth0Skus);
  if (hasNarrativeContent(account.sdr_notes)) addCompactLine(auth0MatrixLines, 'SDR Notes', account.sdr_notes);

  const oktaMatrixLines: string[] = [];
  if (hasCompactContent(account.okta_tier)) addCompactLine(oktaMatrixLines, 'Okta Tier', account.okta_tier);
  if (account.okta_priority_score !== null) oktaMatrixLines.push(`Okta Priority Score: ${account.okta_priority_score}/100`);
  addCompactLine(oktaMatrixLines, 'Okta Opportunity Type', account.okta_opportunity_type);
  addCompactLine(oktaMatrixLines, 'Estimated ARR', account.okta_estimated_annual_revenue);
  addCompactLine(oktaMatrixLines, 'Estimated User Volume', account.okta_estimated_user_volume);
  addCompactListLine(oktaMatrixLines, 'Use Cases', oktaUseCases);
  addCompactListLine(oktaMatrixLines, 'Relevant SKUs', oktaSkus);
  if (hasNarrativeContent(account.okta_sdr_notes)) addCompactLine(oktaMatrixLines, 'SDR Notes', account.okta_sdr_notes);

  if (hasCompactContent(account.triage_auth0_tier) || hasCompactContent(account.triage_okta_tier)) {
    auth0MatrixLines.push(
      `Triage: Auth0 ${account.triage_auth0_tier || 'n/a'}, Okta ${account.triage_okta_tier || 'n/a'}`
    );
    oktaMatrixLines.push(
      `Triage: Auth0 ${account.triage_auth0_tier || 'n/a'}, Okta ${account.triage_okta_tier || 'n/a'}`
    );
  }
  if (hasNarrativeContent(account.triage_summary)) {
    addCompactLine(auth0MatrixLines, 'Triage Summary', account.triage_summary);
    addCompactLine(oktaMatrixLines, 'Triage Summary', account.triage_summary);
  }

  const auth0AnnotationLines = comments
    .filter((comment) => comment.perspective === 'auth0')
    .map(serializeSectionComment);
  const oktaAnnotationLines = comments
    .filter((comment) => comment.perspective === 'okta')
    .map(serializeSectionComment);
  const sharedAnnotationLines = [
    ...(tags.length > 0 ? [`Tags: ${tags.map((tag: AccountTag) => normalizeText(tag.tag)).filter(Boolean).join(', ')}`] : []),
    ...notes.slice(0, 3).filter((note) => hasNarrativeContent(note.content)).map(serializeAccountNote),
  ];

  return {
    account,
    auth0ResearchLines: collectNarrativeLines([
      ['Command of the Message', account.command_of_message],
      ['Auth0 Executive Summary', account.research_summary],
      ['Current Auth Solution', account.current_auth_solution],
      ['Customer Base', account.customer_base_info],
      ['Security and Compliance', account.security_incidents],
      ['News and Funding', account.news_and_funding],
      ['Tech Transformation', account.tech_transformation],
    ]),
    oktaResearchLines: collectNarrativeLines([
      ['Okta Executive Summary', account.okta_research_summary],
      ['Current IAM Solution', account.okta_current_iam_solution],
      ['Workforce Profile', account.okta_workforce_info],
      ['Security and Compliance', account.okta_security_incidents],
      ['News and Funding', account.okta_news_and_funding],
      ['Tech Transformation', account.okta_tech_transformation],
      ['Okta Ecosystem', account.okta_ecosystem],
    ]),
    auth0MatrixLines,
    oktaMatrixLines,
    opportunityLines: opportunities.slice(0, 3).map(serializeOpportunity),
    prospectLines: prospects.slice(0, 5).map(serializeProspect),
    auth0AnnotationLines,
    oktaAnnotationLines,
    sharedAnnotationLines,
    activityLines: hasNarrativeContent(account.activity_summary)
      ? [`Activity Summary: ${normalizeText(account.activity_summary)}`]
      : [],
    useCases,
    oktaUseCases,
    auth0Skus,
    oktaSkus,
    opportunityCount: opportunities.length,
    prospectCount: prospects.length,
    noteCount: notes.length,
    commentCount: comments.length,
  };
}

function getSharedHeaderLines(account: Account): string[] {
  const lines = [
    `Company: ${normalizeText(account.company_name) || 'Unknown'}`,
    `Domain: ${normalizeText(account.domain) || 'Unknown'}`,
    `Industry: ${normalizeText(account.industry) || 'Unknown'}`,
  ];

  if (hasCompactContent(account.customer_status)) lines.push(`Customer Status: ${normalizeText(account.customer_status)}`);
  if (hasCompactContent(account.parent_company)) lines.push(`Parent Company: ${normalizeText(account.parent_company)}`);
  if (hasCompactContent(account.parent_company_region)) {
    lines.push(`Parent Company Region: ${normalizeText(account.parent_company_region)}`);
  }

  return lines;
}

function getBlocksForPerspective(context: AccountVectorContext, perspective: VectorPerspective): ProfileBlock[] {
  const sharedBlock: ProfileBlock = {
    title: 'Company Context',
    lines: getSharedHeaderLines(context.account),
    baseBudget: 1000,
  };

  const sharedOpportunities: ProfileBlock = {
    title: 'Opportunity History',
    lines: context.opportunityLines,
    baseBudget: 3000,
  };

  const sharedProspects: ProfileBlock = {
    title: 'Prospect Coverage',
    lines: context.prospectLines,
    baseBudget: 2500,
  };

  const sharedActivity: ProfileBlock = {
    title: 'Activity Summary',
    lines: context.activityLines,
    baseBudget: perspective === 'okta' ? 1000 : 500,
  };

  if (perspective === 'auth0') {
    return [
      sharedBlock,
      { title: 'Auth0 Research', lines: context.auth0ResearchLines, baseBudget: 13000 },
      { title: 'Auth0 Matrix', lines: context.auth0MatrixLines, baseBudget: 2500 },
      sharedOpportunities,
      sharedProspects,
      {
        title: 'Annotations',
        lines: [...context.auth0AnnotationLines, ...context.sharedAnnotationLines],
        baseBudget: 1500,
      },
      sharedActivity,
    ];
  }

  if (perspective === 'okta') {
    return [
      sharedBlock,
      { title: 'Okta Research', lines: context.oktaResearchLines, baseBudget: 12000 },
      { title: 'Okta Matrix', lines: context.oktaMatrixLines, baseBudget: 3000 },
      sharedOpportunities,
      sharedProspects,
      {
        title: 'Annotations',
        lines: [...context.oktaAnnotationLines, ...context.sharedAnnotationLines],
        baseBudget: 1500,
      },
      sharedActivity,
    ];
  }

  return [
    sharedBlock,
    { title: 'Auth0 Research', lines: context.auth0ResearchLines, baseBudget: 6500 },
    { title: 'Okta Research', lines: context.oktaResearchLines, baseBudget: 5500 },
    {
      title: 'Matrix Criteria',
      lines: [
        ...context.auth0MatrixLines,
        ...context.oktaMatrixLines,
      ],
      baseBudget: 3500,
    },
    sharedOpportunities,
    sharedProspects,
    {
      title: 'Annotations',
      lines: [
        ...context.auth0AnnotationLines,
        ...context.oktaAnnotationLines,
        ...context.sharedAnnotationLines,
      ],
      baseBudget: 1500,
    },
    sharedActivity,
  ];
}

function scaleBlocksToBudget(blocks: ProfileBlock[], availableBudget: number): ProfileBlock[] {
  const scale = Math.min(availableBudget / OPENAI_EMBEDDING_CHAR_BUDGET, 1);
  return blocks.map((block) => ({
    ...block,
    baseBudget: Math.max(Math.floor(block.baseBudget * scale), 0),
  }));
}

function fitLinesToBudget(lines: string[], budget: number): string {
  if (budget <= 0) return '';

  const parts: string[] = [];
  let used = 0;

  for (const line of lines) {
    const normalized = normalizeText(line);
    if (!normalized) continue;

    const separatorLength = parts.length > 0 ? 1 : 0;
    const remaining = budget - used - separatorLength;
    if (remaining <= 40) break;

    const bounded = truncateText(normalized, remaining);
    if (!bounded) continue;

    parts.push(bounded);
    used += separatorLength + bounded.length;
  }

  return parts.join('\n');
}

function buildProfileDocument(account: Account, perspective: VectorPerspective, blocks: ProfileBlock[]): { text: string; summarySnippet: string } | null {
  const header = `${getSharedHeaderLines(account).join('\n')}\nPerspective: ${perspective.toUpperCase()}`;
  const remainingBudget = Math.max(getEmbeddingDocumentCharBudget() - header.length - 2, 0);
  const scaledBlocks = scaleBlocksToBudget(blocks, remainingBudget);
  const sections = scaledBlocks.reduce<string[]>((result, block) => {
    const body = fitLinesToBudget(block.lines, block.baseBudget);
    if (!body) return result;

    result.push(`${block.title}:\n${body}`);
    return result;
  }, []);

  if (sections.length === 0) return null;

  const body = sections.join('\n\n');
  return {
    text: `${header}\n\n${body}`,
    summarySnippet: createSnippet(body.replace(/\n+/g, ' ')),
  };
}

export function buildAccountVectorDocuments(account: Account, profileVersion = getVectorWriteProfileVersion()): VectorDocument[] {
  const context = buildAccountVectorContext(account);

  return VECTOR_PERSPECTIVES
    .map((perspective) => {
      const document = buildProfileDocument(account, perspective, getBlocksForPerspective(context, perspective));
      if (!document) return null;

      return {
        perspective,
        pointId: getPointId(account.id, perspective),
        text: document.text,
        contentHash: createHash('sha256')
          .update(`${profileVersion}:${document.text}`)
          .digest('hex'),
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

async function ensureCollection(vectorSize: number, profileVersion = getVectorWriteProfileVersion()): Promise<void> {
  const collectionName = getQdrantCollectionName(profileVersion);

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

async function upsertPoints(points: QdrantPoint[], profileVersion = getVectorWriteProfileVersion()): Promise<void> {
  if (points.length === 0) return;

  await qdrantRequest(`/collections/${getQdrantCollectionName(profileVersion)}/points?wait=true`, {
    method: 'PUT',
    body: JSON.stringify({ points }),
  });
}

export async function deleteVectorPoints(
  pointIds: string[],
  options?: {
    profileVersion?: string;
  }
): Promise<void> {
  if (pointIds.length === 0) return;

  try {
    await qdrantRequest(`/collections/${getQdrantCollectionName(options?.profileVersion || getVectorWriteProfileVersion())}/points/delete?wait=true`, {
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

export async function retrieveVectorPoints(
  pointIds: string[],
  options?: {
    profileVersion?: string;
  }
): Promise<RetrievedAccountVectorPoint[]> {
  if (pointIds.length === 0) return [];

  const profileVersion = options?.profileVersion || getVectorReadProfileVersion();
  const response = await qdrantRequest<{
    result?: Array<{
      id: string;
      payload?: AccountVectorPayload;
      vector?: unknown;
      vectors?: unknown;
    }>;
  }>(`/collections/${getQdrantCollectionName(profileVersion)}/points`, {
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

  const profileVersion = getVectorWriteProfileVersion();
  const collectionName = getQdrantCollectionName(profileVersion);
  const documents = buildAccountVectorDocuments(account, profileVersion);
  const existingRows = new Map(
    getAccountVectorIndexRows(account.id, { profileVersion }).map((row) => [row.perspective, row])
  );

  const desiredPerspectives = new Set(documents.map((doc) => doc.perspective));
  const obsoletePerspectives = VECTOR_PERSPECTIVES.filter(
    (perspective) => !desiredPerspectives.has(perspective) && existingRows.has(perspective)
  );

  if (obsoletePerspectives.length > 0) {
    await deleteVectorPoints(
      obsoletePerspectives.map((perspective) => getPointId(account.id, perspective)),
      { profileVersion }
    );
    for (const perspective of obsoletePerspectives) {
      deleteAccountVectorIndexRow(account.id, perspective, profileVersion);
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
      || existing.vector_status !== 'indexed'
      || existing.collection_name !== collectionName;
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

    await ensureCollection(vectorSize, profileVersion);

    const context = buildAccountVectorContext(account);
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
        profileVersion,
        customerStatus: account.customer_status,
        tier: account.tier,
        oktaTier: account.okta_tier,
        priorityScore: account.priority_score,
        oktaPriorityScore: account.okta_priority_score,
        auth0AccountOwner: account.auth0_account_owner,
        oktaAccountOwner: account.okta_account_owner,
        processedAt: account.processed_at || account.okta_processed_at || null,
        summarySnippet: document.summarySnippet,
        useCases: context.useCases,
        oktaUseCases: context.oktaUseCases,
        auth0Skus: context.auth0Skus,
        oktaSkus: context.oktaSkus,
        oktaOpportunityType: account.okta_opportunity_type,
        opportunityCount: context.opportunityCount,
        prospectCount: context.prospectCount,
        noteCount: context.noteCount,
        commentCount: context.commentCount,
      },
    }));

    await upsertPoints(points, profileVersion);

    for (let index = 0; index < toIndex.length; index += 1) {
      const document = toIndex[index];
      upsertAccountVectorIndex({
        account_id: account.id,
        perspective: document.perspective,
        profile_version: profileVersion,
        qdrant_point_id: document.pointId,
        collection_name: collectionName,
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
        profile_version: profileVersion,
        qdrant_point_id: document.pointId,
        collection_name: collectionName,
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
