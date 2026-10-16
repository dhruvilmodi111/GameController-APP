import React from 'react';

interface PhoneMotionIllustrationProps {
  className?: string;
}

export const PhoneMotionIllustration: React.FC<PhoneMotionIllustrationProps> = () => {
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
        justifyContent: 'space-between',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          CONTROLLER DYNAMICS
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: 'var(--accent-lime)',
          }}
        >
          ±35° STEER ENVELOPE
        </span>
      </div>

      {/* Vector Illustration */}
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
          viewBox="0 0 460 240"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            {/* Red Motion Trail Gradient */}
            <linearGradient id="motionTrail" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF2A3A" stopOpacity="0" />
              <stop offset="60%" stopColor="#FF2A3A" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#FF2A3A" stopOpacity="0.9" />
            </linearGradient>

            <filter id="limeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Reference Neutral Horizontal Axis */}
          <line
            x1="80"
            y1="120"
            x2="380"
            y2="120"
            stroke="rgba(244, 245, 240, 0.08)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />

          {/* Curved Motion Trail Arc */}
          <path
            d="M 120,70 A 180,180 0 0,1 360,85"
            fill="none"
            stroke="url(#motionTrail)"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#limeGlow)"
          />

          {/* Secondary Echo Motion Arc */}
          <path
            d="M 140,85 A 160,160 0 0,1 340,98"
            fill="none"
            stroke="rgba(255, 42, 58, 0.2)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Arc Origin Marker & Limit Markers */}
          <circle cx="230" cy="120" r="3" fill="rgba(244, 245, 240, 0.4)" />
          <text x="230" y="140" fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">
            0° CENTER
          </text>

          <text x="110" y="65" fill="var(--accent-lime)" fontSize="9" fontFamily="var(--font-mono)">
            -22° ROLL
          </text>
          <text x="365" y="85" fill="var(--text-secondary)" fontSize="9" fontFamily="var(--font-mono)">
            +35° MAX
          </text>

          {/* Tilted Smartphone Chassis (rotated by -18 degrees) */}
          <g transform="translate(230, 115) rotate(-18)">
            {/* Chassis Drop Shadow */}
            <rect
              x="-115"
              y="-62"
              width="230"
              height="124"
              rx="22"
              fill="rgba(0,0,0,0.5)"
              transform="translate(6, 10)"
            />

            {/* Aluminum Outer Frame */}
            <rect
              x="-115"
              y="-62"
              width="230"
              height="124"
              rx="22"
              fill="#181E1A"
              stroke="rgba(244, 245, 240, 0.25)"
              strokeWidth="2"
            />

            {/* Screen Bezel Area */}
            <rect
              x="-106"
              y="-54"
              width="212"
              height="108"
              rx="15"
              fill="#0B0D0C"
              stroke="rgba(255, 42, 58, 0.3)"
              strokeWidth="1.5"
            />

            {/* Screen Display Visual: Horizon & Crosshair */}
            <line x1="-80" y1="0" x2="80" y2="0" stroke="rgba(255, 42, 58, 0.35)" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="0" y1="-30" x2="0" y2="30" stroke="rgba(255, 42, 58, 0.35)" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="0" cy="0" r="16" fill="none" stroke="rgba(255, 42, 58, 0.4)" strokeWidth="1" />
            
            {/* Centered Gyro Ball */}
            <circle cx="-12" cy="0" r="5" fill="#FF2A3A" filter="url(#limeGlow)" />

            {/* Left/Right Thumb Trigger Indicators */}
            <rect x="-95" y="-22" width="28" height="44" rx="8" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.1)" />
            <text x="-81" y="4" fill="var(--text-tertiary)" fontSize="8" fontFamily="var(--font-mono)" textAnchor="middle">
              BRAKE
            </text>

            <rect x="67" y="-22" width="28" height="44" rx="8" fill="rgba(255, 42, 58, 0.08)" stroke="rgba(255, 42, 58, 0.35)" />
            <text x="81" y="4" fill="var(--accent-lime)" fontSize="8" fontFamily="var(--font-mono)" textAnchor="middle">
              GAS
            </text>

            {/* Speaker / Camera Notch */}
            <rect x="-114" y="-8" width="3" height="16" rx="1.5" fill="rgba(255,255,255,0.2)" />
          </g>
        </svg>
      </div>

      {/* Description Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
        }}
      >
        <span>PHYSICAL TILT SENSOR</span>
        <span style={{ color: 'var(--text-primary)' }}>16MS LOW-PASS FILTER</span>
      </div>
    </div>
  );
};
