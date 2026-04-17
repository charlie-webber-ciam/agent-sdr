import type { MapEdgeRecord, MapNodeRecord, Perspective } from './types';

export function formatPercent(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return 'Unavailable';
  return `${Math.round(score * 100)}%`;
}

export function similarityStrengthLabel(relativeScore: number): string {
  if (relativeScore >= 0.82) return 'Closest';
  if (relativeScore >= 0.58) return 'Strong match';
  if (relativeScore >= 0.34) return 'Moderate match';
  return 'Related';
}

export function getPerspectiveTier(record: MapNodeRecord, perspective: Perspective): string | null {
  return perspective === 'okta' ? record.oktaTier : record.tier;
}

export function getPerspectiveOwner(record: MapNodeRecord, perspective: Perspective): string | null {
  return perspective === 'okta' ? record.oktaAccountOwner : record.auth0AccountOwner;
}

export function buildSimilarityReasons(
  selectedRecord: MapNodeRecord | null,
  record: MapNodeRecord,
  perspective: Perspective
): string[] {
  if (!selectedRecord || selectedRecord.accountId === record.accountId) {
    return [
      'Use this account as the anchor to compare nearby companies and clusters.',
      record.summarySnippet
        ? 'A research summary is available for quick context.'
        : 'Research details will appear here when available.',
      getPerspectiveOwner(record, perspective)
        ? `Owned by ${getPerspectiveOwner(record, perspective)} in the current perspective.`
        : 'Owner is not assigned in the current perspective.',
    ];
  }

  const reasons: string[] = [];
  if (selectedRecord.industry && record.industry && selectedRecord.industry === record.industry) {
    reasons.push(`Same industry: ${record.industry}.`);
  }

  const selectedOwner = getPerspectiveOwner(selectedRecord, perspective);
  const candidateOwner = getPerspectiveOwner(record, perspective);
  if (selectedOwner && candidateOwner && selectedOwner === candidateOwner) {
    reasons.push(`Shared owner: ${candidateOwner}.`);
  }

  const selectedTier = getPerspectiveTier(selectedRecord, perspective);
  const candidateTier = getPerspectiveTier(record, perspective);
  if (selectedTier && candidateTier && selectedTier === candidateTier) {
    reasons.push(`Both sit in ${perspective === 'okta' ? 'Okta ' : ''}Tier ${candidateTier}.`);
  }

  if (
    selectedRecord.domain &&
    record.domain &&
    selectedRecord.domain.split('.').slice(-1)[0] === record.domain.split('.').slice(-1)[0]
  ) {
    reasons.push('Both have domains with the same top-level suffix.');
  }

  if (record.summarySnippet) {
    reasons.push('The research summary is available for a quick overlap check.');
  }

  return reasons.slice(0, 3);
}

export function findScoreBetweenAccounts(
  selectedRecord: MapNodeRecord | null,
  inspectedRecord: MapNodeRecord | null,
  edges: MapEdgeRecord[]
): { semanticScore: number; hybridScore: number; relativeScore: number } | null {
  if (!selectedRecord || !inspectedRecord || selectedRecord.accountId === inspectedRecord.accountId) {
    return null;
  }

  const directNeighbor = selectedRecord.nearestNeighbors.find(
    (neighbor) => neighbor.accountId === inspectedRecord.accountId
  );
  if (directNeighbor) {
    return {
      semanticScore: directNeighbor.semanticScore,
      hybridScore: directNeighbor.hybridScore,
      relativeScore: directNeighbor.spreadScore,
    };
  }

  const sourceId = `account-${selectedRecord.accountId}`;
  const targetId = `account-${inspectedRecord.accountId}`;
  const graphEdge = edges.find((edge) => (
    (edge.source === sourceId && edge.target === targetId)
    || (edge.source === targetId && edge.target === sourceId)
  ));

  if (!graphEdge) return null;

  return {
    semanticScore: graphEdge.semanticScore,
    hybridScore: graphEdge.hybridScore,
    relativeScore: graphEdge.spreadScore,
  };
}
