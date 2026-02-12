import { NextRequest, NextResponse } from 'next/server';
import {
  createJob,
  createAccount,
  updateAccountStatus,
  updateAccountResearch,
  getAccount,
  updateAccountMetadata,
} from '@/lib/db';
import { researchCompany } from '@/lib/agent-researcher';
import { analyzeAccountData } from '@/lib/categorizer';

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

    // Run research
    console.log(`Starting research for: ${companyName}`);
    const researchResult = await researchCompany({
      company_name: companyName,
      domain,
      industry,
    });

    // Update account with research results
    updateAccountResearch(accountId, researchResult);

    // Mark as completed
    updateAccountStatus(accountId, 'completed');

    console.log(`Research completed for: ${companyName}`);

    // Run categorization
    console.log(`Starting categorization for: ${companyName}`);
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

      console.log(`Categorization completed for: ${companyName} - Tier ${aiSuggestions.tier}`);
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
