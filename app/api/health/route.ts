import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // Check database connectivity
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };

    // Check environment variables
    const hasApiKey = !!process.env.OPENAI_API_KEY;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        accountCount: result.count,
        apiKeyConfigured: hasApiKey,
        version: '0.1.0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
