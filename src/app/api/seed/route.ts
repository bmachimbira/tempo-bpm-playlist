import { NextRequest, NextResponse } from 'next/server';
import { getAppToken, getArtist } from '@/lib/spotify';
import { getAudioFeatures } from '@/lib/reccobeats';
import { mapToKnownGenres } from '@/lib/genres';

export const dynamic = 'force-dynamic';

// Given a seed track, return everything needed to "match" it:
// its BPM (ReccoBeats) + primary artist + that artist's genres (mapped to chips).
export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get('trackId')?.trim();
  const artistId = req.nextUrl.searchParams.get('artistId')?.trim();
  if (!trackId) return NextResponse.json({ error: 'Missing trackId' }, { status: 400 });

  try {
    const token = await getAppToken();
    const [features, artist] = await Promise.all([
      getAudioFeatures([trackId]),
      artistId ? getArtist(artistId, token) : Promise.resolve(null),
    ]);

    const f = features.get(trackId);
    const bpm = f?.tempo != null ? Math.round(f.tempo) : null;
    const rawGenres = artist?.genres ?? [];
    const genres = mapToKnownGenres(rawGenres);

    return NextResponse.json({
      bpm,
      energy: f?.energy ?? null,
      artistId: artistId ?? null,
      artistName: artist?.name ?? null,
      artistGenres: rawGenres,
      genres,
      hasBpm: bpm != null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'seed analysis failed' },
      { status: 500 },
    );
  }
}
