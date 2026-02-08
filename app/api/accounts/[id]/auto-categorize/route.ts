import { NextResponse } from 'next/server';
import { getAccount, updateAccountMetadata } from '@/lib/db';
import { analyzeAccountData } from '@/lib/categorizer';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accountId = parseInt(id);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    const account = getAccount(accountId);

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (account.research_status !== 'completed') {
      return NextResponse.json(
        { error: 'Account research not completed yet' },
        { status: 400 }
      );
    }

    // Analyze the account data
    const suggestions = await analyzeAccountData(account);

    // Store the suggestions in the database
    updateAccountMetadata(accountId, {
      ai_suggestions: JSON.stringify(suggestions),
    });

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Error auto-categorizing account:', error);
    return NextResponse.json(
      { error: 'Failed to analyze account' },
      { status: 500 }
    );
  }
}
