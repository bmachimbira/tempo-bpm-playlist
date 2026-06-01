import {
  getAppToken,
  searchTracks,
  getArtistCatalogTracks,
  getArtistTopTracks,
} from './spotify';
import { getAudioFeatures } from './reccobeats';
import { BuildPlaylistRequest, BuildPlaylistResponse, Track } from './types';

/** How a candidate track's tempo relates to the target, allowing half/double time. */
function classifyTempo(
  tempo: number,
  target: number,
  tolerance: number,
  allowHalfDouble: boolean,
): Track['tempoMatchKind'] | null {
  if (Math.abs(tempo - target) <= tolerance) return 'exact';
  if (allowHalfDouble) {
    if (Math.abs(tempo * 2 - target) <= tolerance) return 'double'; // track is half-time of target
    if (Math.abs(tempo / 2 - target) <= tolerance) return 'half'; // track is double-time of target
  }
  return null;
}

// Keywords that mark a track as an alternate version of a song we likely already
// have (live cuts, radio edits, remasters, remixes, etc.). Used to demote them.
const VARIANT_RE =
  /\b(live|remix|acoustic|remaster(?:ed)?|radio\s*edit|extended|mono|stereo|single\s*version|instrumental|demo|re-?recorded|sped\s*up|slowed|karaoke|reprise|edit|version|mix|session)\b/i;

/** Strip feat./with credits, parentheticals, and " - <qualifier>" suffixes to a base title. */
function baseTitle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[([][^)\]]*[)\]]/g, ' ') // (feat. …), [Remix], (Live) …
    .replace(/\s-\s.*$/, ' ') // " - Radio Edit", " - 2011 Remaster"
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Higher = preferred version to keep within a duplicate group. */
function versionScore(t: Track): number {
  let s = t.popularity ?? 0;
  if (VARIANT_RE.test(t.name)) s -= 60; // strongly demote live/remix/remaster/edit
  if (/[([]/.test(t.name)) s -= 5; // mild nudge away from parenthetical variants
  return s;
}

/**
 * Collapse duplicates: same Spotify id, and same base title + primary artist
 * (so "Levitating", "Levitating (feat. DaBaby)" and "Levitating - Live" become
 * one entry — the highest-scoring canonical version).
 */
function dedupe(tracks: Track[]): Track[] {
  const byId = new Map<string, Track>();
  for (const t of tracks) if (!byId.has(t.id)) byId.set(t.id, t);

  const groups = new Map<string, Track>();
  for (const t of Array.from(byId.values())) {
    const key = `${baseTitle(t.name)}::${(t.artists[0]?.name ?? '').toLowerCase().trim()}`;
    const cur = groups.get(key);
    if (!cur || versionScore(t) > versionScore(cur)) groups.set(key, t);
  }
  return Array.from(groups.values());
}

export async function buildPlaylist(req: BuildPlaylistRequest): Promise<BuildPlaylistResponse> {
  const token = await getAppToken();
  const target = req.bpm;
  const tolerance = Math.max(1, req.tolerance);

  // ---- 1. Assemble a candidate pool from Spotify ----------------------------
  const pool: Track[] = [];

  // Per-artist catalogs (richest source when the user names "singers").
  for (const artistId of req.artistIds.slice(0, 5)) {
    try {
      const [top, catalog] = await Promise.all([
        getArtistTopTracks(artistId, token),
        getArtistCatalogTracks(artistId, token),
      ]);
      pool.push(...top, ...catalog);
    } catch {
      /* ignore a single artist failure */
    }
  }

  // Genre searches. Combine with artist name when both are given for tighter results.
  const genreQueries: string[] = [];
  if (req.genres.length && req.artistNames.length) {
    for (const g of req.genres.slice(0, 4))
      for (const a of req.artistNames.slice(0, 3))
        genreQueries.push(`genre:"${g}" artist:"${a}"`);
  } else {
    for (const g of req.genres.slice(0, 6)) genreQueries.push(`genre:"${g}"`);
  }
  // If only artists named (no genre, no catalog hit) fall back to name search.
  if (!req.genres.length && !req.artistIds.length && req.artistNames.length) {
    for (const a of req.artistNames.slice(0, 5)) genreQueries.push(`artist:"${a}"`);
  }
  // Nothing specified at all → broad popular search so the app still does something.
  if (genreQueries.length === 0 && pool.length === 0) genreQueries.push('year:2015-2025');

  const searchResults = await Promise.all(
    genreQueries.map((q) => searchTracks(q, token, 50).catch(() => [] as Track[])),
  );
  for (const r of searchResults) pool.push(...r);

  let candidates = dedupe(pool);

  // ---- 1b. Exclude unwanted artists ----------------------------------------
  if (req.excludeArtistIds.length || req.excludeArtistNames.length) {
    const exIds = new Set(req.excludeArtistIds);
    const exNames = new Set(req.excludeArtistNames.map((n) => n.toLowerCase().trim()));
    candidates = candidates.filter(
      (t) =>
        !t.artists.some(
          (a) => exIds.has(a.id) || exNames.has(a.name.toLowerCase().trim()),
        ),
    );
  }

  // ---- 2. Enrich with BPM / audio features ---------------------------------
  const features = await getAudioFeatures(candidates.map((t) => t.id));

  let enriched = 0;
  const matched: Track[] = [];
  for (const t of candidates) {
    const f = features.get(t.id);
    if (!f || f.tempo == null) continue;
    enriched++;
    t.bpm = Math.round(f.tempo);
    t.energy = f.energy;
    t.danceability = f.danceability;
    t.valence = f.valence;

    // Optional energy gate.
    if (req.minEnergy != null && f.energy != null && f.energy < req.minEnergy) continue;
    if (req.maxEnergy != null && f.energy != null && f.energy > req.maxEnergy) continue;

    const kind = classifyTempo(f.tempo, target, tolerance, req.allowHalfDouble);
    if (!kind) continue;
    t.tempoMatchKind = kind;
    matched.push(t);
  }

  // ---- 3. Rank: closeness to target BPM, then popularity -------------------
  matched.sort((a, b) => {
    const da = Math.abs((a.bpm ?? 0) - target);
    const db = Math.abs((b.bpm ?? 0) - target);
    // exact matches rank above half/double
    const ka = a.tempoMatchKind === 'exact' ? 0 : 1;
    const kb = b.tempoMatchKind === 'exact' ? 0 : 1;
    if (ka !== kb) return ka - kb;
    if (da !== db) return da - db;
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });

  const tracks = matched.slice(0, req.limit);

  return {
    tracks,
    stats: {
      candidatePool: candidates.length,
      enriched,
      matched: matched.length,
      target,
      tolerance,
    },
  };
}
