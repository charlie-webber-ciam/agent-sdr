import { NextResponse } from 'next/server';
import { getAccountsWithFilters, getFilterMetadata } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      search: searchParams.get('search') || undefined,
      industry: searchParams.get('industry') || undefined,
      status: searchParams.get('status') || undefined,
      // Auth0 filters
      tier: searchParams.get('tier') || undefined,
      sku: searchParams.get('sku') || undefined,
      useCase: searchParams.get('useCase') || undefined,
      minPriority: searchParams.get('minPriority') ? parseInt(searchParams.get('minPriority')!) : undefined,
      revenue: searchParams.get('revenue') || undefined,
      accountOwner: searchParams.get('accountOwner') || undefined,
      // Okta filters
      oktaTier: searchParams.get('oktaTier') || undefined,
      oktaSku: searchParams.get('oktaSku') || undefined,
      oktaUseCase: searchParams.get('oktaUseCase') || undefined,
      oktaMinPriority: searchParams.get('oktaMinPriority') ? parseInt(searchParams.get('oktaMinPriority')!) : undefined,
      oktaAccountOwner: searchParams.get('oktaAccountOwner') || undefined,
      // Triage filters
      triageAuth0Tier: searchParams.get('triageAuth0Tier') || undefined,
      triageOktaTier: searchParams.get('triageOktaTier') || undefined,
      freshness: searchParams.get('freshness') || undefined,
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
        availableIndustries: filterMetadata.industries,
        availableTiers: filterMetadata.tiers,
        availableSkus: filterMetadata.skus,
        availableUseCases: filterMetadata.useCases,
        availableAccountOwners: filterMetadata.accountOwners,
        // Okta filter metadata
        availableOktaSkus: filterMetadata.oktaSkus,
        availableOktaUseCases: filterMetadata.oktaUseCases,
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
