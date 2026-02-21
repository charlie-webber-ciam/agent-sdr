import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fix?: string;
  details?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheck[];
}

export async function GET() {
  const checks: HealthCheck[] = [];

  // 1. OPENAI_API_KEY presence
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    checks.push({
      name: 'API Key',
      status: 'fail',
      message: 'OPENAI_API_KEY is not set',
      fix: 'Open .env.local and add: OPENAI_API_KEY=your-key-here\nThen restart the dev server (Ctrl+C, then npm run dev).',
    });
  } else if (apiKey.length < 10) {
    checks.push({
      name: 'API Key',
      status: 'fail',
      message: 'OPENAI_API_KEY is too short to be valid',
      fix: 'Keys are typically 40+ characters. Check for copy-paste truncation in .env.local.',
      details: `Key length: ${apiKey.length} characters`,
    });
  } else {
    checks.push({
      name: 'API Key',
      status: 'pass',
      message: 'Configured',
    });
  }

  // 2. OPENAI_BASE_URL format check
  const baseUrl = process.env.OPENAI_BASE_URL;
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        checks.push({
          name: 'API Base URL',
          status: 'fail',
          message: `Invalid protocol: ${parsed.protocol}`,
          fix: 'OPENAI_BASE_URL must start with https:// (or http:// for local dev).',
          details: baseUrl,
        });
      } else {
        checks.push({
          name: 'API Base URL',
          status: 'pass',
          message: `Custom endpoint: ${baseUrl}`,
        });
      }
    } catch {
      checks.push({
        name: 'API Base URL',
        status: 'fail',
        message: 'OPENAI_BASE_URL is not a valid URL',
        fix: 'Set OPENAI_BASE_URL to a full URL, e.g. https://llm.example.com/v1 — or remove it to use the default OpenAI endpoint.',
        details: `Value: ${baseUrl}`,
      });
    }
  } else {
    checks.push({
      name: 'API Base URL',
      status: 'pass',
      message: 'Not set — using default OpenAI endpoint (api.openai.com)',
    });
  }

  // 3. Live endpoint connectivity + auth test
  const effectiveBaseUrl = baseUrl || 'https://api.openai.com/v1';
  if (apiKey && apiKey.length >= 10) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${effectiveBaseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'pass',
          message: `Reachable and authenticated (HTTP ${res.status})`,
        });
      } else if (res.status === 401) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'fail',
          message: 'API key rejected — authentication failed (HTTP 401)',
          fix: 'Your OPENAI_API_KEY is invalid or expired.\n1. Get a new key from your API provider\n2. Update OPENAI_API_KEY in .env.local\n3. Restart the dev server',
          details: `${effectiveBaseUrl}/models → 401 Unauthorized`,
        });
      } else if (res.status === 403) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'fail',
          message: 'Access forbidden (HTTP 403)',
          fix: 'Your API key does not have permission to access this endpoint. Contact your API provider to verify key permissions.',
          details: `${effectiveBaseUrl}/models → 403 Forbidden`,
        });
      } else if (res.status === 404) {
        // Gateway doesn't implement /models — reachability still confirmed
        checks.push({
          name: 'Endpoint connectivity',
          status: 'pass',
          message: `Endpoint reachable — /models not supported on this gateway (HTTP 404, expected)`,
        });
      } else if (res.status === 429) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'warn',
          message: 'Endpoint reachable but rate limited (HTTP 429)',
          fix: 'You are currently rate limited. Wait a minute before running the agent test. If this persists, check your usage quota with the API provider.',
          details: `${effectiveBaseUrl}/models → 429 Too Many Requests`,
        });
      } else if (res.status >= 500) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'warn',
          message: `Endpoint returned a server error (HTTP ${res.status})`,
          fix: 'The LLM service may be experiencing issues. Check the API provider status page and try again shortly.',
          details: `${effectiveBaseUrl}/models → ${res.status}`,
        });
      } else {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'warn',
          message: `Unexpected response (HTTP ${res.status})`,
          details: `${effectiveBaseUrl}/models → ${res.status}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = err instanceof Error && err.name === 'AbortError';

      if (isTimeout) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'fail',
          message: 'Connection timed out after 8 seconds',
          fix: `The LLM endpoint is not responding.\n1. Check OPENAI_BASE_URL is correct: ${effectiveBaseUrl}\n2. Verify your internet connection\n3. Check if the service is online`,
          details: `Timeout connecting to ${effectiveBaseUrl}`,
        });
      } else if (/ENOTFOUND|getaddrinfo/i.test(msg)) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'fail',
          message: 'DNS lookup failed — hostname not found',
          fix: `The hostname in OPENAI_BASE_URL cannot be resolved.\n1. Check for typos in OPENAI_BASE_URL\n2. Verify your internet connection\n3. If using the default OpenAI endpoint, remove OPENAI_BASE_URL from .env.local`,
          details: `${effectiveBaseUrl}: ${msg}`,
        });
      } else if (/ECONNREFUSED/i.test(msg)) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'fail',
          message: 'Connection refused',
          fix: 'The LLM endpoint actively refused the connection. The service may be down, or the port may be wrong in OPENAI_BASE_URL.',
          details: `${effectiveBaseUrl}: ${msg}`,
        });
      } else if (/ECONNRESET/i.test(msg)) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'fail',
          message: 'Connection reset by server',
          fix: 'The server closed the connection unexpectedly. The service may be temporarily unavailable — try again in a moment.',
          details: `${effectiveBaseUrl}: ${msg}`,
        });
      } else if (/certificate|SSL|TLS/i.test(msg)) {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'fail',
          message: 'TLS/SSL certificate error',
          fix: 'There is a TLS certificate problem with the endpoint. If using a custom base URL, ensure it has a valid HTTPS certificate.',
          details: `${effectiveBaseUrl}: ${msg}`,
        });
      } else {
        checks.push({
          name: 'Endpoint connectivity',
          status: 'fail',
          message: `Network error: ${msg.slice(0, 120)}`,
          fix: 'Check OPENAI_BASE_URL is correct and your internet connection is working.',
          details: msg,
        });
      }
    }
  } else {
    checks.push({
      name: 'Endpoint connectivity',
      status: 'fail',
      message: 'Skipped — API key must be set first',
      fix: 'Set a valid OPENAI_API_KEY in .env.local before the connectivity check can run.',
    });
  }

  // 4. Schema files
  const schemaPath = join(process.cwd(), 'lib', 'schema.sql');
  const employeeSchemaPath = join(process.cwd(), 'lib', 'employee-count-schema.sql');
  if (!existsSync(schemaPath)) {
    checks.push({
      name: 'Schema files',
      status: 'fail',
      message: 'lib/schema.sql not found',
      fix: 'The project may be incomplete. Re-clone the repository or check that lib/schema.sql exists.',
    });
  } else if (!existsSync(employeeSchemaPath)) {
    checks.push({
      name: 'Schema files',
      status: 'fail',
      message: 'lib/employee-count-schema.sql not found',
      fix: 'The employee count schema is missing. Re-clone the repository or check that lib/employee-count-schema.sql exists.',
    });
  } else {
    checks.push({
      name: 'Schema files',
      status: 'pass',
      message: 'All schema files present',
    });
  }

  // 5. Database connectivity
  try {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    checks.push({
      name: 'Database',
      status: 'pass',
      message: `Connected — ${result.count} account${result.count === 1 ? '' : 's'} in database`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    checks.push({
      name: 'Database',
      status: 'fail',
      message: 'Cannot connect to SQLite database',
      fix: 'Run npm install to ensure better-sqlite3 is installed.\nIf the error persists, delete data/accounts.db and restart — the database will be recreated automatically.',
      details: msg,
    });
  }

  // 6. Data directory writable
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    checks.push({
      name: 'Data directory',
      status: 'warn',
      message: 'data/ does not exist yet',
      fix: 'This is normal on a fresh install. The directory will be created automatically when the database is first accessed.',
    });
  } else {
    checks.push({
      name: 'Data directory',
      status: 'pass',
      message: 'data/ directory exists',
    });
  }

  // 7. Key npm dependencies
  const requiredPackages = [
    { name: '@openai/agents', fix: 'Run: npm install @openai/agents' },
    { name: 'better-sqlite3', fix: 'Run: npm install better-sqlite3' },
    { name: 'csv-parse', fix: 'Run: npm install csv-parse' },
    { name: 'p-limit', fix: 'Run: npm install p-limit' },
    { name: 'zod', fix: 'Run: npm install zod' },
  ];
  const missing: string[] = [];
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg.name);
    } catch {
      missing.push(pkg.name);
    }
  }
  if (missing.length > 0) {
    checks.push({
      name: 'Dependencies',
      status: 'fail',
      message: `Missing: ${missing.join(', ')}`,
      fix: `Run the following in the project directory:\n  npm install\n\nIf that fails, try:\n  rm -rf node_modules && npm install`,
      details: `Missing packages: ${missing.join(', ')}`,
    });
  } else {
    checks.push({
      name: 'Dependencies',
      status: 'pass',
      message: `All ${requiredPackages.length} required packages installed`,
    });
  }

  // 8. Processing mode config
  const { PROCESSING_CONFIG } = await import('@/lib/config');
  checks.push({
    name: 'Processing mode',
    status: 'pass',
    message: PROCESSING_CONFIG.enableParallel
      ? `Parallel — ${PROCESSING_CONFIG.concurrency} concurrent accounts`
      : 'Sequential — 1 account at a time (set ENABLE_PARALLEL_PROCESSING=true to enable parallel)',
  });

  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');
  const overall: HealthResponse['status'] = hasFail ? 'unhealthy' : hasWarn ? 'degraded' : 'healthy';

  return NextResponse.json(
    { status: overall, timestamp: new Date().toISOString(), checks } satisfies HealthResponse,
    { status: hasFail ? 500 : 200 }
  );
}
