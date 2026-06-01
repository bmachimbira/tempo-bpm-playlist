import { NextRequest, NextResponse } from 'next/server';
import { getAppToken, searchArtists } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ artists: [] });
  try {
    const token = await getAppToken();
    const artists = await searchArtists(q, token);
    return NextResponse.json({ artists });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'search failed' },
      { status: 500 },
    );
  }
}
