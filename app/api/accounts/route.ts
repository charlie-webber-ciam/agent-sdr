import { NextResponse } from 'next/server';
import { getAccountsWithFilters, getFilterMetadata } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      search: searchParams.get('search') || undefined,
      tier: searchParams.get('tier') || undefined,
      oktaTier: searchParams.get('oktaTier') || undefined,
      accountOwner: searchParams.get('accountOwner') || undefined,
      oktaAccountOwner: searchParams.get('oktaAccountOwner') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const result = getAccountsWithFilters(filters);
    const accounts = result.accounts;
    const total = result.total;

    // Get filter metadata from all accounts (not just current page)
    const filterMetadata = getFilterMetadata();

    return NextResponse.json({
      accounts: accounts.map(acc => {
        let useCases = [];
        if (acc.use_cases) {
          try {
            useCases = JSON.parse(acc.use_cases);
          } catch (e) {
            useCases = [];
          }
        }

        let auth0Skus = [];
        if (acc.auth0_skus) {
          try {
            auth0Skus = JSON.parse(acc.auth0_skus);
          } catch (e) {
            auth0Skus = [];
          }
        }

        let oktaUseCases = [];
        if (acc.okta_use_cases) {
          try {
            oktaUseCases = JSON.parse(acc.okta_use_cases);
          } catch (e) {
            oktaUseCases = [];
          }
        }

        let oktaSkus = [];
        if (acc.okta_skus) {
          try {
            oktaSkus = JSON.parse(acc.okta_skus);
          } catch (e) {
            oktaSkus = [];
          }
        }

        return {
          id: acc.id,
          companyName: acc.company_name,
          domain: acc.domain,
          industry: acc.industry,
          status: acc.research_status,
          researchSummary: acc.research_summary,
          processedAt: acc.processed_at,
          createdAt: acc.created_at,
          // Auth0 categorization
          tier: acc.tier,
          estimatedAnnualRevenue: acc.estimated_annual_revenue,
          estimatedUserVolume: acc.estimated_user_volume,
          useCases,
          auth0Skus,
          priorityScore: acc.priority_score,
          lastEditedAt: acc.last_edited_at,
          auth0AccountOwner: acc.auth0_account_owner,
          // Okta categorization
          oktaTier: acc.okta_tier,
          oktaEstimatedAnnualRevenue: acc.okta_estimated_annual_revenue,
          oktaEstimatedUserVolume: acc.okta_estimated_user_volume,
          oktaUseCases,
          oktaSkus,
          oktaPriorityScore: acc.okta_priority_score,
          oktaOpportunityType: acc.okta_opportunity_type,
          oktaProcessedAt: acc.okta_processed_at,
          oktaAccountOwner: acc.okta_account_owner,
          oktaPatch: acc.okta_patch,
          // Triage data
          triageAuth0Tier: acc.triage_auth0_tier,
          triageOktaTier: acc.triage_okta_tier,
          triageSummary: acc.triage_summary,
          triagedAt: acc.triaged_at,
        };
      }),
      total,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        totalPages: Math.ceil(total / filters.limit),
        currentPage: Math.floor(filters.offset / filters.limit) + 1,
      },
      filters: {
        availableAccountOwners: filterMetadata.accountOwners,
        availableOktaAccountOwners: filterMetadata.oktaAccountOwners,
      },
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
