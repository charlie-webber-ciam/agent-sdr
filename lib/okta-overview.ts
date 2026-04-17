import { z } from 'zod';
import {
  BUSINESS_STRUCTURE_TYPES,
  TECH_STACK_CATEGORIES,
  accountPrioritySchema,
  accountTriggerSchema,
  businessStructureItemSchema,
  techStackItemSchema,
  AccountPriority,
  AccountTrigger,
  BusinessStructureItem,
  TechStackItem,
  normalizePriorities,
  normalizeTriggers,
  normalizeBusinessStructure,
  normalizeTechStack,
  parseJsonArray,
} from './account-overview';

export {
  BUSINESS_STRUCTURE_TYPES,
  TECH_STACK_CATEGORIES,
  normalizePriorities,
  normalizeTriggers,
  normalizeBusinessStructure,
  normalizeTechStack,
  parseJsonArray,
};

export type { AccountPriority, AccountTrigger, BusinessStructureItem, TechStackItem };

// ─── Okta Value Drivers ──────────────────────────────────────────────────────

export const OKTA_VALUE_DRIVERS = [
  'secure the workforce',
  'simplify IT operations',
  'enable the workforce',
] as const;

export type OktaValueDriver = typeof OKTA_VALUE_DRIVERS[number];

export const OKTA_VALUE_DRIVER_LABELS: Record<OktaValueDriver, string> = {
  'secure the workforce': 'Secure the workforce',
  'simplify IT operations': 'Simplify IT operations',
  'enable the workforce': 'Enable the workforce',
};

export const oktaAccountValueDriverSchema = z.object({
  driver: z.enum(OKTA_VALUE_DRIVERS),
  rationale: z.string(),
  evidence: z.string(),
});

export type OktaAccountValueDriver = z.infer<typeof oktaAccountValueDriverSchema>;

// ─── Okta Overview Types ─────────────────────────────────────────────────────

export interface OktaAccountOverviewInput {
  priorities: AccountPriority[];
  valueDrivers: OktaAccountValueDriver[];
  triggers: AccountTrigger[];
  businessModelMarkdown: string;
  businessStructure: BusinessStructureItem[];
  techStack: TechStackItem[];
  povMarkdown: string;
}

export interface OktaAccountOverviewRecord extends OktaAccountOverviewInput {
  generatedAt: string | null;
  povGeneratedAt: string | null;
  lastEditedAt: string | null;
}

export interface StoredOktaAccountOverviewLike {
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

export const EMPTY_OKTA_ACCOUNT_OVERVIEW: OktaAccountOverviewRecord = {
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

// ─── Normalize Helpers ───────────────────────────────────────────────────────

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeOktaValueDrivers(
  valueDrivers?: Array<Partial<OktaAccountValueDriver>> | null
): OktaAccountValueDriver[] {
  return (valueDrivers ?? []).slice(0, 3).map((item) => ({
    driver: OKTA_VALUE_DRIVERS.includes(item?.driver as OktaValueDriver)
      ? (item?.driver as OktaValueDriver)
      : OKTA_VALUE_DRIVERS[0],
    rationale: toText(item?.rationale),
    evidence: toText(item?.evidence),
  }));
}

export function normalizeOktaOverviewInput(
  input?: Partial<OktaAccountOverviewInput> | null
): OktaAccountOverviewInput {
  return {
    priorities: normalizePriorities(input?.priorities),
    valueDrivers: normalizeOktaValueDrivers(input?.valueDrivers),
    triggers: normalizeTriggers(input?.triggers),
    businessModelMarkdown: toText(input?.businessModelMarkdown),
    businessStructure: normalizeBusinessStructure(input?.businessStructure),
    techStack: normalizeTechStack(input?.techStack),
    povMarkdown: toText(input?.povMarkdown),
  };
}

export function normalizeOktaOverviewRecord(
  record?: Partial<OktaAccountOverviewRecord> | null
): OktaAccountOverviewRecord {
  const normalized = normalizeOktaOverviewInput(record);
  return {
    ...normalized,
    generatedAt: record?.generatedAt ?? null,
    povGeneratedAt: record?.povGeneratedAt ?? null,
    lastEditedAt: record?.lastEditedAt ?? null,
  };
}

export function buildOktaOverviewRecordFromStorage(
  stored?: StoredOktaAccountOverviewLike | null
): OktaAccountOverviewRecord {
  return normalizeOktaOverviewRecord({
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

export function hasMeaningfulOktaOverviewContent(overview: OktaAccountOverviewInput | OktaAccountOverviewRecord): boolean {
  function hasAnyText(values: string[]): boolean {
    return values.some((v) => v.trim().length > 0);
  }
  if (overview.priorities.some((item) => hasAnyText([item.title, item.rationale, item.evidence]))) return true;
  if (overview.valueDrivers.some((item) => hasAnyText([item.rationale, item.evidence]))) return true;
  if (overview.triggers.some((item) => hasAnyText([item.title, item.detail, item.source, item.dateLabel]))) return true;
  if (overview.businessModelMarkdown.trim().length > 0) return true;
  if (overview.businessStructure.some((item) => hasAnyText([item.name, item.region, item.notes, ...item.associatedApps]))) return true;
  if (overview.techStack.some((item) => hasAnyText([item.name, item.notes]))) return true;
  return false;
}
