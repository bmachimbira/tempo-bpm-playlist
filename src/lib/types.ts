// Shared types for the BPM Playlist Builder

export interface SpotifyArtistRef {
  id: string;
  name: string;
}

export interface SpotifyArtist extends SpotifyArtistRef {
  images?: { url: string; width: number; height: number }[];
  genres?: string[];
  popularity?: number;
}

/** A track candidate sourced from Spotify, optionally enriched with audio features. */
export interface Track {
  id: string;
  name: string;
  artists: SpotifyArtistRef[];
  artistNames: string;
  album: string;
  albumArt: string | null;
  durationMs: number;
  popularity: number;
  previewUrl: string | null;
  uri: string;
  spotifyUrl: string;
  // Enriched (from ReccoBeats / audio-features provider)
  bpm?: number | null;
  energy?: number | null;
  danceability?: number | null;
  valence?: number | null;
  // Whether the match came via half/double-time tempo equivalence
  tempoMatchKind?: 'exact' | 'half' | 'double';
}

export interface AudioFeatures {
  spotifyId: string;
  tempo: number | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
}

export interface BuildPlaylistRequest {
  bpm: number;
  tolerance: number;
  genres: string[];
  artistIds: string[];
  artistNames: string[];
  excludeArtistIds: string[];
  excludeArtistNames: string[];
  allowHalfDouble: boolean;
  minEnergy?: number;
  maxEnergy?: number;
  limit: number;
}

export interface BuildPlaylistResponse {
  tracks: Track[];
  stats: {
    candidatePool: number;
    enriched: number;
    matched: number;
    target: number;
    tolerance: number;
  };
}
