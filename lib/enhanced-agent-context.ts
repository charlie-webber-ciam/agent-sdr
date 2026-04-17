import { Account } from './db';
import { AccountOverviewRecord } from './account-overview';
import { buildOpportunityContext } from './opportunity-context';
import { buildActivityContext } from './activity-context';
import { buildAttachedAccountDocumentContext } from './account-documents';

interface AgentNote {
  content: string;
  createdAt: string;
}

/**
 * Builds a unified text context string for all SDR agents (email, sequence, cold call).
 * Combines account research, overview planning data, user notes, and supplementary context.
 */
export function buildEnhancedAgentContext(
  account: Account,
  overview: AccountOverviewRecord | null | undefined,
  notes: AgentNote[],
  researchContext: 'auth0' | 'okta' = 'auth0'
): string {
  const parts: string[] = [];

  // ── Company basics ──
  parts.push(`COMPANY: ${account.company_name}`);
  parts.push(`INDUSTRY: ${account.industry || 'Unknown'}`);
  if (account.domain) parts.push(`DOMAIN: ${account.domain}`);
  parts.push(`\nRESEARCH PERSPECTIVE: ${researchContext === 'auth0' ? 'Auth0 CIAM' : 'Okta Workforce Identity'}`);

  if (account.tier) parts.push(`\nTIER: ${account.tier}`);
  if (account.estimated_annual_revenue) parts.push(`ESTIMATED ARR: ${account.estimated_annual_revenue}`);
  if (account.estimated_user_volume) parts.push(`USER VOLUME: ${account.estimated_user_volume}`);

  // ── Research data (perspective-specific) ──
  if (researchContext === 'auth0') {
    if (account.command_of_message) parts.push(`\nCOMMAND OF THE MESSAGE:\n${account.command_of_message}`);
    if (account.use_cases) parts.push(`\nUSE CASES: ${account.use_cases}`);
    if (account.auth0_skus) parts.push(`RELEVANT SKUs: ${account.auth0_skus}`);
    if (account.ai_suggestions) {
      try {
        const suggestions = JSON.parse(account.ai_suggestions);
        if (suggestions.priority_reasoning) parts.push(`\nPRIORITY REASONING: ${suggestions.priority_reasoning}`);
      } catch { /* ignore */ }
    }
    if (account.current_auth_solution) parts.push(`\nCURRENT AUTH SOLUTION:\n${account.current_auth_solution}`);
    if (account.customer_base_info) parts.push(`\nCUSTOMER BASE & GROWTH:\n${account.customer_base_info}`);
    if (account.security_incidents) parts.push(`\nSECURITY & COMPLIANCE:\n${account.security_incidents}`);
    if (account.news_and_funding) parts.push(`\nRECENT NEWS & FUNDING:\n${account.news_and_funding}`);
    if (account.tech_transformation) parts.push(`\nTECH TRANSFORMATION:\n${account.tech_transformation}`);
    if (account.research_summary) parts.push(`\nEXECUTIVE SUMMARY:\n${account.research_summary}`);
    if (account.prospects) {
      try {
        const prospects = JSON.parse(account.prospects);
        if (Array.isArray(prospects) && prospects.length > 0) {
          parts.push(`\nKEY PROSPECTS:\n${prospects.map((p: any) => `- ${p.name} (${p.title})`).join('\n')}`);
        }
      } catch { /* ignore */ }
    }
  } else {
    if (account.okta_opportunity_type) parts.push(`\nOPPORTUNITY TYPE: ${account.okta_opportunity_type}`);
    if (account.okta_priority_score) parts.push(`OKTA PRIORITY SCORE: ${account.okta_priority_score}/100`);
    if (account.okta_current_iam_solution) parts.push(`\nCURRENT IAM SOLUTION:\n${account.okta_current_iam_solution}`);
    if (account.okta_workforce_info) parts.push(`\nWORKFORCE & IT COMPLEXITY:\n${account.okta_workforce_info}`);
    if (account.okta_security_incidents) parts.push(`\nSECURITY & COMPLIANCE:\n${account.okta_security_incidents}`);
    if (account.okta_news_and_funding) parts.push(`\nRECENT NEWS & FUNDING:\n${account.okta_news_and_funding}`);
    if (account.okta_tech_transformation) parts.push(`\nTECH TRANSFORMATION:\n${account.okta_tech_transformation}`);
    if (account.okta_ecosystem) parts.push(`\nOKTA ECOSYSTEM:\n${account.okta_ecosystem}`);
    if (account.okta_research_summary) parts.push(`\nEXECUTIVE SUMMARY:\n${account.okta_research_summary}`);
    if (account.okta_prospects) {
      try {
        const prospects = JSON.parse(account.okta_prospects);
        if (Array.isArray(prospects) && prospects.length > 0) {
          parts.push(`\nKEY PROSPECTS:\n${prospects.map((p: any) => `- ${p.name} (${p.title})`).join('\n')}`);
        }
      } catch { /* ignore */ }
    }
  }

  // ── Account Overview (SDR planning data) ──
  if (overview) {
    const overviewParts: string[] = [];

    const filledPriorities = overview.priorities.filter((p) => p.title.trim());
    if (filledPriorities.length > 0) {
      overviewParts.push('ACCOUNT PRIORITIES:');
      for (const p of filledPriorities) {
        overviewParts.push(`  ${p.rank}. ${p.title}${p.rationale ? ` - ${p.rationale}` : ''}`);
      }
    }

    if (overview.valueDrivers.length > 0) {
      overviewParts.push('\nVALUE DRIVERS:');
      for (const vd of overview.valueDrivers) {
        overviewParts.push(`  - ${vd.driver}${vd.rationale ? `: ${vd.rationale}` : ''}`);
      }
    }

    if (overview.triggers.length > 0) {
      overviewParts.push('\nBUSINESS TRIGGERS:');
      for (const t of overview.triggers) {
        overviewParts.push(`  - ${t.title}${t.detail ? `: ${t.detail}` : ''}${t.dateLabel ? ` (${t.dateLabel})` : ''}`);
      }
    }

    if (overview.businessModelMarkdown.trim()) {
      overviewParts.push(`\nBUSINESS MODEL:\n${overview.businessModelMarkdown.trim()}`);
    }

    if (overview.techStack.length > 0) {
      overviewParts.push('\nTECH STACK:');
      for (const ts of overview.techStack) {
        overviewParts.push(`  - ${ts.name} (${ts.category})${ts.notes ? ` - ${ts.notes}` : ''}`);
      }
    }

    if (overview.povMarkdown.trim()) {
      overviewParts.push(`\nSTRATEGIC POV:\n${overview.povMarkdown.trim()}`);
    }

    if (overviewParts.length > 0) {
      parts.push('\n--- ACCOUNT OVERVIEW (SDR PLANNING) ---');
      parts.push(overviewParts.join('\n'));
      parts.push('--- END ACCOUNT OVERVIEW ---');
    }
  }

  // ── Account Notes ──
  if (notes.length > 0) {
    const recentNotes = notes.slice(0, 10);
    parts.push('\n--- ACCOUNT TEAM NOTES ---');
    for (const note of recentNotes) {
      const date = new Date(note.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
      parts.push(`[${date}] ${note.content}`);
    }
    parts.push('--- END NOTES ---');
  }

  // ── Supplementary context (opportunities, activities, documents) ──
  if (account.id) {
    const oppContext = buildOpportunityContext(account.id);
    if (oppContext) parts.push(`\n${oppContext}`);

    const actContext = buildActivityContext(account.id);
    if (actContext) parts.push(`\n${actContext}`);

    const documentContext = buildAttachedAccountDocumentContext(account.id);
    if (documentContext) parts.push(`\n${documentContext}`);
  }

  return parts.join('\n');
}
