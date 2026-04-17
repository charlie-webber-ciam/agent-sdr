import { getDb } from './db';

export interface OrgChartPerson {
  id: number;
  chart_id: number;
  name: string;
  title: string | null;
  department: string | null;
  email: string | null;
  linkedin_url: string | null;
  manager_id: number | null;
  level: number;
  original_reports_to: string | null;
  created_at: string;
}

export interface OrgChart {
  id: number;
  name: string;
  account_id: number | null;
  total_people: number;
  validation_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgChartWithPeople extends OrgChart {
  people: OrgChartPerson[];
  account_name?: string;
}

export interface OrgChartPersonInput {
  name: string;
  title?: string | null;
  department?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  level: number;
  original_reports_to?: string | null;
  /** Temporary index used to resolve manager references during insert */
  _manager_index?: number | null;
}

/**
 * Create an org chart with all its people in a single transaction.
 * manager references are resolved via _manager_index (index in the people array).
 */
export function createOrgChart(
  name: string,
  people: OrgChartPersonInput[],
  validationNotes?: string[]
): { chartId: number; totalPeople: number } {
  const db = getDb();

  const insertChart = db.prepare(`
    INSERT INTO org_charts (name, total_people, validation_notes)
    VALUES (?, ?, ?)
  `);

  const insertPerson = db.prepare(`
    INSERT INTO org_chart_people (chart_id, name, title, department, email, linkedin_url, manager_id, level, original_reports_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = db.transaction(() => {
    const chartResult = insertChart.run(
      name,
      people.length,
      validationNotes ? JSON.stringify(validationNotes) : null
    );
    const chartId = chartResult.lastInsertRowid as number;

    // First pass: insert all people without manager_id to get their IDs
    const insertedIds: number[] = [];
    for (const person of people) {
      const personResult = insertPerson.run(
        chartId,
        person.name,
        person.title || null,
        person.department || null,
        person.email || null,
        person.linkedin_url || null,
        null, // manager_id set in second pass
        person.level,
        person.original_reports_to || null
      );
      insertedIds.push(personResult.lastInsertRowid as number);
    }

    // Second pass: update manager_id references
    const updateManager = db.prepare(`UPDATE org_chart_people SET manager_id = ? WHERE id = ?`);
    for (let i = 0; i < people.length; i++) {
      const mgrIdx = people[i]._manager_index;
      if (mgrIdx != null && mgrIdx >= 0 && mgrIdx < insertedIds.length) {
        updateManager.run(insertedIds[mgrIdx], insertedIds[i]);
      }
    }

    return { chartId, totalPeople: people.length };
  })();

  return result;
}

export function getOrgChart(id: number): OrgChartWithPeople | null {
  const db = getDb();
  const chart = db.prepare(`
    SELECT oc.*, a.company_name as account_name
    FROM org_charts oc
    LEFT JOIN accounts a ON oc.account_id = a.id
    WHERE oc.id = ?
  `).get(id) as (OrgChart & { account_name: string | null }) | undefined;

  if (!chart) return null;

  const people = db.prepare(`
    SELECT * FROM org_chart_people WHERE chart_id = ? ORDER BY level ASC, name ASC
  `).all(id) as OrgChartPerson[];

  return { ...chart, people, account_name: chart.account_name || undefined };
}

export function getAllOrgCharts(): (OrgChart & { account_name?: string })[] {
  const db = getDb();
  return db.prepare(`
    SELECT oc.*, a.company_name as account_name
    FROM org_charts oc
    LEFT JOIN accounts a ON oc.account_id = a.id
    ORDER BY oc.created_at DESC
  `).all() as (OrgChart & { account_name?: string })[];
}

export function getOrgChartsForAccount(accountId: number): OrgChart[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM org_charts WHERE account_id = ? ORDER BY created_at DESC
  `).all(accountId) as OrgChart[];
}

export function attachOrgChartToAccount(chartId: number, accountId: number): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE org_charts SET account_id = ?, updated_at = datetime('now') WHERE id = ?
  `).run(accountId, chartId);
  return result.changes > 0;
}

export function detachOrgChart(chartId: number): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE org_charts SET account_id = NULL, updated_at = datetime('now') WHERE id = ?
  `).run(chartId);
  return result.changes > 0;
}

export function deleteOrgChart(chartId: number): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM org_charts WHERE id = ?`).run(chartId);
  return result.changes > 0;
}
