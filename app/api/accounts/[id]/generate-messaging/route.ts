import { NextResponse } from 'next/server';
import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { getAccount, getAccountNotes, getAccountOverview } from '@/lib/db';
import { buildOverviewRecordFromStorage } from '@/lib/account-overview';
import { buildEnhancedAgentContext } from '@/lib/enhanced-agent-context';

setTracingDisabled(true);

const SYSTEM_INSTRUCTIONS = `You are an expert SDR messaging strategist crafting core outreach messaging for an account.

Your job: create a reusable messaging framework that an SDR can reference for all outreach to this account — emails, calls, LinkedIn messages.

The messaging should include:

1. **Primary value proposition** — one sentence connecting the account's top business priority to the value we deliver. No product jargon.
2. **Pain points to reference** — 3-4 specific friction points or challenges the account faces, with evidence from the research. These should be things the prospect will recognise and nod along to.
3. **Recommended angles** — 2-3 distinct messaging angles the SDR can rotate through, each tied to a different signal or priority. For each angle: the hook (1 sentence), the friction (1 sentence), and the question to ask (1 sentence).
4. **Language to use** — specific phrases, terms, or framings that will resonate based on the account's industry and situation.
5. **Language to avoid** — what NOT to say. Competitor mentions to avoid, jargon that won't land, assumptions not supported by research.

Rules:
- Base everything on the supplied research only. Do not invent facts.
- Be specific to this account — no generic messaging that could apply to anyone.
- Keep it under 500 words.
- Use markdown formatting with headers and bullet points.
- Write in a direct, professional tone.`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (Number.isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const account = getAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.research_status !== 'completed') {
      return NextResponse.json({ error: 'Account research not completed yet' }, { status: 400 });
    }

    const notes = getAccountNotes(accountId);
    const overviewRow = getAccountOverview(accountId);
    const overview = buildOverviewRecordFromStorage(overviewRow);

    const agentNotes = notes.map(n => ({ content: n.content, createdAt: n.created_at }));
    const context = buildEnhancedAgentContext(account, overview, agentNotes, 'auth0');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
    setDefaultOpenAIClient(openai);

    const agent = new Agent({
      name: 'Messaging Generator',
      model: process.env.OPENAI_AGENT_MODEL || 'gpt-5.2',
      instructions: SYSTEM_INSTRUCTIONS,
      tools: [],
    });

    const prompt = `Generate core outreach messaging for this account.\n\n${context}`;
    const result = await run(agent, prompt);

    return NextResponse.json({ content: result.finalOutput || '' });
  } catch (error) {
    console.error('Failed to generate messaging:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
