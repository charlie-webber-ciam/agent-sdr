import { NextResponse } from 'next/server';
import { Agent, run, webSearchTool, fileSearchTool, setOpenAIAPI } from '@openai/agents';
import { setDefaultOpenAIClient } from '@openai/agents';
import OpenAI from 'openai';

// Configure OpenAI client with custom base URL for agents SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);
// Set the OpenAI client for the agents SDK


export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Create agent with tools [1][5]
    const agent = new Agent({
      model: 'gpt-5.2',
      name: 'Travel assistant',
      instructions: 'You are a helpful travel assistant.',
      tools: [
        webSearchTool(), // Built-in web search [1][13]
        // fileSearchTool('VS_ID'), // Uncomment and add your Vector Store ID [1]
      ],
    });

    // Run the agent [5]
    const result = await run(agent, message);

    return NextResponse.json({
      response: result.finalOutput,
    });

  } catch (error) {
    console.error('Agent error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}