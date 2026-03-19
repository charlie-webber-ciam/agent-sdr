import { Account, VectorPerspective, getAccount, getFilterMetadata, getIndexedAccountsForMap } from './db';
import {
  AccountVectorPayload,
  RetrievedAccountVectorPoint,
  cosineSimilarity,
  getAccountVectorPointId,
  getVectorDistanceThreshold,
  retrieveVectorPoints,
} from './account-vectors';

export interface MapNeighbor {
  accountId: number;
  companyName: string;
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
  processedAt: string | null;
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
  rawScore: number;
  summarySnippet: string;
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

function buildRawNeighborsForRecord(
  source: AccountMapRecord,
  candidates: AccountMapRecord[]
): RawNeighbor[] {
  const neighbors: RawNeighbor[] = [];

  for (const candidate of candidates) {
    if (candidate.account.id === source.account.id) continue;

    const score = cosineSimilarity(source.point.vector, candidate.point.vector);
    if (!Number.isFinite(score)) continue;

    neighbors.push({
      accountId: candidate.account.id,
      companyName: candidate.account.company_name,
      rawScore: score,
      summarySnippet: candidate.point.payload.summarySnippet,
    });
  }

  neighbors.sort((left, right) => right.rawScore - left.rawScore);
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
    processedAt: record.account.processed_at,
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
        rawScore: Number(neighbor.rawScore.toFixed(4)),
        spreadScore: normalizeSimilarityScore(neighbor.rawScore, normalization),
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

export async function buildAccountSimilarityMap(filters: {
  perspective: VectorPerspective;
  search?: string;
  tier?: string | 'unassigned';
  oktaTier?: string | 'unassigned';
  accountOwner?: string;
  oktaAccountOwner?: string;
  includeGlobalParent?: boolean;
  hqState?: string;
  sortBy?: string;
  limit?: number;
  selectedAccountId?: number;
}): Promise<{
  nodes: AccountMapNode[];
  edges: AccountMapEdge[];
  selectedRecord: AccountMapNode | null;
  neighborRecords: AccountMapNode[];
  total: number;
  threshold: number;
  normalization: SimilarityNormalization;
  filters: ReturnType<typeof getFilterMetadata>;
}> {
  const threshold = getVectorDistanceThreshold();
  const { accounts: filteredAccounts, total } = getIndexedAccountsForMap({
    ...filters,
    limit: filters.limit ?? 200,
    offset: 0,
  });

  if (filteredAccounts.length === 0) {
    return {
      nodes: [],
      edges: [],
      selectedRecord: null,
      neighborRecords: [],
      total,
      threshold,
      normalization: buildSimilarityNormalization([]),
      filters: getFilterMetadata(),
    };
  }

  const { accounts: candidateAccounts } = getIndexedAccountsForMap({
    perspective: filters.perspective,
    includeGlobalParent: filters.includeGlobalParent,
  });

  const pointIds = candidateAccounts.map((account) => getAccountVectorPointId(account.id, filters.perspective));
  const payloadMap = buildPayloadMap(await retrieveVectorPoints(pointIds));
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
    return {
      nodes: [],
      edges: [],
      selectedRecord: null,
      neighborRecords: [],
      total,
      threshold,
      normalization: buildSimilarityNormalization([]),
      filters: getFilterMetadata(),
    };
  }

  const neighborMap = new Map<number, RawNeighbor[]>();
  const edgeScores = new Map<string, { source: string; target: string; rawScore: number }>();
  const allScores: number[] = [];

  for (let leftIndex = 0; leftIndex < anchorRecords.length; leftIndex += 1) {
    const left = anchorRecords[leftIndex];

    for (let rightIndex = leftIndex + 1; rightIndex < anchorRecords.length; rightIndex += 1) {
      const right = anchorRecords[rightIndex];
      const score = cosineSimilarity(left.point.vector, right.point.vector);
      if (!Number.isFinite(score)) continue;
      allScores.push(score);

      const leftNeighbors = neighborMap.get(left.account.id) || [];
      leftNeighbors.push({
        accountId: right.account.id,
        companyName: right.account.company_name,
        rawScore: score,
        summarySnippet: right.point.payload.summarySnippet,
      });
      neighborMap.set(left.account.id, leftNeighbors);

      const rightNeighbors = neighborMap.get(right.account.id) || [];
      rightNeighbors.push({
        accountId: left.account.id,
        companyName: left.account.company_name,
        rawScore: score,
        summarySnippet: left.point.payload.summarySnippet,
      });
      neighborMap.set(right.account.id, rightNeighbors);
    }
  }

  const normalization = buildSimilarityNormalization(allScores);

  for (const [accountId, neighbors] of neighborMap.entries()) {
    neighbors.sort((left, right) => right.rawScore - left.rawScore);
    const topNeighbors = neighbors.filter((neighbor) => neighbor.rawScore >= threshold).slice(0, 3);

    for (const neighbor of topNeighbors) {
      const sourceId = toNodeId(accountId);
      const targetId = toNodeId(neighbor.accountId);
      const key = [sourceId, targetId].sort().join('::');
      const existing = edgeScores.get(key);

      if (!existing || neighbor.rawScore > existing.rawScore) {
        edgeScores.set(key, {
          source: sourceId,
          target: targetId,
          rawScore: neighbor.rawScore,
        });
      }
    }
  }

  const edges: AccountMapEdge[] = Array.from(edgeScores.values())
    .map((edge) => ({
      id: edge.source < edge.target ? `${edge.source}-${edge.target}` : `${edge.target}-${edge.source}`,
      source: edge.source,
      target: edge.target,
      rawScore: Number(edge.rawScore.toFixed(4)),
      spreadScore: normalizeSimilarityScore(edge.rawScore, normalization),
    }))
    .sort((left, right) => right.rawScore - left.rawScore);

  const clusterMap = computeClusters(anchorRecords.map((record) => toNodeId(record.account.id)), edges);

  const nodes: AccountMapNode[] = anchorRecords.map((record) => buildNode(
    record,
    clusterMap.get(toNodeId(record.account.id)) || 0,
    buildRawNeighborsForRecord(record, candidateRecords),
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
      buildRawNeighborsForRecord(selectedRecordSource, candidateRecords),
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
    normalization,
    filters: getFilterMetadata(),
  };
}

function buildComparisonAccount(account: Account, overallSnippet: string | null) {
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
  };
}

export async function compareAccounts(leftAccountId: number, rightAccountId: number): Promise<{
  left: ReturnType<typeof buildComparisonAccount>;
  right: ReturnType<typeof buildComparisonAccount>;
  scores: Record<VectorPerspective, number | null>;
}> {
  const leftAccount = getAccount(leftAccountId);
  const rightAccount = getAccount(rightAccountId);

  if (!leftAccount || !rightAccount) {
    throw new Error('One or both accounts were not found.');
  }

  const pointIds = (['auth0', 'okta', 'overall'] as VectorPerspective[]).flatMap((perspective) => [
    getAccountVectorPointId(leftAccount.id, perspective),
    getAccountVectorPointId(rightAccount.id, perspective),
  ]);

  const points = await retrieveVectorPoints(pointIds);
  const pointMap = new Map(points.map((point) => [point.id, point]));

  const scores = {
    auth0: null,
    okta: null,
    overall: null,
  } as Record<VectorPerspective, number | null>;

  for (const perspective of ['auth0', 'okta', 'overall'] as VectorPerspective[]) {
    const leftPoint = pointMap.get(getAccountVectorPointId(leftAccount.id, perspective));
    const rightPoint = pointMap.get(getAccountVectorPointId(rightAccount.id, perspective));

    if (leftPoint && rightPoint) {
      scores[perspective] = Number(cosineSimilarity(leftPoint.vector, rightPoint.vector).toFixed(4));
    }
  }

  return {
    left: buildComparisonAccount(
      leftAccount,
      pointMap.get(getAccountVectorPointId(leftAccount.id, 'overall'))?.payload.summarySnippet || null
    ),
    right: buildComparisonAccount(
      rightAccount,
      pointMap.get(getAccountVectorPointId(rightAccount.id, 'overall'))?.payload.summarySnippet || null
    ),
    scores,
  };
}
