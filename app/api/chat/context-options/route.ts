import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAllAccounts, getProspectsByAccount, getProspectsWithFilters } from '@/lib/db';

const querySchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      accountId: searchParams.get('accountId') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    });

    const accounts = getAllAccounts(parsed.q || undefined, undefined, undefined, 200, 0).map((account) => ({
      id: account.id,
      companyName: account.company_name,
      domain: account.domain,
      industry: account.industry,
    }));

    let prospects: Array<{
      id: number;
      accountId: number;
      firstName: string;
      lastName: string;
      title: string | null;
    }> = [];

    if (parsed.accountId) {
      prospects = getProspectsByAccount(parsed.accountId).map((prospect) => ({
        id: prospect.id,
        accountId: prospect.account_id,
        firstName: prospect.first_name,
        lastName: prospect.last_name,
        title: prospect.title,
      }));
    } else if (parsed.q) {
      const { prospects: matchedProspects } = getProspectsWithFilters({
        search: parsed.q,
        limit: 100,
        offset: 0,
      });

      prospects = matchedProspects.map((prospect) => ({
        id: prospect.id,
        accountId: prospect.account_id,
        firstName: prospect.first_name,
        lastName: prospect.last_name,
        title: prospect.title,
      }));
    }

    return NextResponse.json({
      success: true,
      accounts,
      prospects,
    });
  } catch (error) {
    console.error('Failed to load chat context options:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load chat context options' },
      { status: 500 }
    );
  }
}

