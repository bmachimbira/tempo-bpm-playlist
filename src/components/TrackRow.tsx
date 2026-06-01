'use client';

import { Track } from '@/lib/types';
import { toggle, usePreviewState } from '@/lib/previewPlayer';

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function resolvePreview(track: Track): Promise<string | null> {
  if (track.previewUrl) return track.previewUrl;
  try {
    const res = await fetch(
      `/api/preview?id=${encodeURIComponent(track.id)}&title=${encodeURIComponent(
        track.name,
      )}&artist=${encodeURIComponent(track.artists[0]?.name ?? '')}`,
    );
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

export default function TrackRow({ track, index }: { track: Track; index: number }) {
  const status = usePreviewState(track.id);
  const playing = status === 'playing';
  const loading = status === 'loading';

  return (
    <div
      className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 rounded-xl hover:bg-[var(--hover)] transition fade-up"
      style={{ animationDelay: `${Math.min(index * 25, 500)}ms` }}
    >
      <span className="w-5 text-right text-xs text-[var(--muted)] tabular-nums hidden sm:block">
        {index + 1}
      </span>

      {/* Literal, always-visible play / pause button */}
      <button
        onClick={() => toggle(track.id, () => resolvePreview(track))}
        className={`grid place-items-center w-9 h-9 rounded-full shrink-0 transition border ${
          playing
            ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-amber)]'
            : 'bg-[var(--hover)] border-[var(--line-strong)] text-[var(--text)] hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-[var(--on-amber)]'
        }`}
        title={playing ? 'Pause preview' : 'Play 30s preview'}
        aria-label={playing ? 'Pause preview' : 'Play preview'}
      >
        {loading ? (
          <span className="spin inline-block w-4 h-4 border-2 border-current/40 border-t-current rounded-full" />
        ) : playing ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.5 2.6v10.8a.5.5 0 0 0 .76.43l8.5-5.4a.5.5 0 0 0 0-.86l-8.5-5.4a.5.5 0 0 0-.76.42z" />
          </svg>
        )}
      </button>

      {track.albumArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.albumArt} alt="" className="w-11 h-11 rounded-md object-cover shadow shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-md bg-[var(--chip)] shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <a
          href={track.spotifyUrl}
          target="_blank"
          rel="noreferrer"
          className={`block truncate font-medium hover:underline ${
            playing ? 'text-[var(--accent)]' : ''
          }`}
        >
          {track.name}
        </a>
        <div className="truncate text-sm text-[var(--muted)] flex items-center gap-2">
          {playing && (
            <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
              <span
                className="w-[3px] bg-[var(--accent)] rounded-sm animate-[eq_0.7s_ease-in-out_infinite]"
                style={{ height: '40%' }}
              />
              <span
                className="w-[3px] bg-[var(--accent)] rounded-sm animate-[eq_0.7s_ease-in-out_infinite] [animation-delay:0.15s]"
                style={{ height: '90%' }}
              />
              <span
                className="w-[3px] bg-[var(--accent)] rounded-sm animate-[eq_0.7s_ease-in-out_infinite] [animation-delay:0.3s]"
                style={{ height: '60%' }}
              />
            </span>
          )}
          <span className="truncate">{track.artistNames}</span>
        </div>
      </div>

      <span
        className="inline-flex items-baseline gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums"
        style={{
          background: 'color-mix(in oklch, var(--amber) 12%, transparent)',
          color: 'var(--amber)',
          border: '1px solid color-mix(in oklch, var(--amber) 28%, transparent)',
        }}
        title={
          track.tempoMatchKind && track.tempoMatchKind !== 'exact'
            ? `${track.tempoMatchKind}-time match`
            : 'BPM'
        }
      >
        {track.bpm}
        <span className="text-[10px] font-normal opacity-70">BPM</span>
        {track.tempoMatchKind && track.tempoMatchKind !== 'exact' && (
          <span className="text-[10px] opacity-70">·½×</span>
        )}
      </span>

      <span className="w-10 text-right text-xs text-[var(--muted)] tabular-nums hidden sm:block">
        {fmt(track.durationMs)}
      </span>
    </div>
  );
}
