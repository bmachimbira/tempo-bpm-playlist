// Curated genre list used both for the UI chips and Spotify `genre:` search filters.
export const GENRES: string[] = [
  'pop', 'dance', 'edm', 'house', 'techno', 'deep-house', 'drum-and-bass',
  'hip-hop', 'rap', 'trap', 'r-n-b', 'soul', 'funk', 'disco',
  'rock', 'indie', 'alt-rock', 'punk', 'metal', 'grunge',
  'electronic', 'synth-pop', 'ambient', 'lo-fi',
  'afrobeat', 'amapiano', 'reggaeton', 'latin', 'salsa',
  'jazz', 'blues', 'classical', 'country', 'folk',
  'k-pop', 'j-pop', 'reggae', 'dancehall', 'gospel',
];

// Spotify artist genres are free-form (e.g. "dance pop", "uk hip hop").
// Map them onto our known chip list by substring/word overlap.
export function mapToKnownGenres(rawGenres: string[]): string[] {
  const matched = new Set<string>();
  for (const raw of rawGenres) {
    const g = raw.toLowerCase();
    for (const known of GENRES) {
      const k = known.replace(/-/g, ' ');
      // match "pop" in "dance pop", "hip hop" in "uk hip hop", "r n b" via "r&b"
      if (g.includes(k) || (k === 'r-n-b' && /r&b|rnb|r n b/.test(g))) {
        matched.add(known);
      }
    }
  }
  return Array.from(matched);
}
