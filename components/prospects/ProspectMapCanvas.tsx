'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  MarkerType,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

import ProspectMapNode from './ProspectMapNode';
import ProspectGhostNode from './ProspectGhostNode';
import ReportsToEdge from './map/ReportsToEdge';
import CustomEdge from './map/CustomEdge';
import ProspectMapToolbar from './ProspectMapToolbar';
import type { Prospect } from './ProspectTab';

interface GhostProspect {
  ghostKey: string;
  name: string;
  title: string | null;
  linkedin_url: string | null;
  source: string;
}

interface MapPosition {
  prospect_id: number | null;
  ghost_key: string | null;
  x: number;
  y: number;
}

interface MapEdge {
  id: number;
  source_prospect_id: number | null;
  source_ghost_key: string | null;
  target_prospect_id: number | null;
  target_ghost_key: string | null;
  edge_type: string;
  label: string | null;
}

interface ProspectMapCanvasProps {
  prospects: Prospect[];
  ghostProspects: GhostProspect[];
  positions: MapPosition[];
  edges: MapEdge[];
  accountId: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSelectProspect: (p: Prospect) => void;
  onWriteEmail: (p: Prospect) => void;
  onAddProspect: () => void;
  onPromoteGhost: (ghostKey: string, ghostData: GhostProspect) => void;
  onSavePositions: (positions: Array<{ prospectId?: number; ghostKey?: string; x: number; y: number; nodeType: string }>) => void;
  onCreateEdge: (source: string, target: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
  isSaving: boolean;
  isBuildingMap: boolean;
  buildStep: string | null;
  onBuildMap: () => void;
  onImport: () => void;
  autoLayoutOnMount?: boolean;
}

const SENIORITY_ORDER: Record<string, number> = {
  c_suite: 0,
  vp: 1,
  director: 2,
  manager: 3,
  individual_contributor: 4,
};

const nodeTypes = {
  structuredNode: ProspectMapNode,
  ghostNode: ProspectGhostNode,
};

const edgeTypes = {
  reportsToEdge: ReportsToEdge,
  customEdge: CustomEdge,
};

function nodeId(prospect?: { id: number } | null, ghostKey?: string | null): string {
  if (prospect) return `p_${prospect.id}`;
  if (ghostKey) return `g_${ghostKey}`;
  return '';
}

function getDefaultPositions(prospects: Prospect[], ghostProspects: GhostProspect[]) {
  const positions: Record<string, { x: number; y: number }> = {};

  // Group by seniority level
  const groups: Record<number, Prospect[]> = {};
  for (const p of prospects) {
    const row = SENIORITY_ORDER[p.seniority_level || ''] ?? 4;
    if (!groups[row]) groups[row] = [];
    groups[row].push(p);
  }

  // Position structured prospects in grid
  const rowKeys = Object.keys(groups).map(Number).sort();
  for (const row of rowKeys) {
    const group = groups[row];
    group.forEach((p, col) => {
      positions[`p_${p.id}`] = { x: col * 240, y: row * 140 };
    });
  }

  // Ghost prospects to the right
  const maxCol = Math.max(...Object.values(groups).map(g => g.length), 0);
  const ghostStartX = (maxCol + 1) * 240;
  ghostProspects.forEach((g, i) => {
    positions[`g_${g.ghostKey}`] = { x: ghostStartX + (i % 3) * 240, y: Math.floor(i / 3) * 140 };
  });

  return positions;
}

export default function ProspectMapCanvas({
  prospects,
  ghostProspects,
  positions,
  edges: mapEdges,
  accountId,
  isFullscreen,
  onToggleFullscreen,
  onSelectProspect,
  onWriteEmail,
  onAddProspect,
  onPromoteGhost,
  onSavePositions,
  onCreateEdge,
  onDeleteEdge,
  onUpdateEdgeLabel,
  isSaving,
  isBuildingMap,
  buildStep,
  onBuildMap,
  onImport,
  autoLayoutOnMount,
}: ProspectMapCanvasProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoLayoutRef = useRef<(() => void) | null>(null);

  // Build position lookup
  const positionLookup = useMemo(() => {
    const lookup: Record<string, { x: number; y: number }> = {};
    for (const pos of positions) {
      const key = pos.prospect_id ? `p_${pos.prospect_id}` : pos.ghost_key ? `g_${pos.ghost_key}` : null;
      if (key) lookup[key] = { x: pos.x, y: pos.y };
    }
    return lookup;
  }, [positions]);

  const hasPositions = positions.length > 0;
  const defaultPositions = useMemo(
    () => hasPositions ? {} : getDefaultPositions(prospects, ghostProspects),
    [hasPositions, prospects, ghostProspects]
  );

  // Build initial nodes
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];

    for (const p of prospects) {
      const id = `p_${p.id}`;
      const pos = positionLookup[id] || defaultPositions[id] || { x: 0, y: 0 };
      nodes.push({
        id,
        type: 'structuredNode',
        position: pos,
        data: {
          name: `${p.first_name} ${p.last_name}`,
          title: p.title,
          roleType: p.role_type,
          relationshipStatus: p.relationship_status,
          contactReadiness: p.contact_readiness,
          onSelect: () => onSelectProspect(p),
          onWriteEmail: () => onWriteEmail(p),
        },
      });
    }

    for (const g of ghostProspects) {
      const id = `g_${g.ghostKey}`;
      const pos = positionLookup[id] || defaultPositions[id] || { x: 0, y: 0 };
      nodes.push({
        id,
        type: 'ghostNode',
        position: pos,
        data: {
          name: g.name,
          title: g.title,
          source: g.source,
          onPromote: () => onPromoteGhost(g.ghostKey, g),
        },
      });
    }

    return nodes;
  }, [prospects, ghostProspects, positionLookup, defaultPositions, onSelectProspect, onWriteEmail, onPromoteGhost]);

  // Build initial edges
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];

    // Reports-to edges from parent_prospect_id
    for (const p of prospects) {
      if (p.parent_prospect_id) {
        edges.push({
          id: `rt_${p.parent_prospect_id}_${p.id}`,
          source: `p_${p.parent_prospect_id}`,
          target: `p_${p.id}`,
          type: 'reportsToEdge',
          deletable: false,
        });
      }
    }

    // Custom edges from DB
    for (const e of mapEdges) {
      const sourceId = e.source_prospect_id ? `p_${e.source_prospect_id}` : e.source_ghost_key ? `g_${e.source_ghost_key}` : null;
      const targetId = e.target_prospect_id ? `p_${e.target_prospect_id}` : e.target_ghost_key ? `g_${e.target_ghost_key}` : null;
      if (sourceId && targetId) {
        edges.push({
          id: `custom_${e.id}`,
          source: sourceId,
          target: targetId,
          type: 'customEdge',
          data: {
            label: e.label || '',
            onLabelChange: onUpdateEdgeLabel,
          },
        });
      }
    }

    return edges;
  }, [prospects, mapEdges, onUpdateEdgeLabel]);

  // Build hierarchy data for collapse/expand
  const treeData = useMemo(() => {
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();

    for (const edge of initialEdges) {
      if (edge.type !== 'reportsToEdge') continue;
      if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
      childrenMap.get(edge.source)!.push(edge.target);
      parentMap.set(edge.target, edge.source);
    }

    const allNodeIds = new Set(initialNodes.map(n => n.id));
    const rootNodeIds = [...allNodeIds].filter(id => !parentMap.has(id));

    // BFS for depths
    const depthMap = new Map<string, number>();
    const queue = rootNodeIds.map(id => ({ id, depth: 0 }));
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depthMap.has(id)) continue;
      depthMap.set(id, depth);
      for (const childId of (childrenMap.get(id) ?? []))
        queue.push({ id: childId, depth: depth + 1 });
    }
    for (const n of initialNodes)
      if (!depthMap.has(n.id)) depthMap.set(n.id, 0);

    // Descendant counts (with cycle guard)
    function countDesc(id: string, visited = new Set<string>()): number {
      if (visited.has(id)) return 0;
      visited.add(id);
      const ch = childrenMap.get(id) ?? [];
      return ch.length + ch.reduce((s, c) => s + countDesc(c, visited), 0);
    }
    const descendantCountMap = new Map<string, number>();
    for (const n of initialNodes) descendantCountMap.set(n.id, countDesc(n.id));

    return { childrenMap, parentMap, rootNodeIds, depthMap, descendantCountMap };
  }, [initialNodes, initialEdges]);

  // Collapsed state — auto-collapse nodes matching criteria on mount
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const n of initialNodes) {
      const depth = treeData.depthMap.get(n.id) ?? 0;
      const childCount = (treeData.childrenMap.get(n.id) ?? []).length;
      const hasDesc = (treeData.descendantCountMap.get(n.id) ?? 0) > 0;
      if ((depth > 3 && hasDesc) || childCount > 6) s.add(n.id);
    }
    return s;
  });

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  }, []);

  // Compute which nodes are visible based on collapsed state
  const visibleNodeIds = useMemo(() => {
    const visible = new Set<string>();
    function visit(id: string, hidden: boolean) {
      if (hidden) return;
      visible.add(id);
      for (const c of (treeData.childrenMap.get(id) ?? []))
        visit(c, collapsedNodes.has(id));
    }
    for (const r of treeData.rootNodeIds) visit(r, false);
    // Orphans always visible
    for (const n of initialNodes)
      if (!treeData.parentMap.has(n.id) && !treeData.rootNodeIds.includes(n.id))
        visible.add(n.id);
    return visible;
  }, [collapsedNodes, treeData, initialNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Debounced position save on drag end
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Only save on position changes (drag end)
    const hasDrag = changes.some(c => c.type === 'position' && c.dragging === false);
    if (hasDrag) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const positionsToSave = nodesRef.current.filter(n => !n.hidden).map(n => {
          const isGhost = n.id.startsWith('g_');
          return {
            prospectId: isGhost ? undefined : parseInt(n.id.replace('p_', '')),
            ghostKey: isGhost ? n.id.replace('g_', '') : undefined,
            x: n.position.x,
            y: n.position.y,
            nodeType: isGhost ? 'ghost' : 'structured',
          };
        });
        onSavePositions(positionsToSave);
      }, 800);
    }
  }, [onNodesChange, onSavePositions]);

  const handleConnect = useCallback((connection: Connection) => {
    // Create custom edge
    setEdges((eds) => addEdge({
      ...connection,
      type: 'customEdge',
      data: { label: '', onLabelChange: onUpdateEdgeLabel },
    }, eds));
    if (connection.source && connection.target) {
      onCreateEdge(connection.source, connection.target);
    }
  }, [setEdges, onCreateEdge, onUpdateEdgeLabel]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    for (const change of changes) {
      if (change.type === 'remove' && change.id.startsWith('custom_')) {
        onDeleteEdge(change.id);
      }
    }
  }, [onEdgesChange, onDeleteEdge]);

  // Auto layout with dagre (visible nodes only)
  const handleAutoLayout = useCallback(() => {
    const visNodes = nodesRef.current.filter(n => !n.hidden);
    const visEdges = edgesRef.current.filter(e => !e.hidden);

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

    visNodes.forEach(node => {
      g.setNode(node.id, { width: 220, height: 100 });
    });

    visEdges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    setNodes(prev => prev.map(node => {
      if (node.hidden) return node;
      const dagreNode = g.node(node.id);
      return dagreNode ? {
        ...node,
        position: {
          x: dagreNode.x - 110,
          y: dagreNode.y - 50,
        },
      } : node;
    }));

    // Save visible positions
    const positionsToSave = nodesRef.current.filter(n => !n.hidden).map(n => {
      const isGhost = n.id.startsWith('g_');
      return {
        prospectId: isGhost ? undefined : parseInt(n.id.replace('p_', '')),
        ghostKey: isGhost ? n.id.replace('g_', '') : undefined,
        x: n.position.x,
        y: n.position.y,
        nodeType: isGhost ? 'ghost' : 'structured',
      };
    });
    onSavePositions(positionsToSave);
  }, [setNodes, onSavePositions]);

  // Keep ref in sync so the mount effect gets the latest function
  autoLayoutRef.current = handleAutoLayout;

  // Auto-layout on mount after hierarchy build completes
  useEffect(() => {
    if (autoLayoutOnMount) {
      // Delay to let React Flow fully render nodes before running dagre
      const timer = setTimeout(() => {
        autoLayoutRef.current?.();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  // Sync hidden state and collapse metadata into ReactFlow nodes & edges
  useEffect(() => {
    setNodes(prev => prev.map(n => ({
      ...n,
      hidden: !visibleNodeIds.has(n.id),
      data: {
        ...n.data,
        isCollapsed: collapsedNodes.has(n.id),
        collapsedCount: collapsedNodes.has(n.id)
          ? (treeData.descendantCountMap.get(n.id) ?? 0) : 0,
        hasChildren: (treeData.childrenMap.get(n.id) ?? []).length > 0,
        onToggleCollapse: (treeData.childrenMap.get(n.id) ?? []).length > 0
          ? () => handleToggleCollapse(n.id) : undefined,
      },
    })));
    setEdges(prev => prev.map(e => ({
      ...e,
      hidden: !visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target),
    })));
  }, [visibleNodeIds, collapsedNodes, treeData, setNodes, setEdges, handleToggleCollapse]);

  // Re-layout after collapse/expand (skip initial render)
  const isFirstCollapseRender = useRef(true);
  useEffect(() => {
    if (isFirstCollapseRender.current) {
      isFirstCollapseRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const visNodes = nodesRef.current.filter(n => !n.hidden);
      const visEdges = edgesRef.current.filter(e => !e.hidden);
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });
      visNodes.forEach(n => g.setNode(n.id, { width: 220, height: 100 }));
      visEdges.forEach(e => g.setEdge(e.source, e.target));
      dagre.layout(g);
      setNodes(prev => prev.map(n => {
        if (n.hidden) return n;
        const dn = g.node(n.id);
        return dn ? { ...n, position: { x: dn.x - 110, y: dn.y - 50 } } : n;
      }));
      // Save visible positions
      const positionsToSave = nodesRef.current.filter(n => !n.hidden).map(n => ({
        prospectId: n.id.startsWith('g_') ? undefined : parseInt(n.id.replace('p_', '')),
        ghostKey: n.id.startsWith('g_') ? n.id.replace('g_', '') : undefined,
        x: n.position.x,
        y: n.position.y,
        nodeType: n.id.startsWith('g_') ? 'ghost' : 'structured',
      }));
      onSavePositions(positionsToSave);
    }, 50);
    return () => clearTimeout(timer);
  }, [collapsedNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full">
      <ProspectMapToolbar
        onAutoLayout={handleAutoLayout}
        onAddProspect={onAddProspect}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        isSaving={isSaving}
        isBuildingMap={isBuildingMap}
        buildStep={buildStep}
        onBuildMap={onBuildMap}
        onImport={onImport}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          nodeStrokeWidth={2}
          nodeColor={(node) => node.type === 'ghostNode' ? '#e5e7eb' : '#dbeafe'}
          className="!bg-gray-50 !border-gray-200"
        />
        <Controls className="!bg-white !border-gray-200 !shadow-sm" />

        {/* Custom arrow markers */}
        <svg>
          <defs>
            <marker
              id="reports-to-arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
            </marker>
            <marker
              id="custom-arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth={5}
              markerHeight={5}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
    </div>
  );
}
