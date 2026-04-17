import { NextResponse } from 'next/server';

import { buildAccountSimilarityMap } from '@/lib/account-similarity';
import { VectorPerspective } from '@/lib/db';
import { classifyVectorServiceError } from '@/lib/vector-service-errors';

const VALID_PERSPECTIVES = new Set<VectorPerspective>(['auth0', 'okta', 'overall']);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const perspectiveParam = searchParams.get('perspective') || 'overall';
    const perspective = VALID_PERSPECTIVES.has(perspectiveParam as VectorPerspective)
      ? (perspectiveParam as VectorPerspective)
      : 'overall';

    const tier = searchParams.get('tier') || undefined;
    const oktaTier = searchParams.get('oktaTier') || undefined;
    const customerStatus = searchParams.get('customerStatus') || undefined;
    const accountOwner = searchParams.get('accountOwner') || undefined;
    const oktaAccountOwner = searchParams.get('oktaAccountOwner') || undefined;
    const limitParam = parseInt(searchParams.get('limit') || '200', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 300) : 200;
    const selectedAccountIdParam = parseInt(searchParams.get('selectedAccountId') || '', 10);
    const selectedAccountId = Number.isFinite(selectedAccountIdParam) ? selectedAccountIdParam : undefined;

    const map = await buildAccountSimilarityMap({
      perspective,
      search: searchParams.get('search') || undefined,
      customerStatus,
      tier,
      oktaTier,
      accountOwner,
      oktaAccountOwner,
      includeGlobalParent: searchParams.get('includeGlobalParent') === 'true',
      hqState: searchParams.get('hqState') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      limit,
      selectedAccountId,
    });

    return NextResponse.json(map);
  } catch (error) {
    console.error('Error building account similarity map:', error);

    const vectorServiceError = classifyVectorServiceError(error);
    if (vectorServiceError) {
      return NextResponse.json(
        {
          code: vectorServiceError.code,
          error: vectorServiceError.error,
          detail: vectorServiceError.detail,
        },
        { status: vectorServiceError.status }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build account map' },
      { status: 500 }
    );
  }
}
