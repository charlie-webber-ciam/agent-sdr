import { NextResponse } from 'next/server';
import { getAccount, updateAccountMetadata, deleteAccount } from '@/lib/db';

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

    const account = getAccount(accountId);

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    let prospects = [];
    if (account.prospects) {
      try {
        prospects = JSON.parse(account.prospects);
      } catch (e) {
        prospects = [];
      }
    }

    let useCases = [];
    if (account.use_cases) {
      try {
        useCases = JSON.parse(account.use_cases);
      } catch (e) {
        useCases = [];
      }
    }

    let auth0Skus = [];
    if (account.auth0_skus) {
      try {
        auth0Skus = JSON.parse(account.auth0_skus);
      } catch (e) {
        auth0Skus = [];
      }
    }

    let aiSuggestions = null;
    if (account.ai_suggestions) {
      try {
        aiSuggestions = JSON.parse(account.ai_suggestions);
      } catch (e) {
        aiSuggestions = null;
      }
    }

    return NextResponse.json({
      id: account.id,
      companyName: account.company_name,
      domain: account.domain,
      industry: account.industry,
      status: account.research_status,
      currentAuthSolution: account.current_auth_solution,
      customerBaseInfo: account.customer_base_info,
      securityIncidents: account.security_incidents,
      newsAndFunding: account.news_and_funding,
      techTransformation: account.tech_transformation,
      prospects,
      researchSummary: account.research_summary,
      errorMessage: account.error_message,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
      processedAt: account.processed_at,
      // SDR fields
      tier: account.tier,
      estimatedAnnualRevenue: account.estimated_annual_revenue,
      estimatedUserVolume: account.estimated_user_volume,
      useCases,
      auth0Skus,
      sdrNotes: account.sdr_notes,
      priorityScore: account.priority_score,
      lastEditedAt: account.last_edited_at,
      aiSuggestions,
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await request.json();

    const updates: any = {};

    if (body.tier !== undefined) {
      updates.tier = body.tier;
    }

    if (body.estimatedAnnualRevenue !== undefined) {
      updates.estimated_annual_revenue = body.estimatedAnnualRevenue;
    }

    if (body.estimatedUserVolume !== undefined) {
      updates.estimated_user_volume = body.estimatedUserVolume;
    }

    if (body.useCases !== undefined) {
      updates.use_cases = JSON.stringify(body.useCases);
    }

    if (body.auth0Skus !== undefined) {
      updates.auth0_skus = JSON.stringify(body.auth0Skus);
    }

    if (body.sdrNotes !== undefined) {
      updates.sdr_notes = body.sdrNotes;
    }

    if (body.priorityScore !== undefined) {
      updates.priority_score = body.priorityScore;
    }

    updates.last_edited_at = new Date().toISOString();

    updateAccountMetadata(accountId, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Check if account exists
    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Delete the account
    const deleted = deleteAccount(accountId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Account ${account.company_name} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
