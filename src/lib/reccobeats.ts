import { AudioFeatures } from './types';

// ReccoBeats provides audio features (incl. tempo/BPM) keyed by Spotify track ID.
// It replaces Spotify's deprecated /audio-features endpoint (blocked for apps
// created after Nov 2024). Free, no auth. Accepts up to 40 ids per request.
const RECCO_URL = 'https://api.reccobeats.com/v1/audio-features';
const BATCH = 40;

// Process-lifetime cache so repeated queries don't re-fetch the same tracks.
const cache = new Map<string, AudioFeatures>();

interface ReccoFeature {
  href: string; // https://open.spotify.com/track/<id>
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
}

function spotifyIdFromHref(href: string): string | null {
  const m = href?.match(/track\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

async function fetchBatch(ids: string[]): Promise<void> {
  const url = `${RECCO_URL}?ids=${ids.join(',')}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  } catch {
    return; // network hiccup — leave these uncached (treated as "no data")
  }
  if (!res.ok) return;
  const json = (await res.json()) as { content: ReccoFeature[] };
  for (const f of json.content ?? []) {
    const id = spotifyIdFromHref(f.href);
    if (!id) continue;
    cache.set(id, {
      spotifyId: id,
      tempo: typeof f.tempo === 'number' ? f.tempo : null,
      energy: typeof f.energy === 'number' ? f.energy : null,
      danceability: typeof f.danceability === 'number' ? f.danceability : null,
      valence: typeof f.valence === 'number' ? f.valence : null,
    });
  }
}

/**
 * Returns audio features for the given Spotify track IDs.
 * Tracks with no data in ReccoBeats simply won't appear in the map.
 */
export async function getAudioFeatures(spotifyIds: string[]): Promise<Map<string, AudioFeatures>> {
  const unique = Array.from(new Set(spotifyIds));
  const missing = unique.filter((id) => !cache.has(id));

  // Fetch missing in batches, a few batches in parallel for speed.
  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH));

  const CONCURRENCY = 4;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    await Promise.all(batches.slice(i, i + CONCURRENCY).map(fetchBatch));
  }

  const result = new Map<string, AudioFeatures>();
  for (const id of unique) {
    const f = cache.get(id);
    if (f) result.set(id, f);
  }
  return result;
}
