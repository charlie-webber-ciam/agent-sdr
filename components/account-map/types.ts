export type Perspective = 'auth0' | 'okta' | 'overall';
export type ViewMode = 'focus' | 'cluster';

export interface MapNeighbor {
  accountId: number;
  companyName: string;
  rawScore: number;
  spreadScore: number;
  summarySnippet: string;
}

export interface MapNodeRecord {
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

export interface MapEdgeRecord {
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

export interface MapResponse {
  nodes: MapNodeRecord[];
  edges: MapEdgeRecord[];
  selectedRecord: MapNodeRecord | null;
  neighborRecords: MapNodeRecord[];
  total: number;
  threshold: number;
  normalization: SimilarityNormalization;
  filters: {
    accountOwners: string[];
    oktaAccountOwners: string[];
    availableHqStates: string[];
  };
}

export interface SimilarAccountView {
  rank: number;
  record: MapNodeRecord;
  rawScore: number;
  relativeScore: number;
}
