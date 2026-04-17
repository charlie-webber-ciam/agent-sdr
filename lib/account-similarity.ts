import { Account, VectorPerspective, getAccount, getFilterMetadata, getIndexedAccountsForMap } from './db';
import {
  AccountVectorPayload,
  RetrievedAccountVectorPoint,
  cosineSimilarity,
  getAccountVectorPointId,
  getVectorDistanceThreshold,
  retrieveVectorPoints,
} from './account-vectors';
import { isMissingVectorCollectionError } from './vector-service-errors';
import { getVectorReadProfileVersion, getVectorWriteProfileVersion } from './vector-profile';

export interface MapNeighbor {
  accountId: number;
  companyName: string;
  semanticScore: number;
  hybridScore: number;
  rawScore: number;
  spreadScore: number;
  summarySnippet: string;
}

export interface AccountMapNode {
  id: string;
  accountId: number;
  companyName: string;
  domain: string | null;
  industry: string;
  customerStatus: Account['customer_status'];
  processedAt: string | null;
  profileVersion: string;
  tier: string | null;
  oktaTier: string | null;
  priorityScore: number | null;
  oktaPriorityScore: number | null;
  auth0AccountOwner: string | null;
  oktaAccountOwner: string | null;
  summarySnippet: string;
  clusterId: number;
  nearestNeighbors: MapNeighbor[];
}

export interface AccountMapEdge {
  id: string;
  source: string;
  target: string;
  semanticScore: number;
  hybridScore: number;
  rawScore: number;
  spreadScore: number;
}

export interface SimilarityNormalization {
  method: 'fixed-65-99';
  lowerBound: number;
  upperBound: number;
  median: number | null;
  p90: number | null;
  max: number | null;
  totalPairs: number;
}

interface AccountMapRecord {
  account: Account;
  point: RetrievedAccountVectorPoint;
}

interface RawNeighbor {
  accountId: number;
  companyName: string;
  semanticScore: number;
  hybridScore: number;
  summarySnippet: string;
}

interface EdgeScore {
  source: string;
  target: string;
  semanticScore: number;
  hybridScore: number;
}

interface AccountSimilarityMapFilters {
  perspective: VectorPerspective;
  search?: string;
  customerStatus?: string;
  tier?: string | 'unassigned';
  oktaTier?: string | 'unassigned';
  accountOwner?: string;
  oktaAccountOwner?: string;
  includeGlobalParent?: boolean;
  hqState?: string;
  sortBy?: string;
  limit?: number;
  selectedAccountId?: number;
}

export interface AccountSimilarityMapResult {
  nodes: AccountMapNode[];
  edges: AccountMapEdge[];
  selectedRecord: AccountMapNode | null;
  neighborRecords: AccountMapNode[];
  total: number;
  threshold: number;
  profileVersion: string;
  normalization: SimilarityNormalization;
  filters: ReturnType<typeof getFilterMetadata>;
}

interface AccountComparisonResult {
  left: ReturnType<typeof buildComparisonAccount>;
  right: ReturnType<typeof buildComparisonAccount>;
  profileVersion: string;
  scores: Record<VectorPerspective, { semanticScore: number | null; hybridScore: number | null }>;
}

const DISPLAY_NEIGHBOR_LIMIT = 12;
const FIXED_NORMALIZATION_LOWER_BOUND = 0.65;
const FIXED_NORMALIZATION_UPPER_BOUND = 0.99;

function quantile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) return null;
  if (sortedValues.length === 1) return sortedValues[0];

  const clampedPercentile = Math.min(Math.max(percentile, 0), 1);
  const position = (sortedValues.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const remainder = position - lowerIndex;
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];

  return lower + (upper - lower) * remainder;
}

function buildSimilarityNormalization(scores: number[]): SimilarityNormalization {
  const sortedScores = [...scores].sort((left, right) => left - right);

  return {
    method: 'fixed-65-99',
    lowerBound: FIXED_NORMALIZATION_LOWER_BOUND,
    upperBound: FIXED_NORMALIZATION_UPPER_BOUND,
    median: quantile(sortedScores, 0.5),
    p90: quantile(sortedScores, 0.9),
    max: sortedScores[sortedScores.length - 1] ?? null,
    totalPairs: sortedScores.length,
  };
}

function normalizeSimilarityScore(score: number, normalization: SimilarityNormalization): number {
  if (!Number.isFinite(score)) return 0;

  const span = Math.max(normalization.upperBound - normalization.lowerBound, 0.0001);
  const normalized = (score - normalization.lowerBound) / span;

  return Number(Math.min(Math.max(normalized, 0), 1).toFixed(4));
}

function toNodeId(accountId: number): string {
  return `account-${accountId}`;
}

function buildPayloadMap(points: RetrievedAccountVectorPoint[]): Map<number, AccountVectorPayload & { vector: number[] }> {
  return new Map(
    points.map((point) => [
      point.payload.accountId,
      {
        ...point.payload,
        vector: point.vector,
      },
    ])
  );
}

function buildRecordMap(
  accounts: Account[],
  payloadMap: Map<number, AccountVectorPayload & { vector: number[] }>,
  perspective: VectorPerspective
): Map<number, AccountMapRecord> {
  const records = new Map<number, AccountMapRecord>();

  for (const account of accounts) {
    const payload = payloadMap.get(account.id);
    if (!payload) continue;

    records.set(account.id, {
      account,
      point: {
        id: getAccountVectorPointId(account.id, perspective),
        payload,
        vector: payload.vector,
      },
    });
  }

  return records;
}

function jaccardSimilarity(left: string[], right: string[]): number {
  const leftSet = new Set(left.map((value) => value.toLowerCase()));
  const rightSet = new Set(right.map((value) => value.toLowerCase()));

  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) intersection += 1;
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizeCloseness(left: number | null, right: number | null, maxDifference: number): number {
  if (left === null || right === null || maxDifference <= 0) return 0;
  return Math.max(1 - (Math.abs(left - right) / maxDifference), 0);
}

function getRelevantUseCases(payload: AccountVectorPayload, perspective: VectorPerspective): string[] {
  if (perspective === 'auth0') return payload.useCases;
  if (perspective === 'okta') return payload.oktaUseCases;
  return Array.from(new Set([...payload.useCases, ...payload.oktaUseCases]));
}

function getRelevantSkus(payload: AccountVectorPayload, perspective: VectorPerspective): string[] {
  if (perspective === 'auth0') return payload.auth0Skus;
  if (perspective === 'okta') return payload.oktaSkus;
  return Array.from(new Set([...payload.auth0Skus, ...payload.oktaSkus]));
}

function getPriorityCloseness(
  left: AccountVectorPayload,
  right: AccountVectorPayload,
  perspective: VectorPerspective
): number {
  if (perspective === 'auth0') {
    return normalizeCloseness(left.priorityScore, right.priorityScore, 9);
  }

  if (perspective === 'okta') {
    return normalizeCloseness(left.oktaPriorityScore, right.oktaPriorityScore, 100);
  }

  return Math.max(
    normalizeCloseness(left.priorityScore, right.priorityScore, 9),
    normalizeCloseness(left.oktaPriorityScore, right.oktaPriorityScore, 100)
  );
}

function hasTierMatch(
  left: AccountVectorPayload,
  right: AccountVectorPayload,
  perspective: VectorPerspective
): boolean {
  if (perspective === 'auth0') {
    return !!left.tier && left.tier === right.tier;
  }

  if (perspective === 'okta') {
    return !!left.oktaTier && left.oktaTier === right.oktaTier;
  }

  return (!!left.tier && left.tier === right.tier) || (!!left.oktaTier && left.oktaTier === right.oktaTier);
}

function buildHybridScore(
  left: AccountVectorPayload,
  right: AccountVectorPayload,
  perspective: VectorPerspective,
  semanticScore: number
): number {
  let boost = 0;

  if (hasTierMatch(left, right, perspective)) {
    boost += 0.015;
  }

  boost += 0.02 * getPriorityCloseness(left, right, perspective);
  boost += 0.025 * jaccardSimilarity(getRelevantUseCases(left, perspective), getRelevantUseCases(right, perspective));
  boost += 0.02 * jaccardSimilarity(getRelevantSkus(left, perspective), getRelevantSkus(right, perspective));

  if (left.customerStatus && right.customerStatus && left.customerStatus === right.customerStatus) {
    boost += 0.01;
  }

  if ((perspective === 'okta' || perspective === 'overall')
    && left.oktaOpportunityType
    && left.oktaOpportunityType === right.oktaOpportunityType) {
    boost += 0.01;
  }

  const boundedBoost = Math.min(boost, 0.08);
  return Number(Math.min(Math.max(semanticScore + boundedBoost, -1), 1).toFixed(4));
}

function buildRawNeighborsForRecord(
  source: AccountMapRecord,
  candidates: AccountMapRecord[],
  perspective: VectorPerspective
): RawNeighbor[] {
  const neighbors: RawNeighbor[] = [];

  for (const candidate of candidates) {
    if (candidate.account.id === source.account.id) continue;

    const semanticScore = cosineSimilarity(source.point.vector, candidate.point.vector);
    if (!Number.isFinite(semanticScore)) continue;

    const hybridScore = buildHybridScore(source.point.payload, candidate.point.payload, perspective, semanticScore);
    neighbors.push({
      accountId: candidate.account.id,
      companyName: candidate.account.company_name,
      semanticScore,
      hybridScore,
      summarySnippet: candidate.point.payload.summarySnippet,
    });
  }

  neighbors.sort((left, right) => right.hybridScore - left.hybridScore || right.semanticScore - left.semanticScore);
  return neighbors;
}

function buildNode(
  record: AccountMapRecord,
  clusterId: number,
  neighbors: RawNeighbor[],
  normalization: SimilarityNormalization
): AccountMapNode {
  return {
    id: toNodeId(record.account.id),
    accountId: record.account.id,
    companyName: record.account.company_name,
    domain: record.account.domain,
    industry: record.account.industry,
    customerStatus: record.account.customer_status,
    processedAt: record.account.processed_at,
    profileVersion: record.point.payload.profileVersion,
    tier: record.account.tier,
    oktaTier: record.account.okta_tier,
    priorityScore: record.account.priority_score,
    oktaPriorityScore: record.account.okta_priority_score,
    auth0AccountOwner: record.account.auth0_account_owner,
    oktaAccountOwner: record.account.okta_account_owner,
    summarySnippet: record.point.payload.summarySnippet,
    clusterId,
    nearestNeighbors: neighbors
      .slice(0, DISPLAY_NEIGHBOR_LIMIT)
      .map((neighbor) => ({
        ...neighbor,
        semanticScore: Number(neighbor.semanticScore.toFixed(4)),
        hybridScore: Number(neighbor.hybridScore.toFixed(4)),
        rawScore: Number(neighbor.hybridScore.toFixed(4)),
        spreadScore: normalizeSimilarityScore(neighbor.hybridScore, normalization),
      })),
  };
}

function computeClusters(nodeIds: string[], edges: AccountMapEdge[]): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();

  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set());
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const clusters = new Map<string, number>();
  let clusterId = 0;

  for (const nodeId of nodeIds) {
    if (clusters.has(nodeId)) continue;

    clusterId += 1;
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (clusters.has(current)) continue;

      clusters.set(current, clusterId);
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;

      for (const next of neighbors) {
        if (!clusters.has(next)) {
          queue.push(next);
        }
      }
    }
  }

  return clusters;
}

function buildEmptySimilarityMap(profileVersion: string, total: number, threshold: number): AccountSimilarityMapResult {
  return {
    nodes: [],
    edges: [],
    selectedRecord: null,
    neighborRecords: [],
    total,
    threshold,
    profileVersion,
    normalization: buildSimilarityNormalization([]),
    filters: getFilterMetadata(),
  };
}

function getSimilarityProfileCandidates(perspective: VectorPerspective): string[] {
  const preferredProfileVersion = getVectorReadProfileVersion();
  const writeProfileVersion = getVectorWriteProfileVersion();

  if (preferredProfileVersion === writeProfileVersion) {
    return [preferredProfileVersion];
  }

  const preferredHasIndexedAccounts = getIndexedAccountsForMap({
    perspective,
    profileVersion: preferredProfileVersion,
    limit: 1,
    offset: 0,
  }).total > 0;
  const writeHasIndexedAccounts = getIndexedAccountsForMap({
    perspective,
    profileVersion: writeProfileVersion,
    limit: 1,
    offset: 0,
  }).total > 0;

  if (!preferredHasIndexedAccounts && writeHasIndexedAccounts) {
    return [writeProfileVersion, preferredProfileVersion];
  }

  return writeHasIndexedAccounts
    ? [preferredProfileVersion, writeProfileVersion]
    : [preferredProfileVersion];
}

async function buildAccountSimilarityMapForProfile(
  filters: AccountSimilarityMapFilters,
  profileVersion: string
): Promise<AccountSimilarityMapResult> {
  const threshold = getVectorDistanceThreshold();
  const { accounts: filteredAccounts, total } = getIndexedAccountsForMap({
    ...filters,
    profileVersion,
    limit: filters.limit ?? 200,
    offset: 0,
  });

  if (filteredAccounts.length === 0) {
    return buildEmptySimilarityMap(profileVersion, total, threshold);
  }

  const { accounts: candidateAccounts } = getIndexedAccountsForMap({
    perspective: filters.perspective,
    profileVersion,
    includeGlobalParent: filters.includeGlobalParent,
  });

  const pointIds = candidateAccounts.map((account) => getAccountVectorPointId(account.id, filters.perspective));
  const payloadMap = buildPayloadMap(await retrieveVectorPoints(pointIds, { profileVersion }));
  const candidateRecordMap = buildRecordMap(candidateAccounts, payloadMap, filters.perspective);
  const candidateRecords = Array.from(candidateRecordMap.values());
  const anchorRecords = filteredAccounts.reduce<AccountMapRecord[]>((result, account) => {
    const record = candidateRecordMap.get(account.id);
    if (record) {
      result.push(record);
    }
    return result;
  }, []);

  if (anchorRecords.length === 0) {
    return buildEmptySimilarityMap(profileVersion, total, threshold);
  }

  const neighborMap = new Map<number, RawNeighbor[]>();
  const edgeScores = new Map<string, EdgeScore>();
  const allScores: number[] = [];

  for (let leftIndex = 0; leftIndex < anchorRecords.length; leftIndex += 1) {
    const left = anchorRecords[leftIndex];

    for (let rightIndex = leftIndex + 1; rightIndex < anchorRecords.length; rightIndex += 1) {
      const right = anchorRecords[rightIndex];
      const semanticScore = cosineSimilarity(left.point.vector, right.point.vector);
      if (!Number.isFinite(semanticScore)) continue;

      const hybridScore = buildHybridScore(left.point.payload, right.point.payload, filters.perspective, semanticScore);
      allScores.push(hybridScore);

      const leftNeighbors = neighborMap.get(left.account.id) || [];
      leftNeighbors.push({
        accountId: right.account.id,
        companyName: right.account.company_name,
        semanticScore,
        hybridScore,
        summarySnippet: right.point.payload.summarySnippet,
      });
      neighborMap.set(left.account.id, leftNeighbors);

      const rightNeighbors = neighborMap.get(right.account.id) || [];
      rightNeighbors.push({
        accountId: left.account.id,
        companyName: left.account.company_name,
        semanticScore,
        hybridScore,
        summarySnippet: left.point.payload.summarySnippet,
      });
      neighborMap.set(right.account.id, rightNeighbors);
    }
  }

  const normalization = buildSimilarityNormalization(allScores);

  for (const [accountId, neighbors] of neighborMap.entries()) {
    neighbors.sort((left, right) => right.hybridScore - left.hybridScore || right.semanticScore - left.semanticScore);
    const topNeighbors = neighbors.filter((neighbor) => neighbor.hybridScore >= threshold).slice(0, 3);

    for (const neighbor of topNeighbors) {
      const sourceId = toNodeId(accountId);
      const targetId = toNodeId(neighbor.accountId);
      const key = [sourceId, targetId].sort().join('::');
      const existing = edgeScores.get(key);

      if (!existing || neighbor.hybridScore > existing.hybridScore) {
        edgeScores.set(key, {
          source: sourceId,
          target: targetId,
          semanticScore: neighbor.semanticScore,
          hybridScore: neighbor.hybridScore,
        });
      }
    }
  }

  const edges: AccountMapEdge[] = Array.from(edgeScores.values())
    .map((edge) => ({
      id: edge.source < edge.target ? `${edge.source}-${edge.target}` : `${edge.target}-${edge.source}`,
      source: edge.source,
      target: edge.target,
      semanticScore: Number(edge.semanticScore.toFixed(4)),
      hybridScore: Number(edge.hybridScore.toFixed(4)),
      rawScore: Number(edge.hybridScore.toFixed(4)),
      spreadScore: normalizeSimilarityScore(edge.hybridScore, normalization),
    }))
    .sort((left, right) => right.hybridScore - left.hybridScore || right.semanticScore - left.semanticScore);

  const clusterMap = computeClusters(anchorRecords.map((record) => toNodeId(record.account.id)), edges);

  const nodes: AccountMapNode[] = anchorRecords.map((record) => buildNode(
    record,
    clusterMap.get(toNodeId(record.account.id)) || 0,
    buildRawNeighborsForRecord(record, candidateRecords, filters.perspective),
    normalization
  ));
  const nodeById = new Map(nodes.map((node) => [node.accountId, node]));

  const selectedRecordSource = (
    (filters.selectedAccountId ? candidateRecordMap.get(filters.selectedAccountId) : null)
    || anchorRecords[0]
  );
  const selectedRecord = nodeById.get(selectedRecordSource.account.id)
    || buildNode(
      selectedRecordSource,
      clusterMap.get(toNodeId(selectedRecordSource.account.id)) || 0,
      buildRawNeighborsForRecord(selectedRecordSource, candidateRecords, filters.perspective),
      normalization
    );
  const neighborRecords = selectedRecord.nearestNeighbors.reduce<AccountMapNode[]>((result, neighbor) => {
    const record = candidateRecordMap.get(neighbor.accountId);
    if (!record) return result;

    result.push(buildNode(
      record,
      clusterMap.get(toNodeId(record.account.id)) || 0,
      [],
      normalization
    ));
    return result;
  }, []);

  return {
    nodes,
    edges,
    selectedRecord,
    neighborRecords,
    total,
    threshold,
    profileVersion,
    normalization,
    filters: getFilterMetadata(),
  };
}

export async function buildAccountSimilarityMap(filters: AccountSimilarityMapFilters): Promise<AccountSimilarityMapResult> {
  let lastMissingCollectionError: unknown = null;

  for (const profileVersion of getSimilarityProfileCandidates(filters.perspective)) {
    try {
      return await buildAccountSimilarityMapForProfile(filters, profileVersion);
    } catch (error) {
      if (isMissingVectorCollectionError(error)) {
        lastMissingCollectionError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastMissingCollectionError || new Error('Failed to build account similarity map.');
}

function buildComparisonAccount(account: Account, overallSnippet: string | null, profileVersion: string | null) {
  return {
    id: account.id,
    companyName: account.company_name,
    domain: account.domain,
    industry: account.industry,
    tier: account.tier,
    oktaTier: account.okta_tier,
    auth0AccountOwner: account.auth0_account_owner,
    oktaAccountOwner: account.okta_account_owner,
    researchSummary: account.research_summary,
    oktaResearchSummary: account.okta_research_summary,
    overallSummarySnippet: overallSnippet,
    profileVersion,
  };
}

async function compareAccountsForProfile(
  leftAccount: Account,
  rightAccount: Account,
  profileVersion: string
): Promise<AccountComparisonResult> {
  const overallPointKey = {
    left: getAccountVectorPointId(leftAccount.id, 'overall'),
    right: getAccountVectorPointId(rightAccount.id, 'overall'),
  };
  const pointIds = (['auth0', 'okta', 'overall'] as VectorPerspective[]).flatMap((perspective) => [
    getAccountVectorPointId(leftAccount.id, perspective),
    getAccountVectorPointId(rightAccount.id, perspective),
  ]);

  const points = await retrieveVectorPoints(pointIds, { profileVersion });
  const pointMap = new Map(points.map((point) => [point.id, point]));

  const scores = {
    auth0: { semanticScore: null, hybridScore: null },
    okta: { semanticScore: null, hybridScore: null },
    overall: { semanticScore: null, hybridScore: null },
  } as Record<VectorPerspective, { semanticScore: number | null; hybridScore: number | null }>;

  for (const perspective of ['auth0', 'okta', 'overall'] as VectorPerspective[]) {
    const leftPoint = pointMap.get(getAccountVectorPointId(leftAccount.id, perspective));
    const rightPoint = pointMap.get(getAccountVectorPointId(rightAccount.id, perspective));

    if (leftPoint && rightPoint) {
      const semanticScore = cosineSimilarity(leftPoint.vector, rightPoint.vector);
      scores[perspective] = {
        semanticScore: Number(semanticScore.toFixed(4)),
        hybridScore: buildHybridScore(leftPoint.payload, rightPoint.payload, perspective, semanticScore),
      };
    }
  }

  return {
    left: buildComparisonAccount(
      leftAccount,
      pointMap.get(overallPointKey.left)?.payload.summarySnippet || null,
      pointMap.get(overallPointKey.left)?.payload.profileVersion || null
    ),
    right: buildComparisonAccount(
      rightAccount,
      pointMap.get(overallPointKey.right)?.payload.summarySnippet || null,
      pointMap.get(overallPointKey.right)?.payload.profileVersion || null
    ),
    profileVersion,
    scores,
  };
}

export async function compareAccounts(leftAccountId: number, rightAccountId: number): Promise<AccountComparisonResult> {
  const leftAccount = getAccount(leftAccountId);
  const rightAccount = getAccount(rightAccountId);

  if (!leftAccount || !rightAccount) {
    throw new Error('One or both accounts were not found.');
  }

  let lastMissingCollectionError: unknown = null;

  for (const profileVersion of getSimilarityProfileCandidates('overall')) {
    try {
      return await compareAccountsForProfile(leftAccount, rightAccount, profileVersion);
    } catch (error) {
      if (isMissingVectorCollectionError(error)) {
        lastMissingCollectionError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastMissingCollectionError || new Error('Failed to compare accounts.');
}
