import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Spotify's API no longer returns preview_url for new apps, but the public
// embed page (open.spotify.com/embed/track/<id>) still contains the real
// preview URL in its inlined JSON. We scrape that first (exact match by track
// id — the technique behind the `spotify-preview-finder` package), then fall
// back to iTunes / Deezer by title+artist.
const cache = new Map<string, string | null>();

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(feat\.?[^)]*\)|\[[^\]]*\]/g, '')
    .replace(/ - .*$/, '')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fromSpotifyEmbed(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TempoBot/1.0)' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Unescape common JSON encodings, then find the p.scdn.co preview URL.
    const unescaped = html.replace(/\\u002F/g, '/').replace(/\\\//g, '/');
    const m =
      unescaped.match(/audioPreview"\s*:\s*\{\s*"url"\s*:\s*"(https[^"]+)"/) ||
      unescaped.match(/(https:\/\/p\.scdn\.co\/mp3-preview\/[A-Za-z0-9?=._-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function fromItunes(title: string, artist: string): Promise<string | null> {
  const term = encodeURIComponent(`${title} ${artist}`);
  const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=5`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results: { previewUrl?: string; trackName: string; artistName: string }[];
  };
  const nt = norm(title);
  const na = norm(artist);
  const scored = data.results
    .filter((r) => r.previewUrl)
    .sort((a, b) => {
      const am = (norm(a.trackName).includes(nt) ? 2 : 0) + (norm(a.artistName).includes(na) ? 1 : 0);
      const bm = (norm(b.trackName).includes(nt) ? 2 : 0) + (norm(b.artistName).includes(na) ? 1 : 0);
      return bm - am;
    });
  return scored[0]?.previewUrl ?? null;
}

async function fromDeezer(title: string, artist: string): Promise<string | null> {
  const q = encodeURIComponent(`${title} ${artist}`);
  const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { preview?: string }[] };
  const hit = (data.data ?? []).find((r) => r.preview);
  return hit?.preview ?? null;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim();
  const title = req.nextUrl.searchParams.get('title')?.trim();
  const artist = req.nextUrl.searchParams.get('artist')?.trim() ?? '';

  const key = id || `${title}::${artist}`.toLowerCase();
  if (!key) return NextResponse.json({ url: null });
  if (cache.has(key)) return NextResponse.json({ url: cache.get(key) });

  let url: string | null = null;
  try {
    if (id) url = await fromSpotifyEmbed(id);
    if (!url && title) url = await fromItunes(title, artist);
    if (!url && title) url = await fromDeezer(title, artist);
  } catch {
    url = null;
  }
  cache.set(key, url);
  return NextResponse.json({ url, source: url?.includes('p.scdn.co') ? 'spotify' : url ? 'fallback' : null });
}
