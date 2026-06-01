'use client';

import { useEffect, useRef, useState } from 'react';

export interface SeedTrack {
  id: string;
  name: string;
  artistNames: string;
  artistId: string | null;
  artistName: string;
  albumArt: string | null;
}

interface Props {
  onPick: (t: SeedTrack) => void;
  loading?: boolean;
}

export default function SeedSongSearch({ onPick, loading }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SeedTrack[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/tracks?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.tracks ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent-2)]">🎵</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search a song to match its vibe…"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--input-bg)] border border-[var(--line)] pl-11 pr-4 py-3 text-sm outline-none focus:border-[var(--accent-2)] transition placeholder:text-[var(--muted)] disabled:opacity-60"
        />
        {(searching || loading) && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 spin inline-block w-4 h-4 border-2 border-[var(--muted)] border-t-transparent rounded-full" />
        )}
      </div>

      {open && (results.length > 0 || searching) && (
        <div className="absolute z-30 mt-2 w-full rounded-xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
          {searching && <div className="px-4 py-3 text-sm text-[var(--muted)]">Searching…</div>}
          {results.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onPick(t);
                setQuery('');
                setResults([]);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--hover)] transition text-left"
            >
              {t.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.albumArt} alt="" className="w-10 h-10 rounded object-cover" />
              ) : (
                <span className="w-10 h-10 rounded bg-[var(--chip)]" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{t.name}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{t.artistNames}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
