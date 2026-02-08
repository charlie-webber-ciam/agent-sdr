import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  console.log('=== API Route Called ===');
  
  try {
    const body = await request.json();
    const { message } = body;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const response = await client.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    });

    console.log('OpenAI response:', JSON.stringify(response, null, 2));

    // Make sure we're returning JSON
    return NextResponse.json({
      choices: response.choices,
      id: response.id,
      model: response.model,
      created: response.created,
    });

  } catch (error) {
    console.error('Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}