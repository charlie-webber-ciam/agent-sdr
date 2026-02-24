import { getActivitiesByAccount } from './db';

/**
 * Build a text block summarizing recent account activities (emails/calls)
 * for injection into agent prompts.
 *
 * - Only includes activities from the last 12 months
 * - Truncates individual comments to 300 chars
 * - Caps total output at ~4000 chars (~1300 tokens)
 * - Sorted newest first
 */
export function buildActivityContext(accountId: number): string {
  const activities = getActivitiesByAccount(accountId);

  if (activities.length === 0) {
    return '';
  }

  // Filter to last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoffISO = twelveMonthsAgo.toISOString().substring(0, 10);

  const recentActivities = activities.filter(a => {
    if (!a.created_date) return true; // Include undated activities
    return a.created_date >= cutoffISO;
  });

  if (recentActivities.length === 0) {
    return '';
  }

  const sections: string[] = [];
  sections.push('RECENT ACCOUNT ACTIVITIES (emails/calls):');
  sections.push('');

  let totalLength = 0;
  const MAX_CHARS = 4000;

  for (const activity of recentActivities) {
    if (totalLength > MAX_CHARS) {
      sections.push(`[... ${recentActivities.length - sections.length + 2} more activities truncated]`);
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
