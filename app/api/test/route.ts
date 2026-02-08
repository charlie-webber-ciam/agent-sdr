import { NextRequest, NextResponse } from 'next/server';
import { testCompany } from '@/lib/agent-tester';

export async function POST(request: NextRequest) {
  try {
    const { companyName } = await request.json();

    if (!companyName || typeof companyName !== 'string') {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    const result = await testCompany(companyName.trim());

    return NextResponse.json({
      success: true,
      companyName,
      result,
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to research company',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
