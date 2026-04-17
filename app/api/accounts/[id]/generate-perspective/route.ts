import { NextResponse } from 'next/server';
import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';
import { getAccount, getAccountNotes, getAccountOverview } from '@/lib/db';
import { buildOverviewRecordFromStorage } from '@/lib/account-overview';
import { buildEnhancedAgentContext } from '@/lib/enhanced-agent-context';

setTracingDisabled(true);

const SYSTEM_INSTRUCTIONS = `You are an expert SDR strategist writing a working perspective for an account.

Your job: synthesize the account research into a concise, actionable perspective that an SDR can use to guide their outreach strategy.

The perspective should include:
1. **Strategic angle** — what is the strongest entry point for this account? What business priority or pain point is most relevant?
2. **Key signals** — what concrete evidence from the research supports this angle? (funding, tech changes, leadership moves, security incidents, growth signals)
3. **Outreach approach** — how should the SDR approach this account? Who to target first, what messaging angle to lead with, what to avoid.
4. **Risks & objections** — what might block the deal or slow it down? Incumbent vendor, budget constraints, timing issues.

Rules:
- Base everything on the supplied research only. Do not invent facts.
- Be specific and actionable, not generic.
- Keep it under 500 words.
- Use markdown formatting with headers and bullet points for scannability.
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
      name: 'Perspective Generator',
      model: process.env.OPENAI_AGENT_MODEL || 'gpt-5.2',
      instructions: SYSTEM_INSTRUCTIONS,
      tools: [],
    });

    const prompt = `Generate an SDR working perspective for this account.\n\n${context}`;
    const result = await run(agent, prompt);

    return NextResponse.json({ content: result.finalOutput || '' });
  } catch (error) {
    console.error('Failed to generate perspective:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
