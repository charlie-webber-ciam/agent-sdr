import { NextResponse } from 'next/server';
import { getOpportunitiesWithProspects } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    const opportunities = getOpportunitiesWithProspects(accountId);

    return NextResponse.json({
      opportunities: opportunities.map(opp => ({
        id: opp.id,
        opportunityName: opp.opportunity_name,
        stage: opp.stage,
        lastStageChangeDate: opp.last_stage_change_date,
        businessUseCase: opp.business_use_case,
        winLossDescription: opp.win_loss_description,
        whyDoAnything: opp.why_do_anything,
        whyDoItNow: opp.why_do_it_now,
        whySolveProblem: opp.why_solve_problem,
        whyOkta: opp.why_okta,
        stepsToClose: opp.steps_to_close,
        economicBuyer: opp.economic_buyer,
        metrics: opp.metrics,
        decisionProcess: opp.decision_process,
        paperProcess: opp.paper_process,
        identifyPain: opp.identify_pain,
        decisionCriteria: opp.decision_criteria,
        champions: opp.champions,
        championTitle: opp.champion_title,
        compellingEvent: opp.compelling_event,
        competition: opp.competition,
        createdAt: opp.created_at,
        linkedProspects: opp.linkedProspects.map(p => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          title: p.title,
          email: p.email,
          phone: p.phone,
          roleType: p.role_type,
        })),
      })),
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunities' },
      { status: 500 }
    );
  }
}
