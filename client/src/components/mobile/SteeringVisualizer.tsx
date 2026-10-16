import React from 'react';

interface SteeringVisualizerProps {
  /** Steering ratio from -1.0 (full left) to 1.0 (full right) */
  steering: number;
  /** Actual physical tilt in degrees (-35° to 35°) */
  tiltDegrees: number;
}

export const SteeringVisualizer: React.FC<SteeringVisualizerProps> = ({
  steering,
  tiltDegrees,
}) => {
  const clampedSteering = Math.max(-1, Math.min(1, steering));
  const clampedTilt = Math.max(-45, Math.min(45, tiltDegrees));

  // Gauge geometry
  const width = 140;
  const height = 90;
  const cx = width / 2;
  const cy = 76;
  const r = 54;

  // Arc runs from 195° (bottom left) to 345° (bottom right) -> span = 150°
  // Center is 270° (top dead center)
  const angleDeg = 270 + clampedSteering * 65;
  const angleRad = (angleDeg * Math.PI) / 180;
  const pointerX = cx + r * Math.cos(angleRad);
  const pointerY = cy + r * Math.sin(angleRad);

  // SVG arc path for gauge background
  // start: 205°, end: 335°
  const startRad = (205 * Math.PI) / 180;
  const endRad = (335 * Math.PI) / 180;
  const startX = cx + r * Math.cos(startRad);
  const startY = cy + r * Math.sin(startRad);
  const endX = cx + r * Math.cos(endRad);
  const endY = cy + r * Math.sin(endRad);

  // Dynamic active sweep arc from 270° (top) to angleDeg
  const topX = cx + r * Math.cos((270 * Math.PI) / 180);
  const topY = cy + r * Math.sin((270 * Math.PI) / 180);
  const isRight = angleDeg >= 270;
  const sweepFlag = isRight ? 1 : 0;
  const activeArcPath =
    Math.abs(clampedSteering) > 0.02
      ? `M ${topX} ${topY} A ${r} ${r} 0 0 ${sweepFlag} ${pointerX} ${pointerY}`
      : '';

  const isCenter = Math.abs(clampedSteering) < 0.05;

  return (
    <div
      style={{
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        userSelect: 'none',
      }}
      aria-label={`Steering angle ${clampedTilt.toFixed(0)} degrees`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="steeringArcGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF2A3A" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#FF2A3A" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FF2A3A" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Background track arc */}
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
          fill="none"
          stroke="rgba(244, 245, 240, 0.12)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Deadzone indicator markers (±5% near top) */}
        {[-0.08, 0.08].map((dz) => {
          const a = ((270 + dz * 65) * Math.PI) / 180;
          const x1 = cx + (r - 4) * Math.cos(a);
          const y1 = cy + (r - 4) * Math.sin(a);
          const x2 = cx + (r + 4) * Math.cos(a);
          const y2 = cy + (r + 4) * Math.sin(a);
          return (
            <line
              key={dz}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(244, 245, 240, 0.25)"
              strokeWidth="1"
            />
          );
        })}

        {/* Top Center Neutral Notch */}
        <line
          x1={cx}
          y1={cy - r - 5}
          x2={cx}
          y2={cy - r + 3}
          stroke="var(--accent-lime)"
          strokeWidth="2"
        />

        {/* Active colored steering fill */}
        {activeArcPath && (
          <path
            d={activeArcPath}
            fill="none"
            stroke="url(#steeringArcGlow)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}

        {/* Current steering angle indicator pip */}
        <circle
          cx={pointerX}
          cy={pointerY}
          r="4.5"
          fill="var(--accent-lime)"
          stroke="#0B0D0C"
          strokeWidth="1.5"
          style={{
            filter: 'drop-shadow(0 0 6px var(--accent-lime))',
            transition: 'cx 0.05s ease-out, cy 0.05s ease-out',
          }}
        />
      </svg>

      {/* Digital degree ticker & direction in center bottom */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '2px',
          zIndex: 2,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: isCenter ? 'var(--text-primary)' : 'var(--accent-lime)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {clampedTilt >= 0 ? `+${clampedTilt.toFixed(0)}` : clampedTilt.toFixed(0)}°
        </div>
        <div
          style={{
            fontSize: '0.58rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: isCenter ? 'var(--text-tertiary)' : 'var(--text-secondary)',
            letterSpacing: '0.08em',
            marginTop: '2px',
          }}
        >
          {isCenter ? 'CENTER' : clampedSteering < 0 ? '◀ LEFT' : 'RIGHT ▶'}
        </div>
      </div>
    </div>
  );
};
