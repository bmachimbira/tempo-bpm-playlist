import { NextRequest, NextResponse } from 'next/server';
import { getAppToken, searchTracks } from '@/lib/spotify';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ tracks: [] });
  try {
    const token = await getAppToken();
    const tracks = await searchTracks(q, token, 8);
    return NextResponse.json({
      tracks: tracks.map((t) => ({
        id: t.id,
        name: t.name,
        artistNames: t.artistNames,
        artistId: t.artists[0]?.id ?? null,
        artistName: t.artists[0]?.name ?? '',
        albumArt: t.albumArt,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'search failed' },
      { status: 500 },
    );
  }
}
