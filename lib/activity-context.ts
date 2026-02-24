import { getActivitySummary, getActivitiesByAccount } from './db';

/**
 * Build the activity context for injection into agent prompts.
 *
 * Uses the AI-generated summary if available (preferred — comprehensive, 1-2 pages).
 * Falls back to a basic chronological list of recent activities if no summary exists.
 */
export function buildActivityContext(accountId: number): string {
  // Prefer the AI-generated summary
  const { summary } = getActivitySummary(accountId);
  if (summary) {
    return `ACCOUNT ENGAGEMENT HISTORY (AI-summarised from CRM activities):\n\n${summary}`;
  }

  // Fallback: basic activity list (for accounts that haven't been summarised yet)
  return buildRawActivityContext(accountId);
}

/**
 * Fallback: build a raw chronological list of activities.
 * Capped at 4000 chars with truncated comments.
 */
function buildRawActivityContext(accountId: number): string {
  const activities = getActivitiesByAccount(accountId);

  if (activities.length === 0) {
    return '';
  }

  // Filter to last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoffISO = twelveMonthsAgo.toISOString().substring(0, 10);

  const recentActivities = activities.filter(a => {
    if (!a.created_date) return true;
    return a.created_date >= cutoffISO;
  });

  if (recentActivities.length === 0) {
    return '';
  }

  const sections: string[] = [];
  sections.push('RECENT ACCOUNT ACTIVITIES (emails/calls — raw, no summary available):');
  sections.push('');

  let totalLength = 0;
  const MAX_CHARS = 4000;

  for (const activity of recentActivities) {
    if (totalLength > MAX_CHARS) {
      sections.push(`[... ${recentActivities.length - sections.length + 2} more activities truncated — generate a summary for full context]`);
      break;
    }

    const date = activity.created_date || 'Unknown date';
    const subject = activity.subject;
    const comments = activity.comments
      ? truncate(activity.comments, 300)
      : '';

    let block = `[${date}] ${subject}`;
    if (comments) {
      block += `\n  ${comments}`;
    }
    block += '\n';

    totalLength += block.length;
    sections.push(block);
  }

  return sections.join('\n');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
