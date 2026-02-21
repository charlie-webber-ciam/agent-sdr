import { NextResponse } from 'next/server';
import { getAccount, updateAccountMetadata, updateOktaAccountMetadata, deleteAccount, getAccountTags, getSectionComments, getAccountNotes, getProspectCountByAccount } from '@/lib/db';

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

    // Parse Okta prospects
    let oktaProspects = [];
    if (account.okta_prospects) {
      try {
        oktaProspects = JSON.parse(account.okta_prospects);
      } catch (e) {
        oktaProspects = [];
      }
    }

    // Parse Okta categorization fields
    let oktaUseCases = [];
    if (account.okta_use_cases) {
      try {
        oktaUseCases = JSON.parse(account.okta_use_cases);
      } catch (e) {
        oktaUseCases = [];
      }
    }

    let oktaSkus = [];
    if (account.okta_skus) {
      try {
        oktaSkus = JSON.parse(account.okta_skus);
      } catch (e) {
        oktaSkus = [];
      }
    }

    let oktaAiSuggestions = null;
    if (account.okta_ai_suggestions) {
      try {
        oktaAiSuggestions = JSON.parse(account.okta_ai_suggestions);
      } catch (e) {
        oktaAiSuggestions = null;
      }
    }

    // Fetch enrichment data
    const tags = getAccountTags(accountId);
    const sectionCommentsRaw = getSectionComments(accountId);
    const notes = getAccountNotes(accountId);
    const prospectCount = getProspectCountByAccount(accountId);

    // Build sectionComments as a map keyed by `{perspective}:{sectionKey}`
    const sectionComments: Record<string, string> = {};
    for (const c of sectionCommentsRaw) {
      sectionComments[`${c.perspective}:${c.section_key}`] = c.content;
    }

    return NextResponse.json({
      id: account.id,
      companyName: account.company_name,
      domain: account.domain,
      industry: account.industry,
      status: account.research_status,
      // Auth0 CIAM Research
      currentAuthSolution: account.current_auth_solution,
      customerBaseInfo: account.customer_base_info,
      securityIncidents: account.security_incidents,
      newsAndFunding: account.news_and_funding,
      techTransformation: account.tech_transformation,
      prospects,
      researchSummary: account.research_summary,
      // Okta Workforce Identity Research
      oktaCurrentIamSolution: account.okta_current_iam_solution,
      oktaWorkforceInfo: account.okta_workforce_info,
      oktaSecurityIncidents: account.okta_security_incidents,
      oktaNewsAndFunding: account.okta_news_and_funding,
      oktaTechTransformation: account.okta_tech_transformation,
      oktaEcosystem: account.okta_ecosystem,
      oktaProspects,
      oktaResearchSummary: account.okta_research_summary,
      oktaOpportunityType: account.okta_opportunity_type,
      oktaPriorityScore: account.okta_priority_score,
      oktaProcessedAt: account.okta_processed_at,
      // Common fields
      errorMessage: account.error_message,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
      processedAt: account.processed_at,
      // SDR fields (Auth0-focused categorization)
      tier: account.tier,
      estimatedAnnualRevenue: account.estimated_annual_revenue,
      estimatedUserVolume: account.estimated_user_volume,
      useCases,
      auth0Skus,
      sdrNotes: account.sdr_notes,
      priorityScore: account.priority_score,
      lastEditedAt: account.last_edited_at,
      aiSuggestions,
      auth0AccountOwner: account.auth0_account_owner,
      oktaAccountOwner: account.okta_account_owner,
      researchModel: account.research_model,
      // Okta SDR fields (Workforce Identity categorization)
      oktaTier: account.okta_tier,
      oktaEstimatedAnnualRevenue: account.okta_estimated_annual_revenue,
      oktaEstimatedUserVolume: account.okta_estimated_user_volume,
      oktaUseCases,
      oktaSkus,
      oktaSdrNotes: account.okta_sdr_notes,
      oktaLastEditedAt: account.okta_last_edited_at,
      oktaAiSuggestions,
      // Triage data
      triageAuth0Tier: account.triage_auth0_tier,
      triageOktaTier: account.triage_okta_tier,
      triageSummary: account.triage_summary,
      triageData: account.triage_data ? (() => { try { return JSON.parse(account.triage_data); } catch { return null; } })() : null,
      triagedAt: account.triaged_at,
      // Enrichment data
      tags: tags.map(t => ({ id: t.id, tag: t.tag, tagType: t.tag_type, createdAt: t.created_at })),
      sectionComments,
      notes: notes.map(n => ({ id: n.id, content: n.content, createdAt: n.created_at, updatedAt: n.updated_at })),
      prospectCount,
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

    // Handle account owner updates directly
    if (body.auth0AccountOwner !== undefined || body.oktaAccountOwner !== undefined) {
      const { getDb } = await import('@/lib/db');
      const db = getDb();
      if (body.auth0AccountOwner !== undefined) {
        db.prepare('UPDATE accounts SET auth0_account_owner = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(body.auth0AccountOwner, accountId);
      }
      if (body.oktaAccountOwner !== undefined) {
        db.prepare('UPDATE accounts SET okta_account_owner = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(body.oktaAccountOwner, accountId);
      }
      // If only updating owner fields, return early
      if (Object.keys(body).every(k => k === 'auth0AccountOwner' || k === 'oktaAccountOwner')) {
        return NextResponse.json({ success: true });
      }
    }

    // Determine if updating Auth0 or Okta categorization
    const isOktaUpdate = body.oktaTier !== undefined ||
                         body.oktaEstimatedAnnualRevenue !== undefined ||
                         body.oktaEstimatedUserVolume !== undefined ||
                         body.oktaUseCases !== undefined ||
                         body.oktaSkus !== undefined ||
                         body.oktaSdrNotes !== undefined;

    if (isOktaUpdate) {
      // Update Okta categorization
      const oktaUpdates: any = {};

      if (body.oktaTier !== undefined) {
        oktaUpdates.okta_tier = body.oktaTier;
      }

      if (body.oktaEstimatedAnnualRevenue !== undefined) {
        oktaUpdates.okta_estimated_annual_revenue = body.oktaEstimatedAnnualRevenue;
      }

      if (body.oktaEstimatedUserVolume !== undefined) {
        oktaUpdates.okta_estimated_user_volume = body.oktaEstimatedUserVolume;
      }

      if (body.oktaUseCases !== undefined) {
        oktaUpdates.okta_use_cases = JSON.stringify(body.oktaUseCases);
      }

      if (body.oktaSkus !== undefined) {
        oktaUpdates.okta_skus = JSON.stringify(body.oktaSkus);
      }

      if (body.oktaSdrNotes !== undefined) {
        oktaUpdates.okta_sdr_notes = body.oktaSdrNotes;
      }

      oktaUpdates.okta_last_edited_at = new Date().toISOString();

      updateOktaAccountMetadata(accountId, oktaUpdates);
    } else {
      // Update Auth0 categorization
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
    }

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
