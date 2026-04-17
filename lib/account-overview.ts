import { z } from 'zod';
import { AUTH0_VALUE_DRIVERS } from './auth0-value-framework';

export type Auth0ValueDriver = typeof AUTH0_VALUE_DRIVERS[number];

export const BUSINESS_STRUCTURE_TYPES = [
  'org',
  'brand',
  'business_unit',
  'subsidiary',
  'entity',
  'app',
  'platform',
  'region',
] as const;

export const TECH_STACK_CATEGORIES = [
  'identity',
  'customer_data',
  'cloud',
  'commerce',
  'crm',
  'security',
  'developer',
  'analytics',
  'other',
] as const;

export const AUTH0_VALUE_DRIVER_LABELS: Record<Auth0ValueDriver, string> = {
  'accelerate time to market': 'Accelerate time to market',
  'elevate the customer experience': 'Elevate the customer experience',
  'protect the brand': 'Protect the brand',
};

export const accountPrioritySchema = z.object({
  rank: z.number().int().min(1).max(5),
  title: z.string(),
  rationale: z.string(),
  evidence: z.string(),
});

export const accountValueDriverSchema = z.object({
  driver: z.enum(AUTH0_VALUE_DRIVERS),
  rationale: z.string(),
  evidence: z.string(),
});

export const accountTriggerSchema = z.object({
  title: z.string(),
  detail: z.string(),
  source: z.string(),
  dateLabel: z.string(),
});

export const businessStructureItemSchema = z.object({
  name: z.string(),
  type: z.enum(BUSINESS_STRUCTURE_TYPES),
  region: z.string(),
  associatedApps: z.array(z.string()),
  notes: z.string(),
});

export const techStackItemSchema = z.object({
  category: z.enum(TECH_STACK_CATEGORIES),
  name: z.string(),
  notes: z.string(),
});

export const accountOverviewInputSchema = z.object({
  priorities: z.array(accountPrioritySchema).length(5),
  valueDrivers: z.array(accountValueDriverSchema).max(3),
  triggers: z.array(accountTriggerSchema).max(2),
  businessModelMarkdown: z.string(),
  businessStructure: z.array(businessStructureItemSchema),
  techStack: z.array(techStackItemSchema),
  povMarkdown: z.string(),
});

export type AccountPriority = z.infer<typeof accountPrioritySchema>;
export type AccountValueDriver = z.infer<typeof accountValueDriverSchema>;
export type AccountTrigger = z.infer<typeof accountTriggerSchema>;
export type BusinessStructureItem = z.infer<typeof businessStructureItemSchema>;
export type TechStackItem = z.infer<typeof techStackItemSchema>;
export type AccountOverviewInput = z.infer<typeof accountOverviewInputSchema>;

export interface AccountOverviewRecord extends AccountOverviewInput {
  generatedAt: string | null;
  povGeneratedAt: string | null;
  lastEditedAt: string | null;
}

export interface StoredAccountOverviewLike {
  priorities_json?: string | null;
  value_drivers_json?: string | null;
  triggers_json?: string | null;
  business_model_markdown?: string | null;
  business_structure_json?: string | null;
  tech_stack_json?: string | null;
  pov_markdown?: string | null;
  generated_at?: string | null;
  pov_generated_at?: string | null;
  last_edited_at?: string | null;
}

export const EMPTY_ACCOUNT_OVERVIEW: AccountOverviewRecord = {
  priorities: [1, 2, 3, 4, 5].map((rank) => ({
    rank,
    title: '',
    rationale: '',
    evidence: '',
  })),
  valueDrivers: [],
  triggers: [],
  businessModelMarkdown: '',
  businessStructure: [],
  techStack: [],
  povMarkdown: '',
  generatedAt: null,
  povGeneratedAt: null,
  lastEditedAt: null,
};

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function normalizePriorities(priorities?: Array<Partial<AccountPriority>> | null): AccountPriority[] {
  const byRank = new Map<number, Partial<AccountPriority>>();
  for (const priority of priorities ?? []) {
    if (!priority || typeof priority.rank !== 'number') continue;
    if (priority.rank < 1 || priority.rank > 5) continue;
    byRank.set(priority.rank, priority);
  }

  return [1, 2, 3, 4, 5].map((rank) => {
    const value = byRank.get(rank);
    return {
      rank,
      title: toText(value?.title),
      rationale: toText(value?.rationale),
      evidence: toText(value?.evidence),
    };
  });
}

export function normalizeValueDrivers(valueDrivers?: Array<Partial<AccountValueDriver>> | null): AccountValueDriver[] {
  return (valueDrivers ?? []).slice(0, 3).map((item) => ({
    driver: AUTH0_VALUE_DRIVERS.includes(item?.driver as Auth0ValueDriver)
      ? (item?.driver as Auth0ValueDriver)
      : AUTH0_VALUE_DRIVERS[0],
    rationale: toText(item?.rationale),
    evidence: toText(item?.evidence),
  }));
}

export function normalizeTriggers(triggers?: Array<Partial<AccountTrigger>> | null): AccountTrigger[] {
  return (triggers ?? []).slice(0, 2).map((item) => ({
    title: toText(item?.title),
    detail: toText(item?.detail),
    source: toText(item?.source),
    dateLabel: toText(item?.dateLabel),
  }));
}

export function normalizeBusinessStructure(items?: Array<Partial<BusinessStructureItem>> | null): BusinessStructureItem[] {
  return (items ?? []).map((item) => ({
    name: toText(item?.name),
    type: BUSINESS_STRUCTURE_TYPES.includes(item?.type as (typeof BUSINESS_STRUCTURE_TYPES)[number])
      ? (item?.type as (typeof BUSINESS_STRUCTURE_TYPES)[number])
      : 'entity',
    region: toText(item?.region),
    associatedApps: toStringArray(item?.associatedApps),
    notes: toText(item?.notes),
  }));
}

export function normalizeTechStack(items?: Array<Partial<TechStackItem>> | null): TechStackItem[] {
  return (items ?? []).map((item) => ({
    category: TECH_STACK_CATEGORIES.includes(item?.category as (typeof TECH_STACK_CATEGORIES)[number])
      ? (item?.category as (typeof TECH_STACK_CATEGORIES)[number])
      : 'other',
    name: toText(item?.name),
    notes: toText(item?.notes),
  }));
}

export function normalizeOverviewInput(input?: Partial<AccountOverviewInput> | null): AccountOverviewInput {
  return {
    priorities: normalizePriorities(input?.priorities),
    valueDrivers: normalizeValueDrivers(input?.valueDrivers),
    triggers: normalizeTriggers(input?.triggers),
    businessModelMarkdown: toText(input?.businessModelMarkdown),
    businessStructure: normalizeBusinessStructure(input?.businessStructure),
    techStack: normalizeTechStack(input?.techStack),
    povMarkdown: toText(input?.povMarkdown),
  };
}

export function normalizeOverviewRecord(record?: Partial<AccountOverviewRecord> | null): AccountOverviewRecord {
  const normalized = normalizeOverviewInput(record);
  return {
    ...normalized,
    generatedAt: record?.generatedAt ?? null,
    povGeneratedAt: record?.povGeneratedAt ?? null,
    lastEditedAt: record?.lastEditedAt ?? null,
  };
}

export function buildOverviewRecordFromStorage(stored?: StoredAccountOverviewLike | null): AccountOverviewRecord {
  return normalizeOverviewRecord({
    priorities: parseJsonArray(stored?.priorities_json),
    valueDrivers: parseJsonArray(stored?.value_drivers_json),
    triggers: parseJsonArray(stored?.triggers_json),
    businessModelMarkdown: stored?.business_model_markdown ?? '',
    businessStructure: parseJsonArray(stored?.business_structure_json),
    techStack: parseJsonArray(stored?.tech_stack_json),
    povMarkdown: stored?.pov_markdown ?? '',
    generatedAt: stored?.generated_at ?? null,
    povGeneratedAt: stored?.pov_generated_at ?? null,
    lastEditedAt: stored?.last_edited_at ?? null,
  });
}

function hasAnyText(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0);
}

export function hasMeaningfulOverviewContent(overview: AccountOverviewInput | AccountOverviewRecord): boolean {
  if (overview.priorities.some((item) => hasAnyText([item.title, item.rationale, item.evidence]))) return true;
  if (overview.valueDrivers.some((item) => hasAnyText([item.rationale, item.evidence]))) return true;
  if (overview.triggers.some((item) => hasAnyText([item.title, item.detail, item.source, item.dateLabel]))) return true;
  if (overview.businessModelMarkdown.trim().length > 0) return true;
  if (overview.businessStructure.some((item) => hasAnyText([item.name, item.region, item.notes, ...item.associatedApps]))) return true;
  if (overview.techStack.some((item) => hasAnyText([item.name, item.notes]))) return true;
  return false;
}

export function hasMeaningfulPov(overview: Pick<AccountOverviewInput, 'povMarkdown'> | Pick<AccountOverviewRecord, 'povMarkdown'>): boolean {
  return overview.povMarkdown.trim().length > 0;
}

export function createBlankValueDriver(): AccountValueDriver {
  return {
    driver: AUTH0_VALUE_DRIVERS[0],
    rationale: '',
    evidence: '',
  };
}

export function createBlankTrigger(): AccountTrigger {
  return {
    title: '',
    detail: '',
    source: '',
    dateLabel: '',
  };
}

export function createBlankBusinessStructureItem(): BusinessStructureItem {
  return {
    name: '',
    type: 'entity',
    region: '',
    associatedApps: [],
    notes: '',
  };
}

export function createBlankTechStackItem(): TechStackItem {
  return {
    category: 'other',
    name: '',
    notes: '',
  };
}
