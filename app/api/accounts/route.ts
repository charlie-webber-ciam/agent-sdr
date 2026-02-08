import { NextResponse } from 'next/server';
import { getAccountsWithFilters } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      search: searchParams.get('search') || undefined,
      industry: searchParams.get('industry') || undefined,
      status: searchParams.get('status') || undefined,
      tier: searchParams.get('tier') || undefined,
      sku: searchParams.get('sku') || undefined,
      useCase: searchParams.get('useCase') || undefined,
      minPriority: searchParams.get('minPriority') ? parseInt(searchParams.get('minPriority')!) : undefined,
      revenue: searchParams.get('revenue') || undefined,
      accountOwner: searchParams.get('accountOwner') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const accounts = getAccountsWithFilters(filters);

    // Extract unique values for filter metadata
    const allIndustries = new Set<string>();
    const allTiers = new Set<string>();
    const allSkus = new Set<string>();
    const allUseCases = new Set<string>();
    const allAccountOwners = new Set<string>();

    accounts.forEach(acc => {
      if (acc.industry) allIndustries.add(acc.industry);
      if (acc.tier) allTiers.add(acc.tier);
      if (acc.auth0_account_owner) allAccountOwners.add(acc.auth0_account_owner);

      if (acc.auth0_skus) {
        try {
          const skus = JSON.parse(acc.auth0_skus);
          skus.forEach((sku: string) => allSkus.add(sku));
        } catch (e) {}
      }

      if (acc.use_cases) {
        try {
          const useCases = JSON.parse(acc.use_cases);
          useCases.forEach((uc: string) => allUseCases.add(uc));
        } catch (e) {}
      }
    });

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

        return {
          id: acc.id,
          companyName: acc.company_name,
          domain: acc.domain,
          industry: acc.industry,
          status: acc.research_status,
          researchSummary: acc.research_summary,
          processedAt: acc.processed_at,
          createdAt: acc.created_at,
          tier: acc.tier,
          estimatedAnnualRevenue: acc.estimated_annual_revenue,
          estimatedUserVolume: acc.estimated_user_volume,
          useCases,
          auth0Skus,
          priorityScore: acc.priority_score,
          lastEditedAt: acc.last_edited_at,
          auth0AccountOwner: acc.auth0_account_owner,
        };
      }),
      total: accounts.length,
      filters: {
        availableIndustries: Array.from(allIndustries).sort(),
        availableTiers: Array.from(allTiers).sort(),
        availableSkus: Array.from(allSkus).sort(),
        availableUseCases: Array.from(allUseCases).sort(),
        availableAccountOwners: Array.from(allAccountOwners).sort(),
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
