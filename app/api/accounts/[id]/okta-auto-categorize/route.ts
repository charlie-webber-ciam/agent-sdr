import { NextResponse } from 'next/server';
import { getAccount, updateOktaAccountMetadata } from '@/lib/db';
import { analyzeOktaAccountData, OktaPatch } from '@/lib/okta-categorizer';

const VALID_PATCHES: OktaPatch[] = ['emerging', 'crp', 'ent', 'stg'];

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

    if (!account.okta_processed_at) {
      return NextResponse.json(
        { error: 'Okta research not completed yet' },
        { status: 400 }
      );
    }

    // Read optional patch from request body
    let patch: OktaPatch | undefined;
    try {
      const body = await request.json();
      if (body.patch && VALID_PATCHES.includes(body.patch)) {
        patch = body.patch;
      }
    } catch {
      // No body or invalid JSON — that's fine, use default
    }

    // Analyze the Okta account data
    const suggestions = await analyzeOktaAccountData(account, undefined, patch);

    // Store both the suggestions and apply the categorization
    updateOktaAccountMetadata(accountId, {
      okta_tier: suggestions.tier,
      okta_estimated_annual_revenue: suggestions.estimatedAnnualRevenue,
      okta_estimated_user_volume: suggestions.estimatedEmployeeCount,
      okta_use_cases: JSON.stringify(suggestions.useCases),
      okta_skus: JSON.stringify(suggestions.oktaSkus),
      okta_ai_suggestions: JSON.stringify(suggestions),
      okta_last_edited_at: new Date().toISOString(),
      okta_patch: patch || null,
    });

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Error auto-categorizing Okta account:', error);
    return NextResponse.json(
      { error: 'Failed to analyze Okta account' },
      { status: 500 }
    );
  }
}
