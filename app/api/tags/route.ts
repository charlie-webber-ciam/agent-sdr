import { NextResponse } from 'next/server';
import { getAllUniqueTags, PRESET_TAGS } from '@/lib/db';

export async function GET() {
  try {
    const customTags = getAllUniqueTags();
    return NextResponse.json({
      presetTags: [...PRESET_TAGS],
      customTags,
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}
