'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ProspectMapCanvas from './ProspectMapCanvas';
import type { Prospect } from './ProspectTab';

interface GhostProspect {
  ghostKey: string;
  name: string;
  title: string | null;
  linkedin_url: string | null;
  source: string;
}

interface MapData {
  prospects: Prospect[];
  positions: Array<{
    prospect_id: number | null;
    ghost_key: string | null;
    x: number;
    y: number;
  }>;
  edges: Array<{
    id: number;
    source_prospect_id: number | null;
    source_ghost_key: string | null;
    target_prospect_id: number | null;
    target_ghost_key: string | null;
    edge_type: string;
    label: string | null;
  }>;
  opportunities: Array<{
    id: number;
    name: string;
    stage: string | null;
    linkedProspectIds: number[];
  }>;
  ghostProspects: GhostProspect[];
}

interface ProspectMapProps {
  accountId: number;
  onSelectProspect: (p: Prospect) => void;
  onWriteEmail: (p: Prospect) => void;
  onRefresh: () => void;
}

export default function ProspectMap({
  accountId,
  onSelectProspect,
  onWriteEmail,
  onRefresh,
}: ProspectMapProps) {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMapData = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/prospect-map`);
      if (!res.ok) throw new Error('Failed to load map data');
      const data = await res.json();
      setMapData(data);
      setError(null);
    } catch (err) {
      console.error('Error loading map data:', err);
      setError('Failed to load prospect map');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Escape key exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleSavePositions = useCallback(async (
    positions: Array<{ prospectId?: number; ghostKey?: string; x: number; y: number; nodeType: string }>
  ) => {
    setIsSaving(true);
    try {
      await fetch(`/api/accounts/${accountId}/prospect-map/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      });
    } catch (err) {
      console.error('Error saving positions:', err);
    } finally {
      setIsSaving(false);
    }
  }, [accountId]);

  const handleCreateEdge = useCallback(async (source: string, target: string) => {
    const parseNodeId = (id: string) => {
      if (id.startsWith('p_')) return { sourceProspectId: parseInt(id.replace('p_', '')) };
      if (id.startsWith('g_')) return { sourceGhostKey: id.replace('g_', '') };
      return {};
    };
    const sourceData = parseNodeId(source);
    const targetRaw = parseNodeId(target);
    const targetData = {
      targetProspectId: (targetRaw as { sourceProspectId?: number }).sourceProspectId,
      targetGhostKey: (targetRaw as { sourceGhostKey?: string }).sourceGhostKey,
    };

    try {
      await fetch(`/api/accounts/${accountId}/prospect-map/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sourceData, ...targetData }),
      });
    } catch (err) {
      console.error('Error creating edge:', err);
    }
  }, [accountId]);

  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    const dbId = edgeId.replace('custom_', '');
    try {
      await fetch(`/api/accounts/${accountId}/prospect-map/edges/${dbId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error deleting edge:', err);
    }
  }, [accountId]);

  const handleUpdateEdgeLabel = useCallback(async (edgeId: string, label: string) => {
    const dbId = edgeId.replace('custom_', '');
    try {
      await fetch(`/api/accounts/${accountId}/prospect-map/edges/${dbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
    } catch (err) {
      console.error('Error updating edge label:', err);
    }
  }, [accountId]);

  const handlePromoteGhost = useCallback(async (ghostKey: string, ghostData: GhostProspect) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/prospects/promote-ghost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghostKey, ghostData }),
      });
      if (res.ok) {
        onRefresh();
        fetchMapData();
      }
    } catch (err) {
      console.error('Error promoting ghost:', err);
    }
  }, [accountId, onRefresh, fetchMapData]);

  const handleAddProspect = useCallback(() => {
    // Trigger the parent's add prospect flow
    onSelectProspect(null as unknown as Prospect);
  }, [onSelectProspect]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-xl border border-gray-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !mapData) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-red-50 rounded-xl border border-red-200">
        <div className="text-center">
          <p className="text-red-600 text-sm font-medium">{error || 'Failed to load'}</p>
          <button onClick={fetchMapData} className="mt-2 text-sm text-red-600 hover:text-red-700 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const canvasContent = (
    <ProspectMapCanvas
      prospects={mapData.prospects}
      ghostProspects={mapData.ghostProspects}
      positions={mapData.positions}
      edges={mapData.edges}
      opportunities={mapData.opportunities}
      accountId={accountId}
      isFullscreen={isFullscreen}
      onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
      onSelectProspect={onSelectProspect}
      onWriteEmail={onWriteEmail}
      onAddProspect={handleAddProspect}
      onPromoteGhost={handlePromoteGhost}
      onSavePositions={handleSavePositions}
      onCreateEdge={handleCreateEdge}
      onDeleteEdge={handleDeleteEdge}
      onUpdateEdgeLabel={handleUpdateEdgeLabel}
      isSaving={isSaving}
    />
  );

  if (isFullscreen) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'white',
        }}
      >
        {canvasContent}
      </div>,
      document.body
    );
  }

  return (
    <div className="h-[600px] rounded-xl border border-gray-200 overflow-hidden bg-white">
      {canvasContent}
    </div>
  );
}
