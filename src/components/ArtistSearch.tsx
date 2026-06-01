'use client';

import { useEffect, useRef, useState } from 'react';
import { SpotifyArtist } from '@/lib/types';

interface Props {
  selected: SpotifyArtist[];
  onAdd: (a: SpotifyArtist) => void;
  onRemove: (id: string) => void;
  tone?: 'include' | 'exclude';
  placeholder?: string;
}

export default function ArtistSearch({
  selected,
  onAdd,
  onRemove,
  tone = 'include',
  placeholder = 'Search singers / artists…',
}: Props) {
  const exclude = tone === 'exclude';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyArtist[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/artists?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.artists ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
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

  const selectedIds = new Set(selected.map((a) => a.id));

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.map((a) => (
          <span
            key={a.id}
            className={`inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm border ${
              exclude
                ? 'bg-[var(--accent-3)]/15 border-[var(--accent-3)]/40'
                : 'bg-white/10 border-white/10'
            }`}
          >
            {a.images?.[2]?.url || a.images?.[0]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.images?.[2]?.url || a.images?.[0]?.url}
                alt=""
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <span className="w-6 h-6 rounded-full bg-white/10 grid place-items-center text-xs">
                {a.name[0]}
              </span>
            )}
            {a.name}
            <button
              onClick={() => onRemove(a.id)}
              className="text-[var(--muted)] hover:text-white transition"
              aria-label={`Remove ${a.name}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        className={`w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm outline-none transition placeholder:text-[var(--muted)] ${
          exclude ? 'focus:border-[var(--accent-3)]/60' : 'focus:border-[var(--accent)]/60'
        }`}
      />

      {open && (results.length > 0 || loading) && (
        <div className="absolute z-20 mt-2 w-full rounded-xl bg-[#13111c] border border-white/10 shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {loading && <div className="px-4 py-3 text-sm text-[var(--muted)]">Searching…</div>}
          {results.map((a) => (
            <button
              key={a.id}
              disabled={selectedIds.has(a.id)}
              onClick={() => {
                onAdd(a);
                setQuery('');
                setResults([]);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition text-left disabled:opacity-40"
            >
              {a.images?.[2]?.url || a.images?.[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.images?.[2]?.url || a.images?.[0]?.url}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <span className="w-9 h-9 rounded-full bg-white/10 grid place-items-center">
                  {a.name[0]}
                </span>
              )}
              <span className="flex-1 text-sm">{a.name}</span>
              {a.genres?.[0] && (
                <span className="text-xs text-[var(--muted)] capitalize">{a.genres[0]}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
