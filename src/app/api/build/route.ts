import { NextRequest, NextResponse } from 'next/server';
import { buildPlaylist } from '@/lib/builder';
import { BuildPlaylistRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<BuildPlaylistRequest>;
    const bpm = Number(body.bpm);
    if (!bpm || bpm < 40 || bpm > 240) {
      return NextResponse.json({ error: 'BPM must be between 40 and 240.' }, { status: 400 });
    }
    const request: BuildPlaylistRequest = {
      bpm,
      tolerance: Number(body.tolerance ?? 5),
      genres: Array.isArray(body.genres) ? body.genres : [],
      artistIds: Array.isArray(body.artistIds) ? body.artistIds : [],
      artistNames: Array.isArray(body.artistNames) ? body.artistNames : [],
      excludeArtistIds: Array.isArray(body.excludeArtistIds) ? body.excludeArtistIds : [],
      excludeArtistNames: Array.isArray(body.excludeArtistNames) ? body.excludeArtistNames : [],
      allowHalfDouble: Boolean(body.allowHalfDouble),
      minEnergy: body.minEnergy != null ? Number(body.minEnergy) : undefined,
      maxEnergy: body.maxEnergy != null ? Number(body.maxEnergy) : undefined,
      limit: Math.min(Number(body.limit ?? 30), 100),
    };
    const result = await buildPlaylist(request);
    return NextResponse.json(result);
  } catch (err) {
    console.error('build error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build playlist' },
      { status: 500 },
    );
  }
}
