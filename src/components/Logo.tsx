'use client';

/**
 * Tempo's mark: a wind-up metronome. The pendulum arm swings; the beat dot
 * pulses. Doubles as the brand identity (see src/app/icon.svg for the favicon).
 */
export default function Logo({ size = 44, swing = true }: { size?: number; swing?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="Tempo"
      role="img"
      className="select-none"
    >
      {/* base shadow / plinth */}
      <rect x="9" y="40" width="30" height="3.4" rx="1.7" fill="var(--amber-dim)" opacity="0.45" />

      {/* metronome body — trapezoid, narrow top / wide base */}
      <path
        d="M20 7 H28 L37 40 H11 Z"
        fill="url(#tempoBody)"
        stroke="var(--amber)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* inner scale window */}
      <path d="M23 12 H25 L30 37 H18 Z" fill="var(--bg)" opacity="0.55" />
      {/* scale ticks */}
      <g stroke="var(--amber)" strokeWidth="0.9" opacity="0.5" strokeLinecap="round">
        <line x1="21.6" y1="19" x2="26.4" y2="19" />
        <line x1="21.0" y1="25" x2="27.0" y2="25" />
        <line x1="20.4" y1="31" x2="27.6" y2="31" />
      </g>

      {/* swinging pendulum: pivots at the base (24,37) */}
      <g
        style={{
          transformOrigin: '24px 37px',
          animation: swing ? 'tempo-swing 1.6s cubic-bezier(0.45,0,0.55,1) infinite' : undefined,
        }}
      >
        <line x1="24" y1="37" x2="24" y2="10" stroke="var(--amber)" strokeWidth="1.8" strokeLinecap="round" />
        {/* sliding weight */}
        <rect x="20.5" y="16" width="7" height="4.4" rx="1.1" fill="var(--amber)" />
        {/* beat bob at the tip */}
        <circle cx="24" cy="10" r="2.4" fill="var(--text)" />
      </g>

      <defs>
        <linearGradient id="tempoBody" x1="11" y1="7" x2="37" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--surface)" />
          <stop offset="1" stopColor="var(--bg)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
