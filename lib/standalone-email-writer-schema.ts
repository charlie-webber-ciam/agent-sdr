import { z } from 'zod';
import { AUTH0_VALUE_DRIVERS } from './auth0-value-framework';

export { AUTH0_VALUE_DRIVERS } from './auth0-value-framework';

export const STANDALONE_EMAIL_WRITER_MODEL = 'gpt-5.4';

export const emailWriterResearchInputSchema = z.object({
  companyNameOrDomain: z.string().min(1, 'Company name or domain is required'),
  prospectName: z.string().min(1, 'Prospect name is required'),
  prospectTitle: z.string().min(1, 'Prospect title is required'),
  customContext: z.string().optional(),
  customInstructions: z.string().optional(),
});

export const researchEvidenceSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  snippet: z.string().min(1),
});

export const researchBriefCoreSchema = z.object({
  companyName: z.string().min(1),
  domain: z.string().nullable(),
  industry: z.string().min(1),
  whatTheyDo: z.string().min(1),
  likelyBusinessModel: z.string().min(1),
  recentTriggerOrObservation: z.string().min(1),
  biggestProblem: z.string().min(1),
  whyThisProblemLikelyMattersToThisProspect: z.string().min(1),
  businessImpact: z.string().min(1),
  auth0ValueDrivers: z.array(z.enum(AUTH0_VALUE_DRIVERS)).min(1).max(3),
  desiredOutcome: z.string().min(1),
  commandMessage: z.string().min(1),
  evidence: z.array(researchEvidenceSchema).min(1).max(5),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const researchBriefSchema = researchBriefCoreSchema.extend({
  prospectName: z.string().min(1),
  prospectTitle: z.string().min(1),
});

export const generatedEmailDraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  angle: z.enum(['diagnostic', 'benchmark', 'loss-aversion']),
  rationale: z.string().min(1),
});

export const singleGeneratedEmailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  reasoning: z.string().min(1),
  keyInsights: z.array(z.string().min(1)).max(5),
});

export const generatedEmailDraftsSchema = z.array(generatedEmailDraftSchema).length(3).superRefine((drafts, ctx) => {
  const uniqueAngles = new Set(drafts.map((draft) => draft.angle));
  if (uniqueAngles.size !== drafts.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Draft angles must be unique.',
    });
  }
});

export const generatedEmailDraftsEnvelopeSchema = z.object({
  drafts: generatedEmailDraftsSchema,
});

export type EmailWriterResearchInput = z.infer<typeof emailWriterResearchInputSchema>;
export type ResearchEvidence = z.infer<typeof researchEvidenceSchema>;
export type ResearchBrief = z.infer<typeof researchBriefSchema>;
export type GeneratedEmailDraft = z.infer<typeof generatedEmailDraftSchema>;
export type SingleGeneratedEmail = z.infer<typeof singleGeneratedEmailSchema>;
