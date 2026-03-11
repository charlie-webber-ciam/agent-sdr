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
  type Viewport,
  type ReactFlowInstance,
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
  onBuildMap: (userContext?: string) => void;
  onImport: () => void;
  autoLayoutOnMount?: boolean;
}

interface TreeData {
  childrenMap: Map<string, string[]>;
  parentMap: Map<string, string>;
  rootNodeIds: string[];
  depthMap: Map<string, number>;
  descendantCountMap: Map<string, number>;
}

interface MapUiPrefs {
  showGhostNodes: boolean;
  showReportsToEdges: boolean;
  showCustomEdges: boolean;
}

interface PositionPayload {
  prospectId?: number;
  ghostKey?: string;
  x: number;
  y: number;
  nodeType: string;
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

const COLLAPSED_STATE_STORAGE_PREFIX = 'sdr-prospect-map-collapsed';
const MAP_UI_PREFS_STORAGE_PREFIX = 'sdr-prospect-map-ui-prefs';
const VIEWPORT_STORAGE_PREFIX = 'sdr-prospect-map-viewport';

const DEFAULT_MAP_UI_PREFS: MapUiPrefs = {
  showGhostNodes: true,
  showReportsToEdges: true,
  showCustomEdges: true,
};

function getCollapsedStateStorageKey(accountId: number): string {
  return `${COLLAPSED_STATE_STORAGE_PREFIX}:${accountId}`;
}

function getMapUiPrefsStorageKey(accountId: number): string {
  return `${MAP_UI_PREFS_STORAGE_PREFIX}:${accountId}`;
}

function getViewportStorageKey(accountId: number): string {
  return `${VIEWPORT_STORAGE_PREFIX}:${accountId}`;
}

function getAutoCollapsedNodeIds(nodeIds: string[], treeData: TreeData): Set<string> {
  const collapsed = new Set<string>();
  for (const id of nodeIds) {
    const depth = treeData.depthMap.get(id) ?? 0;
    const childCount = (treeData.childrenMap.get(id) ?? []).length;
    const hasDesc = (treeData.descendantCountMap.get(id) ?? 0) > 0;
    if ((depth > 3 && hasDesc) || childCount > 6) collapsed.add(id);
  }
  return collapsed;
}

function readCollapsedStateFromStorage(storageKey: string, validNodeIds: Set<string>): Set<string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const filtered = parsed.filter((id): id is string => typeof id === 'string' && validNodeIds.has(id));
    return new Set(filtered);
  } catch {
    return null;
  }
}

function readMapUiPrefsFromStorage(storageKey: string): MapUiPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MapUiPrefs> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      showGhostNodes: typeof parsed.showGhostNodes === 'boolean' ? parsed.showGhostNodes : true,
      showReportsToEdges: typeof parsed.showReportsToEdges === 'boolean' ? parsed.showReportsToEdges : true,
      showCustomEdges: typeof parsed.showCustomEdges === 'boolean' ? parsed.showCustomEdges : true,
    };
  } catch {
    return null;
  }
}

function readViewportFromStorage(storageKey: string): Viewport | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Viewport> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y) ||
      !Number.isFinite(parsed.zoom)
    ) {
      return null;
    }
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    const zoom = Number(parsed.zoom);
    return { x, y, zoom };
  } catch {
    return null;
  }
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

function toPositionPayload(node: Node): PositionPayload | null {
  if (node.id.startsWith('p_')) {
    const prospectId = Number.parseInt(node.id.slice(2), 10);
    if (Number.isNaN(prospectId)) return null;
    return {
      prospectId,
      x: node.position.x,
      y: node.position.y,
      nodeType: 'structured',
    };
  }

  if (node.id.startsWith('g_')) {
    const ghostKey = node.id.slice(2);
    if (!ghostKey) return null;
    return {
      ghostKey,
      x: node.position.x,
      y: node.position.y,
      nodeType: 'ghost',
    };
  }

  return null;
}

function serializeNodePositions(
  nodes: Node[],
  options?: { includeHidden?: boolean; onlyNodeIds?: Set<string> }
): PositionPayload[] {
  const includeHidden = options?.includeHidden ?? false;
  const onlyNodeIds = options?.onlyNodeIds;
  const payload: PositionPayload[] = [];

  for (const node of nodes) {
    if (!includeHidden && node.hidden) continue;
    if (onlyNodeIds && !onlyNodeIds.has(node.id)) continue;
    const entry = toPositionPayload(node);
    if (entry) payload.push(entry);
  }

  return payload;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
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
  const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoLayoutRef = useRef<(() => void) | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const viewportRestoredRef = useRef(false);

  const collapsedStateStorageKey = useMemo(() => getCollapsedStateStorageKey(accountId), [accountId]);
  const mapUiPrefsStorageKey = useMemo(() => getMapUiPrefsStorageKey(accountId), [accountId]);
  const viewportStorageKey = useMemo(() => getViewportStorageKey(accountId), [accountId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [uiPrefs, setUiPrefs] = useState<MapUiPrefs>(() => {
    return readMapUiPrefsFromStorage(mapUiPrefsStorageKey) ?? DEFAULT_MAP_UI_PREFS;
  });

  const savedViewport = useMemo(() => readViewportFromStorage(viewportStorageKey), [viewportStorageKey]);

  useEffect(() => {
    setUiPrefs(readMapUiPrefsFromStorage(mapUiPrefsStorageKey) ?? DEFAULT_MAP_UI_PREFS);
  }, [mapUiPrefsStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(mapUiPrefsStorageKey, JSON.stringify(uiPrefs));
    } catch {
      // Ignore localStorage errors.
    }
  }, [mapUiPrefsStorageKey, uiPrefs]);

  useEffect(() => {
    viewportRestoredRef.current = false;
  }, [viewportStorageKey]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
    };
  }, []);

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
    () => (hasPositions ? {} : getDefaultPositions(prospects, ghostProspects)),
    [hasPositions, prospects, ghostProspects]
  );

  const allNodeIds = useMemo(() => {
    const ids: string[] = [];
    for (const p of prospects) ids.push(`p_${p.id}`);
    for (const g of ghostProspects) ids.push(`g_${g.ghostKey}`);
    return ids;
  }, [prospects, ghostProspects]);

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
  const treeData = useMemo<TreeData>(() => {
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();

    for (const edge of initialEdges) {
      if (edge.type !== 'reportsToEdge') continue;
      if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
      childrenMap.get(edge.source)!.push(edge.target);
      parentMap.set(edge.target, edge.source);
    }

    const rootNodeIds = allNodeIds.filter(id => !parentMap.has(id));

    // BFS for depths
    const depthMap = new Map<string, number>();
    const queue = rootNodeIds.map(id => ({ id, depth: 0 }));
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      if (depthMap.has(current.id)) continue;
      depthMap.set(current.id, current.depth);
      for (const childId of childrenMap.get(current.id) ?? []) {
        queue.push({ id: childId, depth: current.depth + 1 });
      }
    }
    for (const id of allNodeIds) {
      if (!depthMap.has(id)) depthMap.set(id, 0);
    }

    // Descendant counts (with cycle guard)
    function countDesc(id: string, visited = new Set<string>()): number {
      if (visited.has(id)) return 0;
      visited.add(id);
      const children = childrenMap.get(id) ?? [];
      return children.length + children.reduce((sum, childId) => sum + countDesc(childId, visited), 0);
    }

    const descendantCountMap = new Map<string, number>();
    for (const id of allNodeIds) descendantCountMap.set(id, countDesc(id));

    return { childrenMap, parentMap, rootNodeIds, depthMap, descendantCountMap };
  }, [allNodeIds, initialEdges]);

  const collapsibleNodeIds = useMemo(
    () => allNodeIds.filter(id => (treeData.childrenMap.get(id) ?? []).length > 0),
    [allNodeIds, treeData]
  );

  const autoCollapsedNodes = useMemo(
    () => getAutoCollapsedNodeIds(allNodeIds, treeData),
    [allNodeIds, treeData]
  );

  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    const validNodeIds = new Set(allNodeIds);
    const saved = readCollapsedStateFromStorage(collapsedStateStorageKey, validNodeIds);
    return saved ?? autoCollapsedNodes;
  });

  // Rehydrate persisted collapse state when account or node set changes.
  useEffect(() => {
    const validNodeIds = new Set(allNodeIds);
    const saved = readCollapsedStateFromStorage(collapsedStateStorageKey, validNodeIds);
    setCollapsedNodes(saved ?? autoCollapsedNodes);
  }, [allNodeIds, collapsedStateStorageKey, autoCollapsedNodes]);

  // Persist collapse state per account so expand/collapse choices survive reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(collapsedStateStorageKey, JSON.stringify([...collapsedNodes]));
    } catch {
      // Ignore localStorage errors.
    }
  }, [collapsedNodes, collapsedStateStorageKey]);

  const searchableNodeText = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of prospects) {
      byId.set(`p_${p.id}`, `${p.first_name} ${p.last_name} ${p.title || ''}`.toLowerCase());
    }
    for (const g of ghostProspects) {
      byId.set(`g_${g.ghostKey}`, `${g.name} ${g.title || ''} ${g.source}`.toLowerCase());
    }
    return byId;
  }, [prospects, ghostProspects]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const searchMatchNodeIds = useMemo(() => {
    if (!normalizedSearchQuery) return [];
    const matches: string[] = [];
    for (const [id, text] of searchableNodeText.entries()) {
      if (text.includes(normalizedSearchQuery)) matches.push(id);
    }
    return matches;
  }, [normalizedSearchQuery, searchableNodeText]);

  const searchMatchSet = useMemo(() => new Set(searchMatchNodeIds), [searchMatchNodeIds]);

  useEffect(() => {
    if (searchMatchNodeIds.length === 0) {
      setSearchActiveIndex(0);
      setFocusedNodeId(null);
      return;
    }
    setSearchActiveIndex(prev => Math.min(prev, searchMatchNodeIds.length - 1));
  }, [searchMatchNodeIds]);

  // Compute which nodes are visible based on collapsed state + filters
  const visibleNodeIds = useMemo(() => {
    const visible = new Set<string>();

    function visit(id: string, hiddenByAncestor: boolean) {
      if (hiddenByAncestor) return;
      visible.add(id);
      for (const childId of treeData.childrenMap.get(id) ?? []) {
        visit(childId, collapsedNodes.has(id));
      }
    }

    for (const rootId of treeData.rootNodeIds) visit(rootId, false);

    // Orphans or nodes in disconnected cycles should remain visible.
    for (const id of allNodeIds) {
      if (!treeData.parentMap.has(id) && !visible.has(id)) visible.add(id);
    }

    if (!uiPrefs.showGhostNodes) {
      for (const id of [...visible]) {
        if (id.startsWith('g_')) visible.delete(id);
      }
    }

    return visible;
  }, [collapsedNodes, treeData, allNodeIds, uiPrefs.showGhostNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const revealNodePath = useCallback((targetNodeId: string) => {
    setCollapsedNodes(prev => {
      let parentId = treeData.parentMap.get(targetNodeId);
      if (!parentId) return prev;

      const next = new Set(prev);
      while (parentId) {
        next.delete(parentId);
        parentId = treeData.parentMap.get(parentId);
      }
      return next;
    });
  }, [treeData.parentMap]);

  const handleFocusNode = useCallback((nodeId: string) => {
    if (nodeId.startsWith('g_') && !uiPrefs.showGhostNodes) {
      setUiPrefs(prev => ({ ...prev, showGhostNodes: true }));
    }

    revealNodePath(nodeId);
    setFocusedNodeId(nodeId);

    window.setTimeout(() => {
      const targetNode = nodesRef.current.find(n => n.id === nodeId && !n.hidden);
      if (!targetNode || !reactFlowRef.current) return;
      const width = targetNode.type === 'ghostNode' ? 200 : 220;
      const height = targetNode.type === 'ghostNode' ? 70 : 80;
      reactFlowRef.current.setCenter(
        targetNode.position.x + width / 2,
        targetNode.position.y + height / 2,
        { zoom: 1.2, duration: 280 }
      );
    }, 80);
  }, [revealNodePath, uiPrefs.showGhostNodes]);

  const focusSearchMatchAtIndex = useCallback((index: number) => {
    if (searchMatchNodeIds.length === 0) return;
    const safeIndex = ((index % searchMatchNodeIds.length) + searchMatchNodeIds.length) % searchMatchNodeIds.length;
    setSearchActiveIndex(safeIndex);
    handleFocusNode(searchMatchNodeIds[safeIndex]);
  }, [searchMatchNodeIds, handleFocusNode]);

  const handleFocusNextMatch = useCallback(() => {
    focusSearchMatchAtIndex(searchActiveIndex + 1);
  }, [focusSearchMatchAtIndex, searchActiveIndex]);

  const handleFocusPrevMatch = useCallback(() => {
    focusSearchMatchAtIndex(searchActiveIndex - 1);
  }, [focusSearchMatchAtIndex, searchActiveIndex]);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSearchActiveIndex(0);
    if (!value.trim()) setFocusedNodeId(null);
  }, []);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setCollapsedNodes(new Set<string>());
  }, []);

  const handleCollapseAll = useCallback(() => {
    setCollapsedNodes(new Set(collapsibleNodeIds));
  }, [collapsibleNodeIds]);

  const handleResetSmartCollapse = useCallback(() => {
    setCollapsedNodes(new Set(autoCollapsedNodes));
  }, [autoCollapsedNodes]);

  const handleToggleGhostNodes = useCallback(() => {
    setUiPrefs(prev => ({ ...prev, showGhostNodes: !prev.showGhostNodes }));
  }, []);

  const handleToggleReportsToEdges = useCallback(() => {
    setUiPrefs(prev => ({ ...prev, showReportsToEdges: !prev.showReportsToEdges }));
  }, []);

  const handleToggleCustomEdges = useCallback(() => {
    setUiPrefs(prev => ({ ...prev, showCustomEdges: !prev.showCustomEdges }));
  }, []);

  const handleMoveEnd = useCallback((_: unknown, viewport: Viewport) => {
    if (typeof window === 'undefined') return;
    if (viewportSaveTimerRef.current) clearTimeout(viewportSaveTimerRef.current);
    viewportSaveTimerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(viewportStorageKey, JSON.stringify(viewport));
      } catch {
        // Ignore localStorage errors.
      }
    }, 150);
  }, [viewportStorageKey]);

  const restoreViewportIfNeeded = useCallback(() => {
    if (viewportRestoredRef.current) return;
    if (!reactFlowRef.current) return;
    viewportRestoredRef.current = true;
    if (!savedViewport) return;
    window.setTimeout(() => {
      reactFlowRef.current?.setViewport(savedViewport, { duration: 0 });
    }, 40);
  }, [savedViewport]);

  const handleFlowInit = useCallback((instance: ReactFlowInstance<Node, Edge>) => {
    reactFlowRef.current = instance;
    restoreViewportIfNeeded();
  }, [restoreViewportIfNeeded]);

  useEffect(() => {
    restoreViewportIfNeeded();
  }, [restoreViewportIfNeeded]);

  const handleFitVisible = useCallback(() => {
    reactFlowRef.current?.fitView({
      includeHiddenNodes: false,
      duration: 250,
      padding: 0.2,
      maxZoom: 1.3,
    });
  }, []);

  // Debounced position save on drag end (save only moved nodes)
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    const movedNodeIds = new Set<string>();
    for (const change of changes) {
      if (change.type === 'position' && change.dragging === false && 'id' in change) {
        movedNodeIds.add(change.id);
      }
    }

    if (movedNodeIds.size === 0) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const positionsToSave = serializeNodePositions(nodesRef.current, { onlyNodeIds: movedNodeIds });
      if (positionsToSave.length > 0) onSavePositions(positionsToSave);
    }, 500);
  }, [onNodesChange, onSavePositions]);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    const duplicateExists = edgesRef.current.some(
      edge => edge.type === 'customEdge' && edge.source === connection.source && edge.target === connection.target
    );
    if (duplicateExists) return;

    setEdges((currentEdges) => addEdge({
      ...connection,
      type: 'customEdge',
      data: { label: '', onLabelChange: onUpdateEdgeLabel },
    }, currentEdges));

    onCreateEdge(connection.source, connection.target);
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
    const visibleNodes = nodesRef.current.filter(node => !node.hidden);
    const visibleEdges = edgesRef.current.filter(edge => !edge.hidden);

    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

    for (const node of visibleNodes) {
      const width = node.type === 'ghostNode' ? 200 : 220;
      const height = node.type === 'ghostNode' ? 80 : 100;
      graph.setNode(node.id, { width, height });
    }

    for (const edge of visibleEdges) {
      graph.setEdge(edge.source, edge.target);
    }

    dagre.layout(graph);

    let laidOutNodes: Node[] = [];
    setNodes(prev => {
      laidOutNodes = prev.map(node => {
        if (node.hidden) return node;
        const dagreNode = graph.node(node.id);
        if (!dagreNode) return node;
        const width = node.type === 'ghostNode' ? 200 : 220;
        const height = node.type === 'ghostNode' ? 80 : 100;
        return {
          ...node,
          position: {
            x: dagreNode.x - width / 2,
            y: dagreNode.y - height / 2,
          },
        };
      });
      return laidOutNodes;
    });

    const positionsToSave = serializeNodePositions(laidOutNodes);
    if (positionsToSave.length > 0) onSavePositions(positionsToSave);
  }, [setNodes, onSavePositions]);

  // Keep ref in sync so mount effect and keyboard shortcuts get latest function
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

  // Keyboard shortcuts for frequent map actions.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 'l') {
        event.preventDefault();
        handleAutoLayout();
      } else if (key === 'v') {
        event.preventDefault();
        handleFitVisible();
      } else if (key === 'x') {
        event.preventDefault();
        handleExpandAll();
      } else if (key === 'c') {
        event.preventDefault();
        handleCollapseAll();
      } else if (key === 's') {
        event.preventDefault();
        handleResetSmartCollapse();
      } else if (key === 'g') {
        event.preventDefault();
        handleToggleGhostNodes();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleAutoLayout,
    handleFitVisible,
    handleExpandAll,
    handleCollapseAll,
    handleResetSmartCollapse,
    handleToggleGhostNodes,
  ]);

  // Sync hidden state and collapse/search metadata into ReactFlow nodes & edges
  useEffect(() => {
    setNodes(prev => prev.map(node => {
      const hasChildren = (treeData.childrenMap.get(node.id) ?? []).length > 0;
      return {
        ...node,
        hidden: !visibleNodeIds.has(node.id),
        data: {
          ...node.data,
          isCollapsed: collapsedNodes.has(node.id),
          collapsedCount: collapsedNodes.has(node.id)
            ? (treeData.descendantCountMap.get(node.id) ?? 0)
            : 0,
          hasChildren,
          isFocused: focusedNodeId === node.id,
          isSearchMatch: searchMatchSet.has(node.id),
          onToggleCollapse: hasChildren
            ? () => handleToggleCollapse(node.id)
            : undefined,
        },
      };
    }));

    setEdges(prev => prev.map(edge => {
      const hiddenByType =
        (edge.type === 'reportsToEdge' && !uiPrefs.showReportsToEdges) ||
        (edge.type === 'customEdge' && !uiPrefs.showCustomEdges);

      return {
        ...edge,
        hidden: hiddenByType || !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target),
      };
    }));
  }, [
    visibleNodeIds,
    collapsedNodes,
    treeData,
    focusedNodeId,
    searchMatchSet,
    uiPrefs.showReportsToEdges,
    uiPrefs.showCustomEdges,
    setNodes,
    setEdges,
    handleToggleCollapse,
  ]);

  // Re-layout after collapse/expand (skip initial render)
  const isFirstCollapseRender = useRef(true);
  useEffect(() => {
    if (isFirstCollapseRender.current) {
      isFirstCollapseRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const visibleNodes = nodesRef.current.filter(node => !node.hidden);
      const visibleEdges = edgesRef.current.filter(edge => !edge.hidden);

      const graph = new dagre.graphlib.Graph();
      graph.setDefaultEdgeLabel(() => ({}));
      graph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

      for (const node of visibleNodes) {
        const width = node.type === 'ghostNode' ? 200 : 220;
        const height = node.type === 'ghostNode' ? 80 : 100;
        graph.setNode(node.id, { width, height });
      }

      for (const edge of visibleEdges) {
        graph.setEdge(edge.source, edge.target);
      }

      dagre.layout(graph);

      let laidOutNodes: Node[] = [];
      setNodes(prev => {
        laidOutNodes = prev.map(node => {
          if (node.hidden) return node;
          const dagreNode = graph.node(node.id);
          if (!dagreNode) return node;
          const width = node.type === 'ghostNode' ? 200 : 220;
          const height = node.type === 'ghostNode' ? 80 : 100;
          return {
            ...node,
            position: {
              x: dagreNode.x - width / 2,
              y: dagreNode.y - height / 2,
            },
          };
        });
        return laidOutNodes;
      });

      const positionsToSave = serializeNodePositions(laidOutNodes);
      if (positionsToSave.length > 0) onSavePositions(positionsToSave);
    }, 50);

    return () => clearTimeout(timer);
  }, [collapsedNodes, onSavePositions, setNodes]);

  const visibleNodeCount = useMemo(
    () => nodes.reduce((count, node) => count + (node.hidden ? 0 : 1), 0),
    [nodes]
  );

  const visibleEdgeCount = useMemo(
    () => edges.reduce((count, edge) => count + (edge.hidden ? 0 : 1), 0),
    [edges]
  );

  return (
    <div className="relative w-full h-full">
      <ProspectMapToolbar
        onAutoLayout={handleAutoLayout}
        onFitVisible={handleFitVisible}
        onAddProspect={onAddProspect}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onResetSmartCollapse={handleResetSmartCollapse}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        isSaving={isSaving}
        isBuildingMap={isBuildingMap}
        buildStep={buildStep}
        onBuildMap={onBuildMap}
        onImport={onImport}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        searchMatchCount={searchMatchNodeIds.length}
        searchActiveIndex={searchActiveIndex}
        onFocusNextMatch={handleFocusNextMatch}
        onFocusPrevMatch={handleFocusPrevMatch}
        showGhostNodes={uiPrefs.showGhostNodes}
        showReportsToEdges={uiPrefs.showReportsToEdges}
        showCustomEdges={uiPrefs.showCustomEdges}
        onToggleGhostNodes={handleToggleGhostNodes}
        onToggleReportsToEdges={handleToggleReportsToEdges}
        onToggleCustomEdges={handleToggleCustomEdges}
        visibleNodeCount={visibleNodeCount}
        totalNodeCount={nodes.length}
        visibleEdgeCount={visibleEdgeCount}
        totalEdgeCount={edges.length}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onMoveEnd={handleMoveEnd}
        onInit={handleFlowInit}
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
