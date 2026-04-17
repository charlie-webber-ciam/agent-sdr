import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { indexAccountResearchVectorsBestEffort } from '@/lib/account-vectors';
import { analyzeAccountData } from '@/lib/categorizer';
import {
  createAccount,
  createAccountNote,
  getAccount,
  updateAccountAuth0Research,
  updateAccountMetadata,
  updateAccountResearchModel,
  updateAccountStatus,
} from '@/lib/db';
import {
  formatBriefForAccountSummary,
} from '@/lib/standalone-email-writer';
import {
  generatedEmailDraftSchema,
  researchBriefSchema,
  STANDALONE_EMAIL_WRITER_MODEL,
  type GeneratedEmailDraft,
  type ResearchBrief,
} from '@/lib/standalone-email-writer-schema';

const requestSchema = z.object({
  brief: researchBriefSchema,
  selectedDraft: generatedEmailDraftSchema.optional(),
});

function renderEvidence(brief: ResearchBrief): string {
  return brief.evidence
    .map((item) => `- **${item.title}**: ${item.snippet}\n  Source: ${item.url}`)
    .join('\n');
}

function buildResearchPayload(brief: ResearchBrief) {
  const commonSummary = formatBriefForAccountSummary(brief);
  const evidenceBlock = renderEvidence(brief);

  return {
    command_of_message: brief.commandMessage,
    current_auth_solution: [
      '## Identity Context',
      'This record was promoted from the standalone email writer, so explicit auth-vendor confirmation may be incomplete.',
      `- What they do: ${brief.whatTheyDo}`,
      `- Biggest likely identity-related problem: ${brief.biggestProblem}`,
      `- Why it matters to ${brief.prospectTitle}: ${brief.whyThisProblemLikelyMattersToThisProspect}`,
      `- Auth0 value drivers: ${brief.auth0ValueDrivers.join(', ')}`,
    ].join('\n'),
    customer_base_info: [
      '## Commercial Context',
      `- Industry: ${brief.industry}`,
      `- Likely business model: ${brief.likelyBusinessModel}`,
      `- Business impact: ${brief.businessImpact}`,
      `- Desired outcome: ${brief.desiredOutcome}`,
    ].join('\n'),
    security_incidents: [
      '## Problem Framing',
      `- Biggest likely problem: ${brief.biggestProblem}`,
      `- Command of the message: ${brief.commandMessage}`,
      `- Confidence: ${brief.confidence}`,
    ].join('\n'),
    news_and_funding: [
      '## Trigger And Sources',
      `- Observed signal: ${brief.recentTriggerOrObservation}`,
      evidenceBlock,
    ].join('\n'),
    tech_transformation: [
      '## Transformation Angle',
      commonSummary,
      '',
      '## Evidence',
      evidenceBlock,
    ].join('\n'),
    prospects: JSON.stringify([
      {
        name: brief.prospectName,
        title: brief.prospectTitle,
        background: `Standalone email writer prospect. Biggest likely problem: ${brief.biggestProblem}`,
      },
    ]),
    research_summary: [
      commonSummary,
      '',
      'Sources:',
      brief.evidence.map((item) => `- ${item.url}`).join('\n'),
    ].join('\n'),
  };
}

function buildNoteContent(brief: ResearchBrief, draft?: GeneratedEmailDraft): string {
  if (!draft) {
    return [
      `Standalone email writer brief promoted for ${brief.prospectName}, ${brief.prospectTitle}.`,
      `Command of the message (Auth0 Value Framework):\n${brief.commandMessage}`,
      `Observed signal: ${brief.recentTriggerOrObservation}`,
    ].join('\n');
  }

  return [
    `Standalone email writer draft selected for ${brief.prospectName}, ${brief.prospectTitle}.`,
    `Angle: ${draft.angle}`,
    `Command of the message (Auth0 Value Framework):\n${brief.commandMessage}`,
    '',
    `Subject: ${draft.subject}`,
    '',
    draft.body,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = requestSchema.parse(body);

    const accountId = createAccount(
      input.brief.companyName,
      input.brief.domain,
      input.brief.industry,
      null
    );

    updateAccountAuth0Research(accountId, buildResearchPayload(input.brief));
    updateAccountStatus(accountId, 'completed');
    updateAccountResearchModel(accountId, STANDALONE_EMAIL_WRITER_MODEL);

    createAccountNote(accountId, buildNoteContent(input.brief, input.selectedDraft));

    const account = getAccount(accountId);
    if (!account) {
      throw new Error('Failed to load promoted account');
    }

    const suggestions = await analyzeAccountData(account);
    updateAccountMetadata(accountId, {
      tier: suggestions.tier,
      estimated_annual_revenue: suggestions.estimatedAnnualRevenue,
      estimated_user_volume: suggestions.estimatedUserVolume,
      use_cases: JSON.stringify(suggestions.useCases),
      auth0_skus: JSON.stringify(suggestions.auth0Skus),
      priority_score: suggestions.priorityScore,
      ai_suggestions: JSON.stringify(suggestions),
      sdr_notes: input.brief.commandMessage,
      last_edited_at: new Date().toISOString(),
    });

    await indexAccountResearchVectorsBestEffort(accountId);

    return NextResponse.json({
      success: true,
      accountId,
    });
  } catch (error) {
    console.error('Standalone email writer promotion error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to promote brief',
      },
      { status: 500 }
    );
  }
}
