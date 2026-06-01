# Tempo — Design

## Theme
Warm dark. Scene: a producer-runner at a desk at dusk, choosing a tempo on a device
that glows like analog studio gear. The dark is warm (tinted amber/brown), never the
cold blue-black of generic tools.

## Color (OKLCH)
Color strategy: **Committed** — one warm accent carries the identity; Spotify green is
reserved for Spotify actions only.

- `--bg`        oklch(0.17 0.018 65)   — warm near-black charcoal
- `--surface`   oklch(0.21 0.018 65)   — raised panel
- `--line`      oklch(1 0 0 / 0.09)    — hairline borders
- `--text`      oklch(0.96 0.012 80)   — warm off-white
- `--muted`     oklch(0.70 0.02 75)    — secondary text
- `--amber`     oklch(0.82 0.14 78)    — Tempo identity accent (BPM, active, pulse)
- `--amber-dim` oklch(0.62 0.12 70)    — amber pressed/edges
- `--spotify`   oklch(0.74 0.18 152)   — ONLY on Spotify connect/save actions

Tint every neutral toward the amber hue (~65–80). No pure #000/#fff.

## Typography
- Display (BPM number): heavy weight, tight tracking, tabular figures. Big scale jump
  from everything else (≥3× body).
- Body: the Geist sans already wired. Labels in small caps / wide tracking for the
  "instrument panel" feel.
- Italian tempo marking: medium weight, letter-spaced, amber.

## Motion
- Logo metronome pendulum: slow rotation swing, ease-in-out, ~1.4s, transform only.
- Beat pulse: a dot/ring that scales on a tempo-derived cadence.
- Reveal: fade + small translate, ease-out-quint. No bounce.

## Components
- BPM dial: hero panel. Big number + live Italian tempo marking + range slider with
  amber thumb + tolerance. Tempo presets reference real use (Chill/Run etc).
- Track row: leading play button (amber on active), album art, title/artist, amber BPM
  badge, duration. Equalizer bars animate while playing.
- Spotify CTA: solid Spotify green, only place green appears.

## Logo
An SVG **metronome**: trapezoid body, a pendulum arm with a weight, a beat dot. The
pendulum swings subtly. Doubles as the favicon. This is the distinctive mark — no
generic note/slider/headphone icon.
