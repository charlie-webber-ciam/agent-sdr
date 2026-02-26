'use client';

import { useCallback, useMemo, useRef } from 'react';
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
import DealEdge from './map/DealEdge';
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

interface Opportunity {
  id: number;
  name: string;
  stage: string | null;
  linkedProspectIds: number[];
}

interface ProspectMapCanvasProps {
  prospects: Prospect[];
  ghostProspects: GhostProspect[];
  positions: MapPosition[];
  edges: MapEdge[];
  opportunities: Opportunity[];
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
}

const DEAL_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

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
  dealEdge: DealEdge,
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
  opportunities,
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
}: ProspectMapCanvasProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build position lookup
  const positionLookup = useMemo(() => {
    const lookup: Record<string, { x: number; y: number }> = {};
    for (const pos of positions) {
      const key = pos.prospect_id ? `p_${pos.prospect_id}` : pos.ghost_key ? `g_${pos.ghost_key}` : null;
      if (key) lookup[key] = { x: pos.x, y: pos.y };
    }
    return lookup;
  }, [positions]);

  // Build opportunity color lookup
  const prospectOppColor = useMemo(() => {
    const lookup: Record<number, string> = {};
    for (const opp of opportunities) {
      const color = DEAL_COLORS[opp.id % DEAL_COLORS.length];
      for (const pid of opp.linkedProspectIds) {
        if (!lookup[pid]) lookup[pid] = color;
      }
    }
    return lookup;
  }, [opportunities]);

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
          opportunityColor: prospectOppColor[p.id] || null,
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
  }, [prospects, ghostProspects, positionLookup, defaultPositions, prospectOppColor, onSelectProspect, onWriteEmail, onPromoteGhost]);

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

    // Deal edges from opportunities
    for (const opp of opportunities) {
      const pids = opp.linkedProspectIds;
      for (let i = 0; i < pids.length; i++) {
        for (let j = i + 1; j < pids.length; j++) {
          edges.push({
            id: `deal_${opp.id}_${pids[i]}_${pids[j]}`,
            source: `p_${pids[i]}`,
            target: `p_${pids[j]}`,
            type: 'dealEdge',
            deletable: false,
            data: {
              opportunityId: opp.id,
              opportunityName: opp.name,
            },
          });
        }
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
  }, [prospects, opportunities, mapEdges, onUpdateEdgeLabel]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Debounced position save on drag end
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Only save on position changes (drag end)
    const hasDrag = changes.some(c => c.type === 'position' && c.dragging === false);
    if (hasDrag) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const positionsToSave = nodesRef.current.map(n => {
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

  // Auto layout with dagre
  const handleAutoLayout = useCallback(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

    nodes.forEach(node => {
      g.setNode(node.id, { width: 220, height: 100 });
    });

    edges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const newNodes = nodes.map(node => {
      const dagreNode = g.node(node.id);
      return {
        ...node,
        position: {
          x: dagreNode.x - 100,
          y: dagreNode.y - 50,
        },
      };
    });

    setNodes(newNodes);

    // Save new positions
    const positionsToSave = newNodes.map(n => {
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
  }, [nodes, edges, setNodes, onSavePositions]);

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
