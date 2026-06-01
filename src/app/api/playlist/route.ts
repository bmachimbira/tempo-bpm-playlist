import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUser,
  createPlaylist,
  addTracksToPlaylist,
  refreshAccessToken,
} from '@/lib/spotify';

export const dynamic = 'force-dynamic';

async function validUserToken(req: NextRequest): Promise<{ token: string; refreshed?: { value: string; maxAge: number } } | null> {
  const access = req.cookies.get('sp_access')?.value;
  if (access) return { token: access };
  const refresh = req.cookies.get('sp_refresh')?.value;
  if (!refresh) return null;
  const r = await refreshAccessToken(refresh);
  return { token: r.access_token, refreshed: { value: r.access_token, maxAge: r.expires_in } };
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, uris, isPublic } = await req.json();
    if (!Array.isArray(uris) || uris.length === 0) {
      return NextResponse.json({ error: 'No tracks to add.' }, { status: 400 });
    }
    const auth = await validUserToken(req);
    if (!auth) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const user = await getCurrentUser(auth.token);
    const playlist = await createPlaylist(
      auth.token,
      user.id,
      name || `BPM Playlist`,
      description || 'Built with the BPM Playlist Builder',
      Boolean(isPublic),
    );
    await addTracksToPlaylist(auth.token, playlist.id, uris);

    const res = NextResponse.json({
      ok: true,
      url: playlist.external_urls.spotify,
      id: playlist.id,
    });
    if (auth.refreshed) {
      res.cookies.set('sp_access', auth.refreshed.value, {
        httpOnly: true, sameSite: 'lax', path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: auth.refreshed.maxAge,
      });
    }
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create playlist' },
      { status: 500 },
    );
  }
}
