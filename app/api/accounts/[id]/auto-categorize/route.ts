import { NextResponse } from 'next/server';
import { getAccount, updateAccountMetadata } from '@/lib/db';
import { analyzeAccountData } from '@/lib/categorizer';

export async function POST(
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

    const account = getAccount(accountId);

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (account.research_status !== 'completed') {
      return NextResponse.json(
        { error: 'Account research not completed yet' },
        { status: 400 }
      );
    }

    // Analyze the account data
    const suggestions = await analyzeAccountData(account);

    // Store both the suggestions and apply the categorization
    updateAccountMetadata(accountId, {
      tier: suggestions.tier,
      estimated_annual_revenue: suggestions.estimatedAnnualRevenue,
      estimated_user_volume: suggestions.estimatedUserVolume,
      use_cases: JSON.stringify(suggestions.useCases),
      auth0_skus: JSON.stringify(suggestions.auth0Skus),
      priority_score: suggestions.priorityScore,
      ai_suggestions: JSON.stringify(suggestions),
      last_edited_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Error auto-categorizing account:', error);
    return NextResponse.json(
      { error: 'Failed to analyze account' },
      { status: 500 }
    );
  }
}
