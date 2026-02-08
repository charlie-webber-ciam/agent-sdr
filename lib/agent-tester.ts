import { Agent, run, webSearchTool, setDefaultOpenAIClient } from '@openai/agents';
import OpenAI from 'openai';

// Configure OpenAI client with custom base URL for agents SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Set the OpenAI client for the agents SDK
setDefaultOpenAIClient(openai);

export interface TestResult {
  headline_summary: string;
}

export async function testCompany(companyName: string): Promise<TestResult> {
  const agent = new Agent({
    model: 'gpt-5.2',
    name: 'Auth0 SDR Tester',
    instructions: `You are a quick research assistant for Auth0 SDR team. Your role is to provide a brief headline summary about a company from an Auth0 CIAM perspective.

**Research Focus:**
- What the company does
- Their approximate scale/size
- Why they might be a good Auth0 CIAM prospect

**Response Format:**
- Keep it to 2-3 sentences maximum
- Be concise and actionable
- Focus on CIAM relevance`,
    tools: [webSearchTool()],
    disableTelemetry: true,
  });

  try {
    const prompt = `Research ${companyName} and provide a brief 2-3 sentence headline summary covering:
1. What the company does
2. Their approximate scale/customer base
3. Why they might be a good Auth0 CIAM prospect

Keep it concise and focused on CIAM relevance.`;

    const result = await run(agent, prompt);

    return {
      headline_summary: result.finalOutput || 'No information found',
    };
  } catch (error) {
    console.error(`Test research error for ${companyName}:`, error);
    throw error;
  }
}
