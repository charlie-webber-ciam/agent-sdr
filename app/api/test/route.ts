import { NextRequest, NextResponse } from 'next/server';
import { testCompany } from '@/lib/agent-tester';

export type TestErrorType =
  | 'auth_error'
  | 'network_error'
  | 'dns_error'
  | 'timeout'
  | 'rate_limit'
  | 'quota_exceeded'
  | 'model_not_found'
  | 'server_error'
  | 'unknown';

interface ClassifiedError {
  type: TestErrorType;
  userMessage: string;
  fix: string;
  technicalDetail: string;
}

function classifyError(error: unknown): ClassifiedError {
  const raw = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? '') : '';
  const combined = `${raw} ${stack}`.toLowerCase();

  if (/401|unauthorized|invalid.?api.?key|authentication.?fail|incorrect.?api/i.test(combined)) {
    return {
      type: 'auth_error',
      userMessage: 'API key authentication failed',
      fix: 'Your OPENAI_API_KEY is invalid or expired.\n\n1. Open .env.local\n2. Update OPENAI_API_KEY with a valid key\n3. Restart the dev server (Ctrl+C, then npm run dev)',
      technicalDetail: raw,
    };
  }

  if (/403|forbidden|permission/i.test(combined)) {
    return {
      type: 'auth_error',
      userMessage: 'Access forbidden — insufficient permissions',
      fix: 'Your API key does not have permission to use this endpoint or model.\nContact your API provider to verify your key has the required access.',
      technicalDetail: raw,
    };
  }

  if (/429|rate.?limit|too.?many.?request/i.test(combined)) {
    return {
      type: 'rate_limit',
      userMessage: 'Rate limit reached',
      fix: 'You have hit the API rate limit.\n\n1. Wait 1-2 minutes before trying again\n2. If this happens repeatedly, check your API quota with the provider\n3. Consider reducing PROCESSING_CONCURRENCY in .env.local',
      technicalDetail: raw,
    };
  }

  if (/quota|billing|insufficient.?quota|exceeded.?budget/i.test(combined)) {
    return {
      type: 'quota_exceeded',
      userMessage: 'API quota or billing limit exceeded',
      fix: 'Your account has run out of API credits or hit a spending limit.\n\n1. Log in to your API provider dashboard\n2. Check your usage and billing settings\n3. Add credits or raise your spending limit',
      technicalDetail: raw,
    };
  }

  if (/model.?not.?found|model_not_found|no such model|does not exist/i.test(combined)) {
    return {
      type: 'model_not_found',
      userMessage: 'Model not found or not available',
      fix: 'The model configured in the agent (gpt-5.2) is not available on your endpoint.\n\n1. Check which models your API key can access\n2. If using a custom OPENAI_BASE_URL, verify it supports gpt-5.2\n3. Contact your API provider if you believe this is incorrect',
      technicalDetail: raw,
    };
  }

  if (/enotfound|getaddrinfo|name.?not.?resol/i.test(combined)) {
    return {
      type: 'dns_error',
      userMessage: 'DNS lookup failed — hostname not found',
      fix: 'The LLM endpoint hostname cannot be resolved.\n\n1. Check OPENAI_BASE_URL in .env.local for typos\n2. Verify your internet connection\n3. If using the default OpenAI endpoint, remove OPENAI_BASE_URL from .env.local',
      technicalDetail: raw,
    };
  }

  if (/econnrefused|connection.?refused/i.test(combined)) {
    return {
      type: 'network_error',
      userMessage: 'Connection refused by server',
      fix: 'The LLM endpoint is refusing connections.\n\n1. Verify OPENAI_BASE_URL is correct\n2. Check if the service is online\n3. Check for firewall or VPN issues',
      technicalDetail: raw,
    };
  }

  if (/fetch.?fail|network.?err|econnreset|socket.?hang|etimedout|enotfound/i.test(combined)) {
    return {
      type: 'network_error',
      userMessage: 'Network error — could not reach the API',
      fix: 'The agent could not reach the LLM endpoint.\n\n1. Check your internet connection\n2. Verify OPENAI_BASE_URL in .env.local is correct\n3. Check if a VPN or proxy is interfering',
      technicalDetail: raw,
    };
  }

  if (/timeout|timed.?out|aborted|abort/i.test(combined)) {
    return {
      type: 'timeout',
      userMessage: 'Request timed out',
      fix: 'The API request took too long to respond.\n\n1. Check your internet connection speed\n2. The LLM service may be under heavy load — try again in a moment\n3. If this happens consistently, check OPENAI_BASE_URL is pointing to the right endpoint',
      technicalDetail: raw,
    };
  }

  if (/500|502|503|504|internal.?server|bad.?gateway|service.?unavailable/i.test(combined)) {
    return {
      type: 'server_error',
      userMessage: 'LLM service returned a server error',
      fix: 'The API endpoint is experiencing issues on their end.\n\n1. Wait a few minutes and try again\n2. Check the API provider status page\n3. If the issue persists, contact your API provider',
      technicalDetail: raw,
    };
  }

  return {
    type: 'unknown',
    userMessage: 'An unexpected error occurred',
    fix: 'An unrecognised error was returned.\n\n1. Check the technical details below for clues\n2. Verify all settings in .env.local are correct\n3. Restart the dev server and try again',
    technicalDetail: raw,
  };
}

export async function POST(request: NextRequest) {
  const startMs = Date.now();

  let companyName: string;
  try {
    const body = await request.json();
    companyName = body?.companyName;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  }

  companyName = companyName.trim();

  try {
    const result = await testCompany(companyName);
    return NextResponse.json({
      success: true,
      companyName,
      result,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    console.error('Test API error:', error);
    const classified = classifyError(error);
    return NextResponse.json(
      {
        success: false,
        error: classified.userMessage,
        errorType: classified.type,
        fix: classified.fix,
        technicalDetail: classified.technicalDetail,
        durationMs: Date.now() - startMs,
      },
      { status: 500 }
    );
  }
}
