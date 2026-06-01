# 🎚️ Tempo — BPM Playlist Builder

Pick a **BPM**, choose **genres** and **singers/artists**, and Tempo finds tracks at that
tempo and assembles a playlist you can save straight into your Spotify account.

## How it works

Spotify deprecated its `audio-features` (tempo) and `recommendations` endpoints for apps
created after Nov 2024 — so this app can't read BPM from Spotify directly. Instead:

1. **Spotify Web API** builds a candidate pool from your chosen genres / artists.
2. **[ReccoBeats](https://reccobeats.com)** (a free, no-key drop-in replacement for Spotify's
   audio-features) returns the **tempo** for each candidate by Spotify track ID.
3. Tracks are filtered to your **target BPM ± tolerance** (optionally allowing half/double-time
   matches), ranked by closeness then popularity.
4. **Connect Spotify** (OAuth) and the playlist is created in your account in one click. You can
   also export a CSV or copy the track links.

## Features

- 🎚️ Big BPM dial (40–220) with quick presets + tolerance control
- 🏷️ Multi-select genre chips and artist/singer autocomplete
- ⚡ Optional energy filter and half/double-time tempo matching
- 🎧 30-second previews, album art, per-track BPM badges, total duration
- 💚 One-click "Save to Spotify", plus CSV download and copy-links export

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your Spotify credentials
npm run dev                  # must run on http://localhost:3000
```

Open **http://localhost:3000**.

### Environment (`.env.local`)

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://localhost:3000
```

> **Port matters.** The OAuth redirect URI must *exactly* match one registered in your
> [Spotify dashboard](https://developer.spotify.com/dashboard). This project is configured for
> `http://localhost:3000`, so the dev server must run on port 3000 for the "Save to Spotify"
> step to work. (Building/previewing playlists works on any port; only the OAuth save needs 3000.)

## Tech

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Spotify Web API · ReccoBeats
