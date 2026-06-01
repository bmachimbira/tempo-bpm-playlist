import { SpotifyArtist, Track } from './types';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
export const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000';

export const SPOTIFY_SCOPES = [
  'playlist-modify-public',
  'playlist-modify-private',
];

// ---------------------------------------------------------------------------
// App-level token (Client Credentials) — used for search/lookup, cached.
// ---------------------------------------------------------------------------
let appToken: { value: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string> {
  if (appToken && appToken.expiresAt > Date.now() + 5000) return appToken.value;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Spotify token error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  appToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return appToken.value;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Spotify GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------
interface RawTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  popularity?: number;
  preview_url: string | null;
  external_urls: { spotify: string };
  artists: { id: string; name: string }[];
  album: { name: string; images: { url: string }[] };
}

function mapTrack(t: RawTrack): Track {
  return {
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
    artistNames: t.artists.map((a) => a.name).join(', '),
    album: t.album?.name ?? '',
    albumArt: t.album?.images?.[0]?.url ?? null,
    durationMs: t.duration_ms,
    popularity: t.popularity ?? 0,
    previewUrl: t.preview_url,
    uri: t.uri,
    spotifyUrl: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
  };
}

// ---------------------------------------------------------------------------
// Search / discovery
// ---------------------------------------------------------------------------
export async function searchArtists(query: string, token: string): Promise<SpotifyArtist[]> {
  const data = await apiGet<{ artists: { items: SpotifyArtist[] } }>(
    `/search?type=artist&limit=8&q=${encodeURIComponent(query)}`,
    token,
  );
  return data.artists.items.map((a) => ({
    id: a.id,
    name: a.name,
    images: a.images,
    genres: a.genres,
    popularity: a.popularity,
  }));
}

export async function searchTracks(query: string, token: string, limit = 50): Promise<Track[]> {
  const out: Track[] = [];
  let offset = 0;
  while (out.length < limit && offset < 200) {
    const pageSize = Math.min(50, limit - out.length);
    const data = await apiGet<{ tracks: { items: RawTrack[] } }>(
      `/search?type=track&limit=${pageSize}&offset=${offset}&q=${encodeURIComponent(query)}`,
      token,
    );
    const items = data.tracks?.items ?? [];
    if (items.length === 0) break;
    out.push(...items.map(mapTrack));
    offset += pageSize;
  }
  return out;
}

/** Pull an artist's catalog tracks via their albums (richer than search alone). */
export async function getArtistCatalogTracks(
  artistId: string,
  token: string,
  maxAlbums = 12,
): Promise<Track[]> {
  const albums = await apiGet<{ items: { id: string }[] }>(
    `/artists/${artistId}/albums?include_groups=album,single&limit=${maxAlbums}&market=US`,
    token,
  );
  const albumIds = albums.items.map((a) => a.id).slice(0, maxAlbums);
  const tracks: Track[] = [];
  // batch albums up to 20 at a time
  for (let i = 0; i < albumIds.length; i += 20) {
    const chunk = albumIds.slice(i, i + 20);
    const data = await apiGet<{ albums: { tracks: { items: RawTrack[] }; name: string; images: { url: string }[] }[] }>(
      `/albums?ids=${chunk.join(',')}&market=US`,
      token,
    );
    for (const album of data.albums ?? []) {
      for (const t of album.tracks.items) {
        tracks.push(
          mapTrack({
            ...t,
            popularity: 0,
            album: { name: album.name, images: album.images },
          } as RawTrack),
        );
      }
    }
  }
  return tracks;
}

export async function getArtist(artistId: string, token: string): Promise<SpotifyArtist> {
  return apiGet<SpotifyArtist>(`/artists/${artistId}`, token);
}

export async function getArtistTopTracks(artistId: string, token: string): Promise<Track[]> {
  const data = await apiGet<{ tracks: RawTrack[] }>(
    `/artists/${artistId}/top-tracks?market=US`,
    token,
  );
  return data.tracks.map(mapTrack);
}

// ---------------------------------------------------------------------------
// User OAuth (Authorization Code flow)
// ---------------------------------------------------------------------------
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getCurrentUser(userToken: string): Promise<{ id: string; display_name: string }> {
  return apiGet(`/me`, userToken);
}

export async function createPlaylist(
  userToken: string,
  userId: string,
  name: string,
  description: string,
  isPublic: boolean,
): Promise<{ id: string; external_urls: { spotify: string } }> {
  const res = await fetch(`${API}/users/${userId}/playlists`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, public: isPublic }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Create playlist failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function addTracksToPlaylist(
  userToken: string,
  playlistId: string,
  uris: string[],
): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    const res = await fetch(`${API}/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: chunk }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Add tracks failed: ${res.status} ${await res.text()}`);
  }
}
