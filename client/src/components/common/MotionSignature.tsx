import React, { useRef, useState, useEffect } from 'react';

export interface MotionSignatureInput {
  /** Normalized X tilt / roll (-1.0 to 1.0) */
  x: number;
  /** Normalized Y tilt / pitch (-1.0 to 1.0) */
  y: number;
}

export interface MotionSignatureProps {
  /** Tilt input value. If omitted, internal interactive state is used */
  value?: MotionSignatureInput;
  /** Bounding box dimension in pixels */
  size?: number;
  /** Label displayed above or below */
  label?: string;
  /** Show live coordinate readouts */
  showValues?: boolean;
  /** Enable mouse hover / touch simulation when no active sensor data is present */
  interactive?: boolean;
  /** Callback when manipulated via mouse/touch */
  onChange?: (val: MotionSignatureInput) => void;
  /** Compact mode for headers/toolbars */
  compact?: boolean;
}

export const MotionSignature: React.FC<MotionSignatureProps> = ({
  value,
  size = 190,
  label = 'MOTION SIGNATURE',
  showValues = true,
  interactive = true,
  onChange,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [internalValue, setInternalValue] = useState<MotionSignatureInput>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // If external value is provided, sync with it
  const current = value !== undefined ? value : internalValue;

  // Clamp current coords
  const clampedX = Math.max(-1, Math.min(1, current.x || 0));
  const clampedY = Math.max(-1, Math.min(1, current.y || 0));

  const radius = (size - 32) / 2;
  const orbPixelX = clampedX * radius;
  const orbPixelY = -clampedY * radius; // Invert Y so up is positive

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || value !== undefined) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const rawX = (e.clientX - centerX) / radius;
    const rawY = -(e.clientY - centerY) / radius;

    const next = {
      x: Number(Math.max(-1, Math.min(1, rawX)).toFixed(2)),
      y: Number(Math.max(-1, Math.min(1, rawY)).toFixed(2)),
    };

    setInternalValue(next);
    onChange?.(next);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    if (!interactive || value !== undefined) return;
    // Smoothly spring back to center
    const reset = { x: 0, y: 0 };
    setInternalValue(reset);
    onChange?.(reset);
  };

  // Subtle ambient idle breathing when untouched
  useEffect(() => {
    if (value !== undefined || isHovered) return;
    let animId: number;
    const startTime = performance.now();

    const loop = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      // Very gentle idle sway (±0.06)
      const swayX = Math.sin(elapsed * 1.2) * 0.08;
      const swayY = Math.cos(elapsed * 0.9) * 0.06;
      setInternalValue({ x: Number(swayX.toFixed(3)), y: Number(swayY.toFixed(3)) });
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [value, isHovered]);

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
      }}
    >
      {/* Header Label */}
      {!compact && label && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: '8px',
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <span>{label}</span>
          <span style={{ color: 'var(--accent-lime)' }}>[ACTIVE]</span>
        </div>
      )}

      {/* Main Reticle Container */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={handlePointerLeave}
        style={{
          position: 'relative',
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: interactive && value === undefined ? 'crosshair' : 'default',
          boxShadow: isHovered
            ? '0 8px 30px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 42, 58, 0.2)'
            : '0 8px 24px rgba(0, 0, 0, 0.35)',
          transition: 'box-shadow var(--transition-normal), border-color var(--transition-normal)',
        }}
      >
        {/* Subtle radial center glow */}
        <div
          style={{
            position: 'absolute',
            width: '60%',
            height: '60%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 42, 58, 0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Reticle SVG: Concentric Circles & Axes */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {/* Outer circle limit */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(244, 245, 240, 0.08)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Inner calibration ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius * 0.5}
            fill="none"
            stroke="rgba(244, 245, 240, 0.05)"
            strokeWidth="1"
          />

          {/* Horizontal Axis */}
          <line
            x1={16}
            y1={size / 2}
            x2={size - 16}
            y2={size / 2}
            stroke="rgba(244, 245, 240, 0.1)"
            strokeWidth="1"
          />

          {/* Vertical Axis */}
          <line
            x1={size / 2}
            y1={16}
            x2={size / 2}
            y2={size - 16}
            stroke="rgba(244, 245, 240, 0.1)"
            strokeWidth="1"
          />

          {/* Axis Micro Ticks */}
          {[-0.5, 0.5].map((tick) => (
            <React.Fragment key={tick}>
              <line
                x1={size / 2 + tick * radius}
                y1={size / 2 - 3}
                x2={size / 2 + tick * radius}
                y2={size / 2 + 3}
                stroke="rgba(244, 245, 240, 0.2)"
                strokeWidth="1"
              />
              <line
                x1={size / 2 - 3}
                y1={size / 2 + tick * radius}
                x2={size / 2 + 3}
                y2={size / 2 + tick * radius}
                stroke="rgba(244, 245, 240, 0.2)"
                strokeWidth="1"
              />
            </React.Fragment>
          ))}

          {/* Vector connection line from center to orb */}
          <line
            x1={size / 2}
            y1={size / 2}
            x2={size / 2 + orbPixelX}
            y2={size / 2 + orbPixelY}
            stroke="rgba(255, 42, 58, 0.35)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        </svg>

        {/* Center Crosshair Anchor */}
        <div
          style={{
            position: 'absolute',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'rgba(244, 245, 240, 0.3)',
            pointerEvents: 'none',
          }}
        />

        {/* The Glowing Lime Orb */}
        <div
          className="motion-orb"
          style={{
            position: 'absolute',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-lime)',
            transform: `translate(${orbPixelX}px, ${orbPixelY}px)`,
            transition: isHovered ? 'none' : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      </div>

      {/* Coordinate Telemetry Values */}
      {!compact && showValues && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            X: <strong style={{ color: 'var(--text-primary)' }}>{clampedX >= 0 ? `+${clampedX.toFixed(2)}` : clampedX.toFixed(2)}</strong>
          </span>
          <span>
            Y: <strong style={{ color: 'var(--text-primary)' }}>{clampedY >= 0 ? `+${clampedY.toFixed(2)}` : clampedY.toFixed(2)}</strong>
          </span>
        </div>
      )}
    </div>
  );
};
