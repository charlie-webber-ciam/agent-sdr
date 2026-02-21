import {
  getOpportunitiesByAccount,
  getOpportunityProspects,
  SalesforceOpportunity,
  Prospect,
} from './db';

/**
 * Build a structured text block summarizing all Salesforce opportunity history
 * for an account, suitable for injection into research agent prompts.
 *
 * Token budget: ~2000 tokens max to avoid bloating agent context.
 */
export function buildOpportunityContext(accountId: number): string {
  const opportunities = getOpportunitiesByAccount(accountId);

  if (opportunities.length === 0) {
    return '';
  }

  const sections: string[] = [];
  sections.push('SALESFORCE OPPORTUNITY HISTORY:');
  sections.push('');

  let totalLength = 0;
  const MAX_CHARS = 6000; // ~2000 tokens

  for (const opp of opportunities) {
    if (totalLength > MAX_CHARS) {
      sections.push(`[... ${opportunities.length - sections.length + 2} more opportunities truncated]`);
      break;
    }

    const prospects = getOpportunityProspects(opp.id);
    const oppBlock = formatOpportunityBlock(opp, prospects);
    totalLength += oppBlock.length;
    sections.push(oppBlock);
  }

  return sections.join('\n');
}

function formatOpportunityBlock(opp: SalesforceOpportunity, prospects: Prospect[]): string {
  const lines: string[] = [];

  lines.push(`Opportunity: "${opp.opportunity_name}" | Stage: ${opp.stage || 'Unknown'} | Last Change: ${opp.last_stage_change_date || 'N/A'}`);

  if (opp.business_use_case) {
    lines.push(`  Pain/Use Case: ${truncate(opp.business_use_case, 200)}`);
  }
  if (opp.win_loss_description) {
    lines.push(`  Win/Loss: ${truncate(opp.win_loss_description, 200)}`);
  }
  if (opp.champions) {
    lines.push(`  Champion: ${opp.champions}${opp.champion_title ? ` (${opp.champion_title})` : ''}`);
  }
  if (opp.economic_buyer) {
    lines.push(`  Economic Buyer: ${truncate(opp.economic_buyer, 150)}`);
  }
  if (opp.competition) {
    lines.push(`  Competition: ${truncate(opp.competition, 150)}`);
  }
  if (opp.compelling_event) {
    lines.push(`  Compelling Event: ${truncate(opp.compelling_event, 150)}`);
  }

  const keyNotes: string[] = [];
  if (opp.why_do_anything) keyNotes.push(truncate(opp.why_do_anything, 100));
  if (opp.why_do_it_now) keyNotes.push(truncate(opp.why_do_it_now, 100));
  if (keyNotes.length > 0) {
    lines.push(`  Key Notes: ${keyNotes.join(' | ')}`);
  }

  if (opp.identify_pain) {
    lines.push(`  Pain Points: ${truncate(opp.identify_pain, 150)}`);
  }
  if (opp.decision_criteria) {
    lines.push(`  Decision Criteria: ${truncate(opp.decision_criteria, 150)}`);
  }
  if (opp.metrics) {
    lines.push(`  Metrics: ${truncate(opp.metrics, 150)}`);
  }

  if (prospects.length > 0) {
    const prospectList = prospects
      .slice(0, 5)
      .map(p => `${p.first_name} ${p.last_name}${p.title ? ` (${p.title})` : ''}${p.role_type ? ` [${p.role_type}]` : ''}`)
      .join(', ');
    lines.push(`  Contacts: ${prospectList}`);
  }

  lines.push('');
  return lines.join('\n');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Build section-specific subsets of opportunity context for targeted injection.
 */
export function buildSectionContext(
  accountId: number,
  section: 'auth' | 'prospects' | 'news' | 'general'
): string {
  const opportunities = getOpportunitiesByAccount(accountId);
  if (opportunities.length === 0) return '';

  const lines: string[] = [];

  switch (section) {
    case 'auth': {
      // Focus on pain points, why_okta, business_use_case
      lines.push('HISTORICAL DEAL CONTEXT (Auth/Pain Focus):');
      for (const opp of opportunities.slice(0, 3)) {
        if (opp.business_use_case) lines.push(`- Use Case: ${truncate(opp.business_use_case, 200)}`);
        if (opp.identify_pain) lines.push(`- Pain: ${truncate(opp.identify_pain, 200)}`);
        if (opp.why_okta) lines.push(`- Why Okta: ${truncate(opp.why_okta, 200)}`);
        if (opp.competition) lines.push(`- Competition: ${truncate(opp.competition, 150)}`);
      }
      break;
    }
    case 'prospects': {
      // Focus on champion info, economic buyer
      lines.push('HISTORICAL DEAL CONTEXT (Key People):');
      for (const opp of opportunities.slice(0, 3)) {
        if (opp.champions) lines.push(`- Champion: ${opp.champions}${opp.champion_title ? ` (${opp.champion_title})` : ''}`);
        if (opp.economic_buyer) lines.push(`- Economic Buyer: ${truncate(opp.economic_buyer, 150)}`);
        const prospects = getOpportunityProspects(opp.id);
        if (prospects.length > 0) {
          lines.push(`- Known Contacts: ${prospects.slice(0, 5).map(p => `${p.first_name} ${p.last_name} (${p.title || 'N/A'})`).join(', ')}`);
        }
      }
      break;
    }
    case 'news': {
      // Focus on stage history, compelling events
      lines.push('HISTORICAL DEAL CONTEXT (Timeline/Events):');
      for (const opp of opportunities.slice(0, 3)) {
        lines.push(`- "${opp.opportunity_name}" Stage: ${opp.stage || 'Unknown'} (${opp.last_stage_change_date || 'N/A'})`);
        if (opp.compelling_event) lines.push(`  Compelling Event: ${truncate(opp.compelling_event, 150)}`);
        if (opp.why_do_it_now) lines.push(`  Why Now: ${truncate(opp.why_do_it_now, 150)}`);
      }
      break;
    }
    default: {
      // Abbreviated summary
      lines.push('HISTORICAL DEAL CONTEXT (Summary):');
      for (const opp of opportunities.slice(0, 3)) {
        lines.push(`- "${opp.opportunity_name}" | ${opp.stage || 'Unknown'} | ${opp.last_stage_change_date || 'N/A'}`);
      }
      break;
    }
  }

  return lines.length > 1 ? lines.join('\n') : '';
}
