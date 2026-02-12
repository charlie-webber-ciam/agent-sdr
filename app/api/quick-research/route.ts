import { NextRequest, NextResponse } from 'next/server';
import {
  createJob,
  createAccount,
  updateAccountStatus,
  updateAccountAuth0Research,
  updateAccountOktaResearch,
  getAccount,
  updateAccountMetadata,
  updateOktaAccountMetadata,
} from '@/lib/db';
import { researchCompanyDual } from '@/lib/dual-researcher';
import { analyzeAccountData } from '@/lib/categorizer';
import { analyzeOktaAccountData } from '@/lib/okta-categorizer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyName, domain, industry } = body;

    // Validate input
    if (!companyName || !industry) {
      return NextResponse.json(
        { error: 'Company name and industry are required' },
        { status: 400 }
      );
    }

    // Create a job for this quick research
    const jobId = createJob('Quick Research', 1);

    // Create the account
    const accountId = createAccount(
      companyName,
      domain || null,
      industry,
      jobId
    );

    // Start research in the background (don't await - return immediately)
    performResearch(accountId, companyName, domain, industry).catch(error => {
      console.error('Research error for account', accountId, ':', error);
      updateAccountStatus(accountId, 'failed', error instanceof Error ? error.message : 'Research failed');
    });

    return NextResponse.json({
      accountId,
      message: 'Research started. You will be redirected to view progress.',
    });
  } catch (error) {
    console.error('Quick research error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start research' },
      { status: 500 }
    );
  }
}

// Perform research asynchronously
async function performResearch(
  accountId: number,
  companyName: string,
  domain: string | null,
  industry: string
) {
  try {
    // Update status to processing
    updateAccountStatus(accountId, 'processing');

    // Run dual research (Auth0 + Okta)
    console.log(`Starting dual research for: ${companyName}`);
    const dualResearch = await researchCompanyDual(
      {
        company_name: companyName,
        domain,
        industry,
      },
      'both'
    );

    // Update Auth0 research if available
    if (dualResearch.auth0) {
      updateAccountAuth0Research(accountId, dualResearch.auth0);
      console.log(`✓ Auth0 research completed for ${companyName}`);
    }

    // Update Okta research if available
    if (dualResearch.okta) {
      updateAccountOktaResearch(accountId, dualResearch.okta);
      console.log(`✓ Okta research completed for ${companyName}`);
    }

    // Mark as completed
    updateAccountStatus(accountId, 'completed');

    console.log(`Research completed for: ${companyName}, starting categorization...`);

    // Run Auth0 categorization
    if (dualResearch.auth0) {
      try {
        const account = getAccount(accountId);
        if (account) {
          const aiSuggestions = await analyzeAccountData(account);

          updateAccountMetadata(accountId, {
            tier: aiSuggestions.tier,
            estimated_annual_revenue: aiSuggestions.estimatedAnnualRevenue,
            estimated_user_volume: aiSuggestions.estimatedUserVolume,
            use_cases: JSON.stringify(aiSuggestions.useCases),
            auth0_skus: JSON.stringify(aiSuggestions.auth0Skus),
            priority_score: aiSuggestions.priorityScore,
            ai_suggestions: JSON.stringify(aiSuggestions),
            last_edited_at: new Date().toISOString(),
          });

          console.log(`✓ Auth0 categorization: ${companyName} → Tier ${aiSuggestions.tier}`);
        }
      } catch (categorizationError) {
        console.error(`Failed to categorize Auth0 for ${companyName}:`, categorizationError);
      }
    }

    // Run Okta categorization
    if (dualResearch.okta) {
      try {
        const account = getAccount(accountId);
        if (account) {
          const oktaSuggestions = await analyzeOktaAccountData(account);

          updateOktaAccountMetadata(accountId, {
            okta_tier: oktaSuggestions.tier,
            okta_estimated_annual_revenue: oktaSuggestions.estimatedAnnualRevenue,
            okta_estimated_user_volume: oktaSuggestions.estimatedEmployeeCount,
            okta_use_cases: JSON.stringify(oktaSuggestions.useCases),
            okta_skus: JSON.stringify(oktaSuggestions.oktaSkus),
            okta_ai_suggestions: JSON.stringify(oktaSuggestions),
            okta_last_edited_at: new Date().toISOString(),
          });

          console.log(`✓ Okta categorization: ${companyName} → Tier ${oktaSuggestions.tier}`);
        }
      } catch (categorizationError) {
        console.error(`Failed to categorize Okta for ${companyName}:`, categorizationError);
      }
    }
  } catch (error) {
    console.error(`Research failed for account ${accountId}:`, error);
    updateAccountStatus(
      accountId,
      'failed',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}
