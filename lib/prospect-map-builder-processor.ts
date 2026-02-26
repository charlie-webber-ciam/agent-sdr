import {
  getAccount,
  getAccountWorkingJob,
  updateAccountWorkingJob,
  getProspectsByAccount,
  bulkUpdateProspectParents,
  bulkUpsertProspectPositions,
  type Account,
} from './db';
import { analyzeProspectHierarchy } from './prospect-map-builder-agent';
import { buildWeightedOpportunityContext } from './opportunity-context';
import dagre from '@dagrejs/dagre';

const activeJobs = new Set<number>();

export function isMapBuilderJobActive(jobId: number): boolean {
  return activeJobs.has(jobId);
}

/**
 * Run AI hierarchy analysis + dagre layout for an account's existing prospects.
 * No prospect discovery — purely analyzes and positions what's already there.
 */
export async function buildHierarchyForAccount(
  account: Account
): Promise<{ hierarchyUpdates: number }> {
  const existingProspects = getProspectsByAccount(account.id);

  if (existingProspects.length <= 1) {
    // Still do layout for single prospect
    if (existingProspects.length === 1) {
      bulkUpsertProspectPositions(account.id, [{
        prospectId: existingProspects[0].id,
        x: 0,
        y: 0,
        nodeType: 'structured',
      }]);
    }
    return { hierarchyUpdates: 0 };
  }

  const prospectInput = existingProspects.map(p => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    title: p.title,
    department: p.department,
    seniority_level: p.seniority_level,
    role_type: p.role_type,
  }));

  // Fetch opportunity context to inform hierarchy decisions
  const opportunityContext = buildWeightedOpportunityContext(account.id) || undefined;

  const result = await analyzeProspectHierarchy(
    account.company_name,
    account.industry,
    prospectInput,
    opportunityContext,
  );

  // Apply hierarchy
  if (result.hierarchy.length > 0) {
    const existingIds = new Set(existingProspects.map(p => p.id));
    const validHierarchy = result.hierarchy.filter(h =>
      existingIds.has(h.prospectId) &&
      (h.parentProspectId === null || existingIds.has(h.parentProspectId))
    );
    if (validHierarchy.length > 0) {
      bulkUpdateProspectParents(validHierarchy);
    }
  }

  // Re-fetch with updated hierarchy and run dagre layout
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

  return { hierarchyUpdates: result.hierarchy.length };
}

/**
 * Background job version — uses account_working_jobs for status tracking.
 */
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

    updateAccountWorkingJob(jobId, {
      status: 'analyzing',
      current_step: `Analyzing hierarchy at ${account.company_name}...`,
    });

    const stats = await buildHierarchyForAccount(account);

    updateAccountWorkingJob(jobId, {
      status: 'completed',
      current_step: null,
      error_log: null,
      completed_at: new Date().toISOString(),
    });

    console.log(`Map builder job ${jobId} completed. Hierarchy updates: ${stats.hierarchyUpdates}`);
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
