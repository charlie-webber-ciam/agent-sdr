import {
  getAccount,
  getAccountWorkingJob,
  updateAccountWorkingJob,
  getProspectsByAccount,
  findExistingProspectByEmailOrName,
  createProspect,
  updateProspectAIData,
  bulkUpdateProspectParents,
  bulkUpsertProspectPositions,
  type Account,
} from './db';
import { buildProspectMap } from './prospect-map-builder-agent';
import { assessContactReadiness } from './prospect-contact-readiness';
import dagre from '@dagrejs/dagre';

const activeJobs = new Set<number>();

export function isMapBuilderJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

/**
 * Build prospect map for an account inline (no job tracking).
 * Called from the bulk research pipeline after categorization.
 * Returns stats about what was created.
 */
export async function buildProspectMapForAccount(
  account: Account
): Promise<{ prospectsCreated: number; prospectsSkipped: number; hierarchyUpdates: number }> {
  const existingProspects = getProspectsByAccount(account.id);
  const prospectInput = existingProspects.map(p => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    title: p.title,
    department: p.department,
    seniority_level: p.seniority_level,
    role_type: p.role_type,
  }));

  const mapResult = await buildProspectMap(
    account.company_name,
    account.domain,
    account.industry,
    prospectInput,
  );

  // Apply hierarchy to existing prospects
  if (mapResult.hierarchy.length > 0) {
    const existingIds = new Set(existingProspects.map(p => p.id));
    const validHierarchy = mapResult.hierarchy.filter(h =>
      existingIds.has(h.prospectId) &&
      (h.parentProspectId === null || existingIds.has(h.parentProspectId))
    );
    if (validHierarchy.length > 0) {
      bulkUpdateProspectParents(validHierarchy);
    }
  }

  // Create new prospects and track name→id for resolving reportsToName
  const nameToId = new Map<string, number>();
  for (const p of existingProspects) {
    nameToId.set(`${p.first_name} ${p.last_name}`.toLowerCase(), p.id);
  }

  let prospectsCreated = 0;
  let prospectsSkipped = 0;

  for (const np of mapResult.newProspects) {
    const existing = findExistingProspectByEmailOrName(
      account.id,
      undefined,
      np.first_name,
      np.last_name
    );

    if (existing) {
      prospectsSkipped++;
      nameToId.set(`${np.first_name} ${np.last_name}`.toLowerCase(), existing.id);
      continue;
    }

    const prospect = createProspect({
      account_id: account.id,
      first_name: np.first_name,
      last_name: np.last_name,
      title: np.title,
      department: np.department,
      linkedin_url: np.linkedin_url || undefined,
      role_type: np.role_type,
      relationship_status: 'new',
      source: 'ai_research',
      description: np.relevance_reason,
    });

    nameToId.set(`${np.first_name} ${np.last_name}`.toLowerCase(), prospect.id);
    prospectsCreated++;

    try {
      const readiness = assessContactReadiness(prospect);
      updateProspectAIData(prospect.id, {
        seniority_level: np.seniority_level,
        contact_readiness: readiness,
      });
    } catch {
      // non-critical
    }
  }

  // Resolve reportsToName → parent_prospect_id for new prospects
  const parentUpdates: Array<{ prospectId: number; parentProspectId: number | null }> = [];
  for (const np of mapResult.newProspects) {
    if (!np.reportsToName) continue;
    const childId = nameToId.get(`${np.first_name} ${np.last_name}`.toLowerCase());
    const parentId = nameToId.get(np.reportsToName.toLowerCase());
    if (childId && parentId && childId !== parentId) {
      parentUpdates.push({ prospectId: childId, parentProspectId: parentId });
    }
  }
  if (parentUpdates.length > 0) {
    bulkUpdateProspectParents(parentUpdates);
  }

  // Run dagre layout and save positions
  const allProspects = getProspectsByAccount(account.id);
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

  for (const p of allProspects) {
    g.setNode(`p_${p.id}`, { width: 220, height: 100 });
  }
  for (const p of allProspects) {
    if (p.parent_prospect_id) {
      g.setEdge(`p_${p.parent_prospect_id}`, `p_${p.id}`);
    }
  }
  dagre.layout(g);

  const positions = allProspects.map(p => {
    const dagreNode = g.node(`p_${p.id}`);
    return {
      prospectId: p.id,
      x: dagreNode ? dagreNode.x - 100 : 0,
      y: dagreNode ? dagreNode.y - 50 : 0,
      nodeType: 'structured',
    };
  });

  bulkUpsertProspectPositions(account.id, positions);

  return {
    prospectsCreated,
    prospectsSkipped,
    hierarchyUpdates: mapResult.hierarchy.length,
  };
}

export async function processMapBuilderJob(jobId: number): Promise<void> {
  if (activeJobs.has(jobId)) {
    console.log(`Map builder job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getAccountWorkingJob(jobId);
    if (!job) throw new Error(`Map builder job ${jobId} not found`);
    if (job.status !== 'pending') {
      console.log(`Map builder job ${jobId} is not pending (status: ${job.status})`);
      return;
    }

    const account = getAccount(job.account_id);
    if (!account) throw new Error(`Account ${job.account_id} not found`);

    // ── Phase 1: Analyzing ──
    updateAccountWorkingJob(jobId, {
      status: 'analyzing',
      current_step: `Analyzing org structure at ${account.company_name}...`,
    });

    const existingProspects = getProspectsByAccount(account.id);
    const prospectInput = existingProspects.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      title: p.title,
      department: p.department,
      seniority_level: p.seniority_level,
      role_type: p.role_type,
    }));

    let mapResult;
    try {
      mapResult = await buildProspectMap(
        account.company_name,
        account.domain,
        account.industry,
        prospectInput,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      updateAccountWorkingJob(jobId, {
        status: 'failed',
        error_log: `Agent failed: ${errMsg}`,
        completed_at: new Date().toISOString(),
      });
      return;
    }

    console.log(`[MapBuilder ${jobId}] Agent returned: ${mapResult.hierarchy.length} hierarchy updates, ${mapResult.newProspects.length} new prospects`);

    // ── Phase 2: Building ──
    updateAccountWorkingJob(jobId, {
      status: 'building',
      prospects_found: mapResult.newProspects.length,
      current_step: 'Applying hierarchy and creating new prospects...',
    });

    // Apply hierarchy to existing prospects
    if (mapResult.hierarchy.length > 0) {
      // Filter to only valid existing prospect IDs
      const existingIds = new Set(existingProspects.map(p => p.id));
      const validHierarchy = mapResult.hierarchy.filter(h =>
        existingIds.has(h.prospectId) &&
        (h.parentProspectId === null || existingIds.has(h.parentProspectId))
      );
      if (validHierarchy.length > 0) {
        bulkUpdateProspectParents(validHierarchy);
        console.log(`[MapBuilder ${jobId}] Applied ${validHierarchy.length} hierarchy relationships`);
      }
    }

    // Create new prospects and track name→id for resolving reportsToName
    const nameToId = new Map<string, number>();
    // Seed with existing prospects
    for (const p of existingProspects) {
      nameToId.set(`${p.first_name} ${p.last_name}`.toLowerCase(), p.id);
    }

    let prospectsCreated = 0;
    let prospectsSkipped = 0;
    const newProspectIds: number[] = [];

    for (const np of mapResult.newProspects) {
      // Deduplicate
      const existing = findExistingProspectByEmailOrName(
        account.id,
        undefined,
        np.first_name,
        np.last_name
      );

      if (existing) {
        prospectsSkipped++;
        // Still register in nameToId so other new prospects can reference
        nameToId.set(`${np.first_name} ${np.last_name}`.toLowerCase(), existing.id);
        updateAccountWorkingJob(jobId, {
          prospects_skipped: prospectsSkipped,
          current_step: `Skipped ${np.first_name} ${np.last_name} (already exists)`,
        });
        continue;
      }

      const prospect = createProspect({
        account_id: account.id,
        first_name: np.first_name,
        last_name: np.last_name,
        title: np.title,
        department: np.department,
        linkedin_url: np.linkedin_url || undefined,
        role_type: np.role_type,
        relationship_status: 'new',
        source: 'ai_research',
        description: np.relevance_reason,
      });

      nameToId.set(`${np.first_name} ${np.last_name}`.toLowerCase(), prospect.id);
      newProspectIds.push(prospect.id);
      prospectsCreated++;

      // Set seniority_level and contact readiness
      try {
        const readiness = assessContactReadiness(prospect);
        updateProspectAIData(prospect.id, {
          seniority_level: np.seniority_level,
          contact_readiness: readiness,
        });
      } catch {
        // non-critical
      }

      updateAccountWorkingJob(jobId, {
        prospects_created: prospectsCreated,
        current_step: `Created prospect: ${np.first_name} ${np.last_name}`,
      });
    }

    // Resolve reportsToName → parent_prospect_id for new prospects
    const parentUpdates: Array<{ prospectId: number; parentProspectId: number | null }> = [];
    for (const np of mapResult.newProspects) {
      if (!np.reportsToName) continue;
      const childId = nameToId.get(`${np.first_name} ${np.last_name}`.toLowerCase());
      const parentId = nameToId.get(np.reportsToName.toLowerCase());
      if (childId && parentId && childId !== parentId) {
        parentUpdates.push({ prospectId: childId, parentProspectId: parentId });
      }
    }
    if (parentUpdates.length > 0) {
      bulkUpdateProspectParents(parentUpdates);
      console.log(`[MapBuilder ${jobId}] Resolved ${parentUpdates.length} reportsToName relationships`);
    }

    // ── Phase 3: Positioning ──
    updateAccountWorkingJob(jobId, {
      status: 'positioning',
      current_step: 'Auto-laying out org chart...',
    });

    // Re-fetch all prospects with updated hierarchy
    const allProspects = getProspectsByAccount(account.id);

    // Run dagre layout
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

    for (const p of allProspects) {
      g.setNode(`p_${p.id}`, { width: 220, height: 100 });
    }

    for (const p of allProspects) {
      if (p.parent_prospect_id) {
        g.setEdge(`p_${p.parent_prospect_id}`, `p_${p.id}`);
      }
    }

    dagre.layout(g);

    const positions = allProspects.map(p => {
      const dagreNode = g.node(`p_${p.id}`);
      return {
        prospectId: p.id,
        x: dagreNode ? dagreNode.x - 100 : 0,
        y: dagreNode ? dagreNode.y - 50 : 0,
        nodeType: 'structured',
      };
    });

    bulkUpsertProspectPositions(account.id, positions);
    console.log(`[MapBuilder ${jobId}] Positioned ${positions.length} nodes`);

    // ── Complete ──
    updateAccountWorkingJob(jobId, {
      status: 'completed',
      current_step: null,
      error_log: mapResult.search_notes || null,
      completed_at: new Date().toISOString(),
    });

    console.log(`Map builder job ${jobId} completed. Created: ${prospectsCreated}, Skipped: ${prospectsSkipped}, Hierarchy updates: ${mapResult.hierarchy.length}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Map builder job ${jobId} failed:`, errMsg);
    try {
      updateAccountWorkingJob(jobId, {
        status: 'failed',
        error_log: `[FATAL] ${errMsg}`,
        completed_at: new Date().toISOString(),
      });
    } catch {
      // ignore db errors during error handling
    }
  } finally {
    activeJobs.delete(jobId);
  }
}
