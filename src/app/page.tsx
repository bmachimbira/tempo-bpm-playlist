'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GENRES } from '@/lib/genres';
import { SpotifyArtist, BuildPlaylistResponse } from '@/lib/types';
import ArtistSearch from '@/components/ArtistSearch';
import SeedSongSearch, { SeedTrack } from '@/components/SeedSongSearch';
import TrackRow from '@/components/TrackRow';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { stop as stopPreview } from '@/lib/previewPlayer';

// Italian tempo marking for a BPM — a music-literate signature detail.
function tempoMarking(bpm: number): string {
  if (bpm <= 60) return 'Largo';
  if (bpm <= 76) return 'Adagio';
  if (bpm <= 108) return 'Andante';
  if (bpm <= 120) return 'Moderato';
  if (bpm <= 156) return 'Allegro';
  if (bpm <= 176) return 'Vivace';
  if (bpm <= 200) return 'Presto';
  return 'Prestissimo';
}

interface SeedInfo {
  name: string;
  artist: string;
  bpm: number;
  genres: string[];
  albumArt: string | null;
}

const RESULT_KEY = 'tempo_result';
const PENDING_EXPORT = 'tempo_pending_export';

export default function Home() {
  const [bpm, setBpm] = useState(120);
  const [tolerance, setTolerance] = useState(6);
  const [genres, setGenres] = useState<string[]>([]);
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [excludeArtists, setExcludeArtists] = useState<SpotifyArtist[]>([]);
  const [allowHalfDouble, setAllowHalfDouble] = useState(true);
  const [energyOn, setEnergyOn] = useState(false);
  const [energy, setEnergy] = useState<[number, number]>([0.4, 1]);
  const [limit, setLimit] = useState(30);

  const [seed, setSeed] = useState<SeedInfo | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [pendingBuild, setPendingBuild] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BuildPlaylistResponse | null>(null);

  const [auth, setAuth] = useState<{ loggedIn: boolean; user: string | null }>({
    loggedIn: false,
    user: null,
  });
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ---- OAuth callback + session restore -----------------------------------
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(RESULT_KEY);
      if (saved) setResult(JSON.parse(saved));
    } catch {}

    async function init() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      if (code) {
        try {
          const res = await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state }),
          });
          const data = await res.json();
          if (data.ok) setAuth({ loggedIn: true, user: data.user?.name ?? null });
          else setToast(data.error || 'Login failed');
        } catch {
          setToast('Login failed');
        }
        window.history.replaceState({}, '', '/');
      }
      try {
        const s = await fetch('/api/auth/status').then((r) => r.json());
        if (s.loggedIn) setAuth({ loggedIn: true, user: s.user });
      } catch {}
    }
    init();
  }, []);

  // ---- Export to Spotify --------------------------------------------------
  const exportToSpotify = useCallback(
    async (silent = false) => {
      if (!result || result.tracks.length === 0) return;
      setExporting(true);
      setExportUrl(null);
      setError(null);
      try {
        const name = `${bpm} BPM${genres.length ? ' · ' + genres.slice(0, 2).join(', ') : ''}${
          artists.length ? ' · ' + artists.map((a) => a.name).slice(0, 2).join(', ') : ''
        }`;
        const res = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: `Tracks around ${bpm} BPM (±${tolerance}). Built with Tempo.`,
            uris: result.tracks.map((t) => t.uri),
            isPublic: false,
          }),
        });
        if (res.status === 401) {
          sessionStorage.setItem(PENDING_EXPORT, '1');
          window.location.href = '/api/auth/login';
          return;
        }
        const data = await res.json();
        if (data.ok) {
          setExportUrl(data.url);
          setToast('Playlist created in your Spotify ✓');
        } else {
          setError(data.error || 'Export failed');
        }
      } catch {
        setError('Export failed');
      } finally {
        setExporting(false);
        if (!silent) sessionStorage.removeItem(PENDING_EXPORT);
      }
    },
    [result, bpm, genres, artists, tolerance],
  );

  useEffect(() => {
    if (auth.loggedIn && result && sessionStorage.getItem(PENDING_EXPORT) === '1') {
      sessionStorage.removeItem(PENDING_EXPORT);
      exportToSpotify(true);
    }
  }, [auth.loggedIn, result, exportToSpotify]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ---- Generate -----------------------------------------------------------
  async function generate() {
    stopPreview();
    setLoading(true);
    setError(null);
    setExportUrl(null);
    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bpm,
          tolerance,
          genres,
          artistIds: artists.map((a) => a.id),
          artistNames: artists.map((a) => a.name),
          excludeArtistIds: excludeArtists.map((a) => a.id),
          excludeArtistNames: excludeArtists.map((a) => a.name),
          allowHalfDouble,
          minEnergy: energyOn ? energy[0] : undefined,
          maxEnergy: energyOn ? energy[1] : undefined,
          limit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setResult(null);
      } else {
        setResult(data);
        sessionStorage.setItem(RESULT_KEY, JSON.stringify(data));
        setTimeout(
          () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          100,
        );
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  // ---- Seed song: read a song's BPM + artist + genre, then match ----------
  async function handlePickSeed(t: SeedTrack) {
    setSeedLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/seed?trackId=${encodeURIComponent(t.id)}&artistId=${encodeURIComponent(
          t.artistId ?? '',
        )}`,
      );
      const data = await res.json();
      if (data.error) {
        setToast(data.error);
        return;
      }
      if (data.bpm == null) {
        setToast(`No BPM data found for "${t.name}". Try another song.`);
        return;
      }
      setBpm(data.bpm);
      if (Array.isArray(data.genres) && data.genres.length) setGenres(data.genres);
      if (t.artistId) setArtists([{ id: t.artistId, name: t.artistName || data.artistName }]);
      setSeed({
        name: t.name,
        artist: t.artistName,
        bpm: data.bpm,
        genres: Array.isArray(data.genres) ? data.genres : [],
        albumArt: t.albumArt,
      });
      setPendingBuild(true); // auto-build once state settles
    } catch {
      setToast('Could not analyze that song.');
    } finally {
      setSeedLoading(false);
    }
  }

  // Fire the build after seed-derived state has committed.
  useEffect(() => {
    if (pendingBuild) {
      setPendingBuild(false);
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBuild]);

  function clearSeed() {
    setSeed(null);
  }

  function toggleGenre(g: string) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuth({ loggedIn: false, user: null });
    setExportUrl(null);
  }

  function downloadCsv() {
    if (!result) return;
    const rows = [
      ['#', 'Track', 'Artist', 'Album', 'BPM', 'Spotify URL'],
      ...result.tracks.map((t, i) => [
        String(i + 1),
        t.name,
        t.artistNames,
        t.album,
        String(t.bpm ?? ''),
        t.spotifyUrl,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tempo-${bpm}bpm.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLinks() {
    if (!result) return;
    await navigator.clipboard.writeText(result.tracks.map((t) => t.spotifyUrl).join('\n'));
    setToast('Track links copied to clipboard');
  }

  const totalMin = result
    ? Math.round(result.tracks.reduce((s, t) => s + t.durationMs, 0) / 60000)
    : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
      {/* Header */}
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <Logo size={46} />
          <div className="leading-none">
            <h1 className="text-[1.35rem] font-extrabold tracking-[-0.02em]">Tempo</h1>
            <p className="label-spec mt-1">BPM · Playlist Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          {auth.loggedIn ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-[var(--muted)] hidden sm:inline">
                {auth.user ? `Hi, ${auth.user}` : 'Connected'}
              </span>
              <button
                onClick={logout}
                className="text-[var(--muted)] hover:text-[var(--text)] transition"
              >
                Log out
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/login"
              className="inline-flex items-center gap-2 text-sm font-medium rounded-full px-4 py-2 transition"
              style={{
                color: 'var(--spotify)',
                border: '1px solid color-mix(in oklch, var(--spotify) 45%, transparent)',
                background: 'color-mix(in oklch, var(--spotify) 10%, transparent)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--spotify)' }} />
              Connect Spotify
            </a>
          )}
        </div>
      </header>

      {/* Hero / controls */}
      <section className="grid lg:grid-cols-[340px_1fr] gap-6">
        {/* BPM dial */}
        <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur p-6 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative grid place-items-center w-2.5 h-2.5">
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--amber)', animation: 'tempo-beat 1.2s ease-out infinite' }}
              />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--amber)' }} />
            </span>
            <p className="label-spec">Target tempo</p>
          </div>
          <div className="relative">
            <div
              className="text-[5.5rem] font-black tabular-nums leading-none select-none"
              style={{ color: 'var(--amber)', textShadow: '0 6px 30px oklch(0.82 0.135 80 / 0.25)' }}
            >
              {bpm}
            </div>
            <div className="label-spec mt-2">Beats per minute</div>
            <div
              className="mt-3 inline-block text-sm font-medium tracking-[0.14em]"
              style={{ color: 'var(--accent-2)' }}
              title="Italian tempo marking for this BPM"
            >
              {tempoMarking(bpm)}
            </div>
          </div>
          <input
            type="range"
            min={40}
            max={220}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full mt-4"
          />
          <div className="flex items-center justify-between w-full mt-2 text-xs text-[var(--muted)]">
            <span>40</span>
            <span>220</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mt-4 w-full">
            {([
              ['Chill', 70],
              ['Groove', 100],
              ['Dance', 124],
              ['Run', 170],
            ] as [string, number][]).map(([label, v]) => (
              <button
                key={label}
                onClick={() => setBpm(v)}
                className="rounded-lg border border-[var(--line)] py-1.5 text-xs hover:bg-[var(--hover)] transition"
              >
                {label}
                <span className="block text-[10px] text-[var(--muted)]">{v}</span>
              </button>
            ))}
          </div>

          <div className="w-full mt-5">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--muted)]">Tolerance</span>
              <span className="tabular-nums">±{tolerance} BPM</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] backdrop-blur p-6 space-y-6">
          {/* Seed song */}
          <div>
            <label className="text-sm font-medium block mb-1">
              Match a song{' '}
              <span className="text-[var(--muted)] font-normal">
                : copies its BPM, artist &amp; genre, then builds
              </span>
            </label>
            <SeedSongSearch onPick={handlePickSeed} loading={seedLoading} />
            {seed && (
              <div
                className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2 fade-up"
                style={{
                  border: '1px solid color-mix(in oklch, var(--accent-2) 35%, transparent)',
                  background: 'color-mix(in oklch, var(--accent-2) 12%, transparent)',
                }}
              >
                {seed.albumArt ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seed.albumArt} alt="" className="w-9 h-9 rounded object-cover" />
                ) : (
                  <span className="w-9 h-9 rounded bg-[var(--chip)]" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="truncate">
                    Matching <span className="font-semibold">{seed.name}</span> · {seed.artist}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {seed.bpm} BPM{seed.genres.length ? ' · ' + seed.genres.join(', ') : ''}
                  </div>
                </div>
                <button
                  onClick={clearSeed}
                  className="text-[var(--muted)] hover:text-[var(--text)] transition text-sm"
                  aria-label="Clear seed song"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-[var(--chip)]" />

          <div>
            <label className="text-sm font-medium block mb-3">Genres</label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
              {GENRES.map((g) => {
                const on = genres.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`rounded-full px-3 py-1.5 text-sm capitalize border transition ${
                      on
                        ? 'bg-[var(--accent)] text-[var(--on-amber)] border-transparent font-medium'
                        : 'border-[var(--line)] text-[var(--text)] hover:bg-[var(--hover)]'
                    }`}
                  >
                    {g.replace(/-/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-3">
                Include singers / artists
              </label>
              <ArtistSearch
                selected={artists}
                onAdd={(a) =>
                  setArtists((p) => (p.find((x) => x.id === a.id) ? p : [...p, a]))
                }
                onRemove={(id) => setArtists((p) => p.filter((x) => x.id !== id))}
                placeholder="Search artists to include…"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-3">
                Exclude artists{' '}
                <span className="text-[var(--muted)] font-normal">(never include)</span>
              </label>
              <ArtistSearch
                selected={excludeArtists}
                onAdd={(a) =>
                  setExcludeArtists((p) => (p.find((x) => x.id === a.id) ? p : [...p, a]))
                }
                onRemove={(id) => setExcludeArtists((p) => p.filter((x) => x.id !== id))}
                tone="exclude"
                placeholder="Search artists to exclude…"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Playlist size</span>
                <span className="tabular-nums text-[var(--muted)]">{limit} tracks</span>
              </div>
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2 justify-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowHalfDouble}
                  onChange={(e) => setAllowHalfDouble(e.target.checked)}
                  className="accent-[var(--accent)] w-4 h-4"
                />
                Include half / double-time matches
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={energyOn}
                  onChange={(e) => setEnergyOn(e.target.checked)}
                  className="accent-[var(--accent)] w-4 h-4"
                />
                Filter by energy
              </label>
            </div>
          </div>

          {energyOn && (
            <div className="fade-up">
              <div className="flex justify-between text-xs mb-1 text-[var(--muted)]">
                <span>Min energy: {energy[0].toFixed(2)}</span>
                <span>Max: {energy[1].toFixed(2)}</span>
              </div>
              <div className="flex gap-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={energy[0]}
                  onChange={(e) =>
                    setEnergy([Math.min(Number(e.target.value), energy[1]), energy[1]])
                  }
                  className="w-full"
                />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={energy[1]}
                  onChange={(e) =>
                    setEnergy([energy[0], Math.max(Number(e.target.value), energy[0])])
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className="w-full rounded-2xl py-4 font-bold tracking-[0.01em] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'var(--amber)',
              color: 'var(--bg)',
              boxShadow: '0 10px 34px oklch(0.82 0.135 80 / 0.28)',
            }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="spin inline-block w-4 h-4 border-2 border-[var(--on-amber)] border-t-transparent rounded-full" />
                Finding tracks…
              </span>
            ) : (
              'Build playlist'
            )}
          </button>
        </div>
      </section>

      {error && (
        <div
          className="mt-6 rounded-xl px-4 py-3 text-sm fade-up"
          style={{
            border: '1px solid color-mix(in oklch, var(--accent-3) 45%, transparent)',
            background: 'color-mix(in oklch, var(--accent-3) 12%, transparent)',
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <section ref={resultsRef} className="mt-10 fade-up">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Your {bpm} BPM playlist</h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                {result.tracks.length} tracks · ~{totalMin} min · matched from{' '}
                {result.stats.enriched} analyzed of {result.stats.candidatePool} candidates
              </p>
              <p className="text-xs text-[var(--muted)] mt-1 opacity-80">
                ▶ Hit play on any track to preview a 30s snippet
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyLinks}
                className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm hover:bg-[var(--hover)] transition"
              >
                Copy links
              </button>
              <button
                onClick={downloadCsv}
                className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm hover:bg-[var(--hover)] transition"
              >
                Download CSV
              </button>
              <button
                onClick={() => exportToSpotify()}
                disabled={exporting || result.tracks.length === 0}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold hover:brightness-105 transition disabled:opacity-60"
                style={{ background: 'var(--spotify)', color: 'var(--spotify-ink)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.6 14.4a.62.62 0 01-.86.21c-2.35-1.44-5.3-1.76-8.8-.96a.62.62 0 11-.28-1.22c3.83-.87 7.1-.5 9.73 1.11a.62.62 0 01.21.86zm1.23-2.73a.78.78 0 01-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 11-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33a.78.78 0 01.25 1.07zm.11-2.85C14.41 8.96 8.9 8.76 5.7 9.73a.93.93 0 11-.54-1.78c3.68-1.12 9.76-.9 13.6 1.39a.93.93 0 01-.96 1.6z" />
                </svg>
                {exporting
                  ? 'Saving…'
                  : auth.loggedIn
                  ? 'Save to Spotify'
                  : 'Connect & save'}
              </button>
            </div>
          </div>

          {exportUrl && (
            <a
              href={exportUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 mb-4 rounded-xl px-4 py-3 text-sm transition fade-up"
              style={{
                border: '1px solid color-mix(in oklch, var(--spotify) 45%, transparent)',
                background: 'color-mix(in oklch, var(--spotify) 12%, transparent)',
              }}
            >
              <span style={{ color: 'var(--spotify)' }}>✓</span> Playlist created. Open it in Spotify ↗
            </a>
          )}

          {result.tracks.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 text-center text-[var(--muted)]">
              No tracks matched. Try widening the tolerance, enabling half/double-time, or picking
              broader genres/artists.
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] backdrop-blur divide-y divide-[var(--divide)] overflow-hidden">
              {result.tracks.map((t, i) => (
                <TrackRow key={t.id} track={t} index={i} />
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="mt-16 text-center text-xs text-[var(--muted)]">
        BPM data via ReccoBeats · Previews via Spotify embed (iTunes / Deezer fallback) · Catalog &amp; playlists via Spotify
      </footer>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full text-sm font-medium px-5 py-2.5 shadow-2xl fade-up z-50"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
