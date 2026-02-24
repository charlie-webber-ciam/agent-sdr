import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import {
  getActivitiesByAccount,
  getAccount,
  updateActivitySummary,
  AccountActivity,
} from './db';

// Disable tracing — it tries to hit api.openai.com directly, which fails with a custom base URL
setTracingDisabled(true);

// Configure OpenAI client with custom base URL for agents SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Set the OpenAI client for the agents SDK
setDefaultOpenAIClient(openai);

const SYSTEM_INSTRUCTIONS = `You are an expert SDR analyst. You are given a complete log of CRM activities (emails, calls, meeting notes) for a single account. Your job is to produce a comprehensive engagement summary that another agent can use to write highly contextual outreach emails.

### OUTPUT FORMAT

Write a structured summary in plain text (not JSON, not markdown). Use the following sections:

ENGAGEMENT TIMELINE & STATUS
- When did outreach begin and what is the most recent activity?
- How many total touchpoints? What cadence/frequency?
- Is the account currently active, dormant, or cold?
- What was the last interaction and how did the prospect respond?

KEY CONTACTS & RELATIONSHIPS
- Who are the people involved on the prospect side? (names, roles if mentioned)
- Who from our team has been reaching out?
- What is the relationship status with each contact? (engaged, unresponsive, warm, etc.)
- Any internal champions or blockers identified?

CONVERSATION THEMES & TOPICS
- What products/solutions have been discussed?
- What pain points or challenges have the prospect mentioned?
- Any specific use cases, projects, or initiatives referenced?
- Technology stack or current solutions mentioned?

DEAL INTELLIGENCE
- Any buying signals (budget discussions, timeline mentions, stakeholder alignment)?
- Objections or concerns raised?
- Competitive mentions (other vendors being evaluated)?
- Pricing or commercial discussions?

MEETING & FOLLOW-UP HISTORY
- Any meetings scheduled, held, or cancelled?
- Key outcomes from meetings?
- Outstanding action items or commitments?

STRATEGIC CONTEXT
- Any company news, org changes, or events referenced in conversations?
- Seasonal patterns or timing factors?
- What approach/angle has worked vs. what hasn't?

RECOMMENDED APPROACH
- Based on the activity history, what tone and angle should the next outreach take?
- What specific topics or references would make the next email feel contextual?
- What should be avoided based on past interactions?

### RULES
- Be specific — use actual names, dates, and details from the activities
- If information for a section is not available, write "No data available" and move on
- Include direct quotes from emails when they reveal important context
- Focus on details that would help craft a highly personalised follow-up email
- Write 1-2 pages of content — be thorough, this summary replaces reading hundreds of emails`;

/**
 * Summarize all activities for an account using an AI agent.
 * The summary is stored on the account record for use by other agents.
 */
export async function summarizeAccountActivities(accountId: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const account = getAccount(accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  const activities = getActivitiesByAccount(accountId);
  if (activities.length === 0) {
    throw new Error(`No activities found for account ${accountId}`);
  }

  // Build the full activity log — no truncation, the agent needs everything
  const activityLog = buildFullActivityLog(activities, account.company_name);

  const agent = new Agent({
    name: 'Activity Summarizer',
    model: 'gpt-5-nano',
    instructions: SYSTEM_INSTRUCTIONS,
    tools: [],
  });

  const prompt = `Summarize the following CRM activity log for ${account.company_name} (${account.industry || 'Unknown industry'}).

There are ${activities.length} activities spanning from ${getDateRange(activities)}.

--- ACTIVITY LOG ---

${activityLog}

--- END ACTIVITY LOG ---

Produce the comprehensive engagement summary now.`;

  const response = await run(agent, prompt);

  const summary = response.finalOutput || '';
  if (!summary.trim()) {
    throw new Error('Agent returned empty summary');
  }

  // Store the summary on the account
  updateActivitySummary(accountId, summary);

  console.log(`✓ Activity summary generated for ${account.company_name} (${activities.length} activities → ${summary.length} chars)`);

  return summary;
}

/**
 * Build the complete activity log for the agent to process.
 * Activities are grouped chronologically (oldest first for narrative flow).
 * Each activity includes its full comments — no truncation.
 */
function buildFullActivityLog(activities: AccountActivity[], companyName: string): string {
  // Sort oldest first for chronological narrative
  const sorted = [...activities].sort((a, b) => {
    const dateA = a.created_date || '0000-00-00';
    const dateB = b.created_date || '0000-00-00';
    return dateA.localeCompare(dateB);
  });

  const lines: string[] = [];

  for (const activity of sorted) {
    const date = activity.created_date || 'Unknown date';
    lines.push(`=== [${date}] ${activity.subject} ===`);

    if (activity.comments && activity.comments.trim()) {
      lines.push(activity.comments.trim());
    } else {
      lines.push('[No body/comments]');
    }

    lines.push('');
  }

  return lines.join('\n');
}

function getDateRange(activities: AccountActivity[]): string {
  const dates = activities
    .map(a => a.created_date)
    .filter((d): d is string => !!d)
    .sort();

  if (dates.length === 0) return 'unknown dates';
  if (dates.length === 1) return dates[0];
  return `${dates[0]} to ${dates[dates.length - 1]}`;
}
