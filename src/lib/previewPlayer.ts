'use client';

import { useEffect, useState } from 'react';

export type PlayStatus = 'idle' | 'loading' | 'playing' | 'paused';
interface PlayerState {
  id: string | null;
  status: PlayStatus;
}

// Single shared <audio> so only one preview ever plays at a time.
let audio: HTMLAudioElement | null = null;
let state: PlayerState = { id: null, status: 'idle' };
let token = 0; // guards against races when switching tracks mid-load
const listeners = new Set<(s: PlayerState) => void>();
const urlCache = new Map<string, string | null>(); // trackId -> resolved preview url

function emit() {
  for (const l of listeners) l(state);
}

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.addEventListener('ended', () => {
      state = { id: null, status: 'idle' };
      emit();
    });
    audio.addEventListener('error', () => {
      state = { id: null, status: 'idle' };
      emit();
    });
  }
  return audio;
}

/** Toggle play/pause for a track. `resolve` lazily returns its preview URL. */
export async function toggle(
  id: string,
  resolve: () => Promise<string | null>,
): Promise<{ ok: boolean }> {
  const a = ensureAudio();

  if (state.id === id && state.status === 'playing') {
    a.pause();
    state = { id, status: 'paused' };
    emit();
    return { ok: true };
  }
  if (state.id === id && state.status === 'paused') {
    await a.play().catch(() => {});
    state = { id, status: 'playing' };
    emit();
    return { ok: true };
  }

  const my = ++token;
  state = { id, status: 'loading' };
  emit();

  let url = urlCache.get(id);
  if (url === undefined) {
    url = await resolve();
    urlCache.set(id, url);
  }
  if (my !== token) return { ok: false }; // superseded by a newer click

  if (!url) {
    state = { id: null, status: 'idle' };
    emit();
    return { ok: false };
  }

  a.src = url;
  try {
    await a.play();
    state = { id, status: 'playing' };
    emit();
    return { ok: true };
  } catch {
    state = { id: null, status: 'idle' };
    emit();
    return { ok: false };
  }
}

export function stop() {
  if (audio) audio.pause();
  state = { id: null, status: 'idle' };
  token++;
  emit();
}

/** React hook: returns this track's current play status. */
export function usePreviewState(id: string): PlayStatus {
  const [s, setS] = useState<PlayerState>(state);
  useEffect(() => {
    const l = (next: PlayerState) => setS(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s.id === id ? s.status : 'idle';
}
