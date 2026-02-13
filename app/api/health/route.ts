import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
  }> = [];

  // 1. OPENAI_API_KEY
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    checks.push({
      name: 'OPENAI_API_KEY',
      status: 'fail',
      message: 'Not set. Add OPENAI_API_KEY to .env.local',
    });
  } else if (apiKey.length < 10) {
    checks.push({
      name: 'OPENAI_API_KEY',
      status: 'fail',
      message: 'Value looks too short to be a valid API key',
    });
  } else {
    checks.push({
      name: 'OPENAI_API_KEY',
      status: 'pass',
      message: `Configured (${apiKey.slice(0, 7)}...${apiKey.slice(-4)})`,
    });
  }

  // 2. OPENAI_BASE_URL (optional)
  const baseUrl = process.env.OPENAI_BASE_URL;
  if (baseUrl) {
    checks.push({
      name: 'OPENAI_BASE_URL',
      status: 'pass',
      message: `Custom endpoint: ${baseUrl}`,
    });
  } else {
    checks.push({
      name: 'OPENAI_BASE_URL',
      status: 'pass',
      message: 'Not set (using default OpenAI endpoint)',
    });
  }

  // 3. Database — schema files
  const schemaPath = join(process.cwd(), 'lib', 'schema.sql');
  const employeeSchemaPath = join(process.cwd(), 'lib', 'employee-count-schema.sql');
  if (!existsSync(schemaPath)) {
    checks.push({
      name: 'Schema files',
      status: 'fail',
      message: 'lib/schema.sql not found',
    });
  } else if (!existsSync(employeeSchemaPath)) {
    checks.push({
      name: 'Schema files',
      status: 'fail',
      message: 'lib/employee-count-schema.sql not found',
    });
  } else {
    checks.push({
      name: 'Schema files',
      status: 'pass',
      message: 'All schema files present',
    });
  }

  // 4. Database — connectivity
  try {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    checks.push({
      name: 'Database',
      status: 'pass',
      message: `Connected (${result.count} accounts)`,
    });
  } catch (error) {
    checks.push({
      name: 'Database',
      status: 'fail',
      message: `Cannot connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // 5. Data directory writable
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    checks.push({
      name: 'Data directory',
      status: 'warn',
      message: 'data/ directory does not exist yet (will be created on first DB access)',
    });
  } else {
    checks.push({
      name: 'Data directory',
      status: 'pass',
      message: 'data/ directory exists',
    });
  }

  // 6. Node modules — key dependencies
  const requiredPackages = [
    '@openai/agents',
    'better-sqlite3',
    'csv-parse',
    'p-limit',
    'zod',
  ];
  const missingPackages: string[] = [];
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch {
      missingPackages.push(pkg);
    }
  }
  if (missingPackages.length > 0) {
    checks.push({
      name: 'Dependencies',
      status: 'fail',
      message: `Missing packages: ${missingPackages.join(', ')}. Run npm install`,
    });
  } else {
    checks.push({
      name: 'Dependencies',
      status: 'pass',
      message: `All required packages installed (${requiredPackages.length} checked)`,
    });
  }

  // 7. Parallel processing config
  const parallelEnabled = process.env.ENABLE_PARALLEL_PROCESSING === 'true';
  const concurrency = process.env.PROCESSING_CONCURRENCY;
  checks.push({
    name: 'Processing mode',
    status: 'pass',
    message: parallelEnabled
      ? `Parallel (concurrency: ${concurrency || '5'})`
      : 'Sequential (set ENABLE_PARALLEL_PROCESSING=true for parallel)',
  });

  // Compute overall status
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');
  const overall = hasFail ? 'unhealthy' : hasWarn ? 'degraded' : 'healthy';

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: hasFail ? 500 : 200 }
  );
}
