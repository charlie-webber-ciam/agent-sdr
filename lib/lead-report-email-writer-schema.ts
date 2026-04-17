import { z } from 'zod';

export const leadReportMatchSchema = z.object({
  kind: z.enum(['matched', 'unmatched']),
  method: z.enum(['domain', 'name_exact', 'fuzzy_unique', 'no_match']),
  accountId: z.number().int().positive().nullable(),
  accountName: z.string().nullable(),
  domain: z.string().nullable(),
  industry: z.string().nullable(),
  hasResearchContext: z.boolean(),
});

export const leadReportLeadSchema = z.object({
  rowNumber: z.number().int().positive(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fullName: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  campaignName: z.string().nullable(),
  memberStatus: z.string().nullable(),
  accountStatus: z.string().nullable(),
  auth0Owner: z.string().nullable(),
  parserSource: z.enum(['deterministic', 'llm']),
  match: leadReportMatchSchema,
});

export const leadReportParseResponseSchema = z.object({
  parserMode: z.enum(['deterministic', 'llm']),
  parseErrors: z.array(z.string()),
  leads: z.array(leadReportLeadSchema),
});

export const leadReportGenerateRequestSchema = z.object({
  lead: leadReportLeadSchema,
  customInstructions: z.string().optional(),
});

export const leadReportGeneratedEmailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  reasoning: z.string().min(1),
  keyInsights: z.array(z.string()),
});

export const leadReportGenerateResponseSchema = z.object({
  rowNumber: z.number().int().positive(),
  fullName: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  email: z.string().nullable(),
  matchType: z.enum([
    'matched_account_context',
    'matched_account_light_research',
    'unmatched_light_research',
  ]),
  accountId: z.number().int().positive().nullable(),
  accountName: z.string().nullable(),
  prospectId: z.number().int().positive().nullable(),
  prospectStatus: z.enum(['created', 'existing', 'unattached']),
  generatedEmail: leadReportGeneratedEmailSchema,
});

export type LeadReportLead = z.infer<typeof leadReportLeadSchema>;
export type LeadReportGenerateResponse = z.infer<typeof leadReportGenerateResponseSchema>;
