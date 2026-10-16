import React from 'react';

interface TrackPreviewProps {
  className?: string;
}

export const TrackPreview: React.FC<TrackPreviewProps> = () => {
  return (
    <div
      className="elevated-panel"
      style={{
        position: 'relative',
        width: '100%',
        padding: '24px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Circuit Meta Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-lime)',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
            }}
          >
            CIRCUIT // SECTOR APEX 01
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: 'var(--accent-lime)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-lime)',
            backgroundColor: 'var(--accent-lime-subtle)',
          }}
        >
          16 TURNS • 4.2 KM
        </span>
      </div>

      {/* SVG Architectural Track Diagram */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '240px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 540 260"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            {/* Red Gradient for Track Sweep */}
            <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF2A3A" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#FF2A3A" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#F4F5F0" stopOpacity="0.1" />
            </linearGradient>

            <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Grid Lines within track enclosure */}
          <line x1="80" y1="130" x2="460" y2="130" stroke="rgba(244, 245, 240, 0.04)" strokeDasharray="3 3" />
          <line x1="270" y1="30" x2="270" y2="230" stroke="rgba(244, 245, 240, 0.04)" strokeDasharray="3 3" />

          {/* Track Underglow Shadow */}
          <path
            d="M 120,200 C 70,200 60,140 90,90 C 130,30 240,40 320,70 C 400,100 470,60 480,120 C 490,180 430,220 370,180 C 310,140 260,200 190,200 Z"
            fill="none"
            stroke="rgba(255, 42, 58, 0.15)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Main Track Asphalt Base */}
          <path
            d="M 120,200 C 70,200 60,140 90,90 C 130,30 240,40 320,70 C 400,100 470,60 480,120 C 490,180 430,220 370,180 C 310,140 260,200 190,200 Z"
            fill="none"
            stroke="rgba(244, 245, 240, 0.15)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Precision Neon Racing Line */}
          <path
            id="raceLine"
            d="M 120,200 C 70,200 60,140 90,90 C 130,30 240,40 320,70 C 400,100 470,60 480,120 C 490,180 430,220 370,180 C 310,140 260,200 190,200 Z"
            fill="none"
            stroke="url(#trackGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#trackGlow)"
          />

          {/* Start/Finish Line Marker */}
          <line x1="120" y1="190" x2="120" y2="210" stroke="#F4F5F0" strokeWidth="3" />
          <text
            x="120"
            y="226"
            fill="var(--text-secondary)"
            fontSize="9"
            fontFamily="var(--font-mono)"
            textAnchor="middle"
            letterSpacing="0.08em"
          >
            START / FINISH
          </text>

          {/* Apex Markers (T1, T4, T9) */}
          <circle cx="85" cy="95" r="3.5" fill="#FF2A3A" />
          <text x="75" y="85" fill="#FF2A3A" fontSize="9" fontFamily="var(--font-mono)">T1 (HAIRPIN)</text>

          <circle cx="320" cy="70" r="3.5" fill="#FF2A3A" />
          <text x="320" y="55" fill="var(--text-secondary)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">
            T4 (CHICANE)
          </text>

          <circle cx="480" cy="120" r="3.5" fill="#FF2A3A" />
          <text x="495" y="123" fill="var(--text-secondary)" fontSize="9" fontFamily="var(--font-mono)">
            T9 (SWEEPER)
          </text>

          {/* Dynamic Traveling Orb on Circuit */}
          <circle r="4" fill="#FF2A3A" filter="url(#trackGlow)">
            <animateMotion
              dur="10s"
              repeatCount="indefinite"
              path="M 120,200 C 70,200 60,140 90,90 C 130,30 240,40 320,70 C 400,100 470,60 480,120 C 490,180 430,220 370,180 C 310,140 260,200 190,200 Z"
            />
          </circle>
        </svg>
      </div>

      {/* Track Telemetry Footer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
        }}
      >
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>TOP SPEED</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>248 KM/H</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>RECORD LAP</div>
          <div style={{ color: 'var(--accent-lime)', fontWeight: 600 }}>1:12.44</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>MAX LATERAL G</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>2.4 G</div>
        </div>
      </div>
    </div>
  );
};
