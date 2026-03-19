'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import SimilarityGraphEdge from '@/components/account-map/SimilarityGraphEdge';
import SimilarityGraphNode from '@/components/account-map/SimilarityGraphNode';
import type {
  MapEdgeRecord,
  MapNodeRecord,
  Perspective,
  SimilarAccountView,
  ViewMode,
} from '@/components/account-map/types';
import { formatPercent, similarityStrengthLabel } from '@/components/account-map/utils';

interface AccountSimilarityGraphProps {
  mode: ViewMode;
  perspective: Perspective;
  nodes: MapNodeRecord[];
  edges: MapEdgeRecord[];
  selectedRecord: MapNodeRecord | null;
  similarAccounts: SimilarAccountView[];
  neighborCount: number;
  minimumRelativeScore: number;
  showLabels: boolean;
  onSelectAccount: (accountId: number) => void;
  onInspectAccount: (accountId: number | null) => void;
}

interface SimilarityNodeData extends Record<string, unknown> {
  companyName: string;
  industry: string;
  domain: string | null;
  scoreLabel: string | null;
  strengthLabel: string | null;
  isCenter: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  compact: boolean;
  showLabels: boolean;
}

interface SimilarityEdgeData extends Record<string, unknown> {
  label: string;
  strength: number;
  highlighted: boolean;
  dimmed: boolean;
  showLabel: boolean;
}

const nodeTypes = {
  similarityNode: SimilarityGraphNode,
};

const edgeTypes = {
  similarityEdge: SimilarityGraphEdge,
};

function getHandlePositions(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0
      ? { sourcePosition: Position.Right, targetPosition: Position.Left }
      : { sourcePosition: Position.Left, targetPosition: Position.Right };
  }

  return dy >= 0
    ? { sourcePosition: Position.Bottom, targetPosition: Position.Top }
    : { sourcePosition: Position.Top, targetPosition: Position.Bottom };
}

function buildFocusGraph(options: {
  selectedRecord: MapNodeRecord;
  similarAccounts: SimilarAccountView[];
  neighborCount: number;
  minimumRelativeScore: number;
  showLabels: boolean;
}): { nodes: Node<SimilarityNodeData>[]; edges: Edge<SimilarityEdgeData>[]; notice: string | null } {
  const visibleNeighbors = options.similarAccounts
    .filter((account) => account.relativeScore >= options.minimumRelativeScore)
    .slice(0, options.neighborCount);

  const flowNodes: Node<SimilarityNodeData>[] = [
    {
      id: options.selectedRecord.id,
      type: 'similarityNode',
      position: { x: 0, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        companyName: options.selectedRecord.companyName,
        industry: options.selectedRecord.industry,
        domain: options.selectedRecord.domain,
        scoreLabel: 'Center account',
        strengthLabel: 'Anchor',
        isCenter: true,
        isHighlighted: true,
        isDimmed: false,
        compact: false,
        showLabels: true,
      },
    },
  ];

  const flowEdges: Edge<SimilarityEdgeData>[] = [];
  if (visibleNeighbors.length === 0) {
    return {
      nodes: flowNodes,
      edges: flowEdges,
      notice: 'No similar accounts are visible under the current similarity threshold.',
    };
  }

  visibleNeighbors.forEach((account, index) => {
    const angle = (-Math.PI / 2) + (index / visibleNeighbors.length) * Math.PI * 2;
    const radius = 290 + (1 - account.relativeScore) * 130 + (index % 2) * 18;
    const position = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * Math.max(radius * 0.72, 200),
    };

    const handlePositions = getHandlePositions({ x: 0, y: 0 }, position);
    flowNodes.push({
      id: account.record.id,
      type: 'similarityNode',
      position,
      sourcePosition: handlePositions.targetPosition,
      targetPosition: handlePositions.targetPosition,
      data: {
        companyName: account.record.companyName,
        industry: account.record.industry,
        domain: account.record.domain,
        scoreLabel: `Raw ${formatPercent(account.rawScore)}`,
        strengthLabel: similarityStrengthLabel(account.relativeScore),
        isCenter: false,
        isHighlighted: true,
        isDimmed: false,
        compact: false,
        showLabels: options.showLabels,
      },
    });

    flowEdges.push({
      id: `focus-${options.selectedRecord.accountId}-${account.record.accountId}`,
      source: options.selectedRecord.id,
      target: account.record.id,
      type: 'similarityEdge',
      data: {
        label: `Raw ${formatPercent(account.rawScore)}`,
        strength: account.relativeScore,
        highlighted: true,
        dimmed: false,
        showLabel: options.showLabels && visibleNeighbors.length <= 6,
      },
    });
  });

  return { nodes: flowNodes, edges: flowEdges, notice: null };
}

function buildClusterGraph(options: {
  nodes: MapNodeRecord[];
  edges: MapEdgeRecord[];
  selectedRecord: MapNodeRecord | null;
  minimumRelativeScore: number;
  showLabels: boolean;
}): { nodes: Node<SimilarityNodeData>[]; edges: Edge<SimilarityEdgeData>[]; notice: string | null } {
  const filteredEdges = options.edges.filter((edge) => edge.spreadScore >= options.minimumRelativeScore);
  const degreeMap = new Map<string, number>();
  for (const edge of filteredEdges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
  }

  const highlightedIds = new Set<string>();
  if (options.selectedRecord) {
    highlightedIds.add(options.selectedRecord.id);
    for (const neighbor of options.selectedRecord.nearestNeighbors) {
      highlightedIds.add(`account-${neighbor.accountId}`);
    }
  }

  const clusters = new Map<number, MapNodeRecord[]>();
  for (const record of options.nodes) {
    const key = record.clusterId || record.accountId + 10_000;
    const existing = clusters.get(key) || [];
    existing.push(record);
    clusters.set(key, existing);
  }

  const selectedClusterId = options.selectedRecord?.clusterId || null;
  const sortedClusters = Array.from(clusters.entries()).sort((left, right) => {
    if (selectedClusterId && left[0] === selectedClusterId) return -1;
    if (selectedClusterId && right[0] === selectedClusterId) return 1;
    return right[1].length - left[1].length;
  });

  const columnCount = Math.max(1, Math.ceil(Math.sqrt(sortedClusters.length || 1)));
  const flowNodes: Node<SimilarityNodeData>[] = [];

  sortedClusters.forEach(([clusterId, clusterNodes], clusterIndex) => {
    const clusterX = (clusterIndex % columnCount) * 560;
    const clusterY = Math.floor(clusterIndex / columnCount) * 420;
    const sortedNodes = [...clusterNodes].sort((left, right) => {
      if (options.selectedRecord?.accountId === left.accountId) return -1;
      if (options.selectedRecord?.accountId === right.accountId) return 1;
      const leftHighlighted = highlightedIds.has(left.id) ? 1 : 0;
      const rightHighlighted = highlightedIds.has(right.id) ? 1 : 0;
      if (leftHighlighted !== rightHighlighted) return rightHighlighted - leftHighlighted;
      return (degreeMap.get(right.id) || 0) - (degreeMap.get(left.id) || 0)
        || left.companyName.localeCompare(right.companyName);
    });

    sortedNodes.forEach((record, nodeIndex) => {
      const ringIndex = Math.floor(nodeIndex / 8);
      const itemsInRing = Math.min(8, sortedNodes.length - ringIndex * 8);
      const ringPosition = nodeIndex % 8;
      const radius = nodeIndex === 0 && sortedNodes.length === 1 ? 0 : 110 + ringIndex * 92;
      const angle = itemsInRing === 1 ? -Math.PI / 2 : (-Math.PI / 2) + (ringPosition / itemsInRing) * Math.PI * 2;
      const position = {
        x: clusterX + Math.cos(angle) * radius,
        y: clusterY + Math.sin(angle) * radius,
      };

      const isHighlighted = highlightedIds.has(record.id);
      const dimmed = !!options.selectedRecord && !isHighlighted;

      flowNodes.push({
        id: record.id,
        type: 'similarityNode',
        position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          companyName: record.companyName,
          industry: record.industry,
          domain: record.domain,
          scoreLabel: clusterId > 0 ? `Cluster ${clusterId}` : null,
          strengthLabel: options.selectedRecord?.accountId === record.accountId ? 'Anchor' : null,
          isCenter: options.selectedRecord?.accountId === record.accountId,
          isHighlighted,
          isDimmed: dimmed,
          compact: true,
          showLabels: options.showLabels,
        },
      });
    });
  });

  const positionById = new Map(flowNodes.map((node) => [node.id, node.position]));
  const flowEdges: Edge<SimilarityEdgeData>[] = filteredEdges
    .filter((edge) => positionById.has(edge.source) && positionById.has(edge.target))
    .map((edge) => {
      const highlighted = highlightedIds.has(edge.source) || highlightedIds.has(edge.target);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'similarityEdge',
        data: {
          label: `Raw ${formatPercent(edge.rawScore)}`,
          strength: edge.spreadScore,
          highlighted,
          dimmed: !!options.selectedRecord && !highlighted,
          showLabel: options.showLabels && highlighted && edge.spreadScore >= 0.72,
        },
      };
    });

  return {
    nodes: flowNodes,
    edges: flowEdges,
    notice: flowEdges.length === 0 ? 'No cluster edges are visible under the current similarity threshold.' : null,
  };
}

export default function AccountSimilarityGraph({
  mode,
  perspective,
  nodes,
  edges,
  selectedRecord,
  similarAccounts,
  neighborCount,
  minimumRelativeScore,
  showLabels,
  onSelectAccount,
  onInspectAccount,
}: AccountSimilarityGraphProps) {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);

  const flowGraph = useMemo(() => {
    if (!selectedRecord && mode === 'focus') {
      return { nodes: [] as Node<SimilarityNodeData>[], edges: [] as Edge<SimilarityEdgeData>[], notice: 'Pick an account to explore similar companies.' };
    }

    if (mode === 'focus' && selectedRecord) {
      return buildFocusGraph({
        selectedRecord,
        similarAccounts,
        neighborCount,
        minimumRelativeScore,
        showLabels,
      });
    }

    return buildClusterGraph({
      nodes,
      edges,
      selectedRecord,
      minimumRelativeScore,
      showLabels,
    });
  }, [edges, minimumRelativeScore, mode, neighborCount, nodes, selectedRecord, showLabels, similarAccounts]);

  useEffect(() => {
    if (!reactFlowInstance || flowGraph.nodes.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      reactFlowInstance.fitView({
        duration: 250,
        padding: mode === 'focus' ? 0.28 : 0.18,
        maxZoom: mode === 'focus' ? 1.2 : 1.05,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [flowGraph.edges.length, flowGraph.nodes.length, mode, reactFlowInstance]);

  const accent = perspective === 'okta' ? '#0f766e' : perspective === 'overall' ? '#b45309' : '#0369a1';

  return (
    <div className="relative h-[640px] overflow-hidden rounded-[28px] border border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_32%),linear-gradient(180deg,_#fffaf4_0%,_#ffffff_48%,_#f8fafc_100%)]">
      <ReactFlow
        nodes={flowGraph.nodes}
        edges={flowGraph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setReactFlowInstance}
        onNodeMouseEnter={(_, node) => onInspectAccount(Number(node.id.replace('account-', '')))}
        onNodeMouseLeave={() => onInspectAccount(null)}
        onNodeClick={(_, node) => onSelectAccount(Number(node.id.replace('account-', '')))}
        minZoom={0.2}
        maxZoom={1.8}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} color="#e7e5e4" size={1.2} />
        <MiniMap
          className="!m-4 !rounded-xl !border !border-stone-200 !bg-white/90"
          nodeColor={(node) => node.id === selectedRecord?.id ? accent : '#cbd5e1'}
          nodeStrokeColor={() => '#475569'}
          maskColor="rgba(255, 255, 255, 0.65)"
        />
        <Controls className="!m-4 !rounded-xl !border-stone-200 !bg-white/90 !shadow-sm" />
      </ReactFlow>

      {flowGraph.notice && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="rounded-full border border-stone-200 bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-sm">
            {flowGraph.notice}
          </div>
        </div>
      )}
    </div>
  );
}
