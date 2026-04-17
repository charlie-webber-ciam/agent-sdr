import { z } from 'zod';

export const EVENT_INVITATION_WRITER_MODEL = 'gpt-5.4';

export const POSITIONING_ANGLES = ['problem-fit', 'capability-fit', 'network-fit'] as const;

const eventInvitationBaseSchema = z.object({
  eventDescription: z.string().min(50, 'Event description should be detailed enough to personalise from'),
  registrationLink: z.string().url('Must be a valid registration URL'),
  prospectName: z.string().min(1, 'Prospect name is required'),
  prospectTitle: z.string().min(1, 'Prospect title is required'),
  customInstructions: z.string().optional(),
});

export const eventInvitationStandaloneInputSchema = eventInvitationBaseSchema.extend({
  prospectCompany: z.string().min(1, 'Prospect company is required'),
});

export const eventInvitationAccountInputSchema = eventInvitationBaseSchema.extend({
  accountId: z.number().positive(),
});

export const eventResearchEvidenceSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  snippet: z.string().min(1),
});

export const eventResearchBriefSchema = z.object({
  companyName: z.string().min(1),
  domain: z.string().nullable(),
  industry: z.string().min(1),
  whatTheyDo: z.string().min(1),
  currentAuthChallenges: z.string().min(1),
  likelyEventRelevance: z.string().min(1),
  evidence: z.array(eventResearchEvidenceSchema).min(0).max(3),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const generatedInvitationSchema = z.object({
  body: z.string().min(1),
  positioningAngle: z.enum(POSITIONING_ANGLES),
  positioning: z.string().min(1),
  keyEventHighlight: z.string().min(1),
});

export const generatedInvitationsEnvelopeSchema = z.object({
  invitations: z.array(generatedInvitationSchema).length(3).superRefine((invitations, ctx) => {
    const uniqueAngles = new Set(invitations.map((inv) => inv.positioningAngle));
    if (uniqueAngles.size !== invitations.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invitation positioning angles must be unique.',
      });
    }
  }),
});

export type EventInvitationStandaloneInput = z.infer<typeof eventInvitationStandaloneInputSchema>;
export type EventInvitationAccountInput = z.infer<typeof eventInvitationAccountInputSchema>;
export type EventResearchEvidence = z.infer<typeof eventResearchEvidenceSchema>;
export type EventResearchBrief = z.infer<typeof eventResearchBriefSchema>;
export type GeneratedInvitation = z.infer<typeof generatedInvitationSchema>;
