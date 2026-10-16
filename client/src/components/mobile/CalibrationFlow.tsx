import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, X, Crosshair } from 'lucide-react';
import { MotionSignature } from '../common/MotionSignature';
import type { CalibrationState } from '../../hooks/useSensor';
import { soundEngine } from '../../logic/game/audio';

interface CalibrationFlowProps {
  calibrationState: CalibrationState;
  /** Live normalized tilt vector for the orb (from sensor output) */
  tiltVector: { x: number; y: number };
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
}

const COLLECT_MS = 2000;

export const CalibrationFlow: React.FC<CalibrationFlowProps> = ({
  calibrationState,
  tiltVector,
  onStart,
  onCancel,
  onClose,
}) => {
  const [progress, setProgress] = useState(0); // 0–100 during collection
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevCalibStateRef = useRef<CalibrationState>(calibrationState);

  // Trigger sound effect and haptic when calibration succeeds
  useEffect(() => {
    if (calibrationState === 'done' && prevCalibStateRef.current !== 'done') {
      soundEngine.playCalibrationSound();
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([30, 40, 60]);
        }
      } catch {
        // ignore
      }
    }
    prevCalibStateRef.current = calibrationState;
  }, [calibrationState]);

  // Drive the progress bar during 'collecting' state
  useEffect(() => {
    if (calibrationState !== 'collecting') {
      setProgress(0);
      startTimeRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    startTimeRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - (startTimeRef.current ?? 0);
      const pct = Math.min(100, (elapsed / COLLECT_MS) * 100);
      setProgress(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [calibrationState]);

  const isCollecting = calibrationState === 'collecting';
  const isDone       = calibrationState === 'done';
  const isUnstable   = calibrationState === 'unstable';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 13, 12, 0.94)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '20px',
      }}
    >
      <div
        className="elevated-panel"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '28px 24px',
          border: isDone ? '1px solid var(--border-lime)' : '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
          textAlign: 'center',
          position: 'relative',
          boxShadow: isDone
            ? '0 16px 48px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 42, 58, 0.15)'
            : '0 16px 40px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Close button */}
        {!isCollecting && (
          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              onClose();
            }}
            className="btn-ghost"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '6px',
            }}
            aria-label="Close calibration"
          >
            <X size={18} />
          </button>
        )}

        {/* ── SUCCESS: Centering Crosshair Animation ── */}
        {isDone && (
          <>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--accent-lime)',
                  letterSpacing: '0.1em',
                  marginBottom: '4px',
                }}
              >
                CALIBRATION COMPLETE
              </div>
              <h2
                className="font-display"
                style={{ fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 700 }}
              >
                Neutral Center Locked
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Your current phone position is now calibrated as true zero.
              </p>
            </div>

            {/* Smooth Crosshair-Centering Reticle with Pulse Ring */}
            <div
              style={{
                position: 'relative',
                width: '160px',
                height: '160px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Expanding Calibration Pulse Ring */}
              <div
                className="calib-pulse-ring"
                style={{
                  position: 'absolute',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent-lime)',
                  pointerEvents: 'none',
                }}
              />

              {/* Locked Motion Signature smoothly snapped to (0,0) */}
              <MotionSignature
                value={{ x: 0, y: 0 }}
                size={150}
                label=""
                showValues={false}
                interactive={false}
              />

              {/* Centered crosshair badge */}
              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-lime)',
                  pointerEvents: 'none',
                }}
              >
                <Crosshair size={28} style={{ animation: 'calibCenterCrosshair 1s ease-out' }} />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-lime-dim)',
                border: '1px solid var(--border-lime)',
                fontSize: '0.74rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-lime)',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={14} />
              <span>ALIGNMENT 0.00° • READY</span>
            </div>

            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                onClose();
              }}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
            >
              Confirm &amp; Start Driving
            </button>
          </>
        )}

        {/* ── UNSTABLE ── */}
        {isUnstable && (
          <>
            <AlertTriangle size={44} color="#ffb800" />
            <div>
              <h2
                className="font-display"
                style={{ fontSize: '1.25rem', color: '#ffb800', marginBottom: '6px', fontWeight: 700 }}
              >
                Excessive Movement Detected
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Hold the phone steady in your comfortable driving grip and try again.
              </p>
            </div>
            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                onStart();
              }}
              className="btn-secondary"
              style={{ width: '100%', padding: '12px', borderColor: 'var(--border-lime)' }}
            >
              <RefreshCw size={14} color="var(--accent-lime)" />
              Try Again
            </button>
            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                onCancel();
              }}
              className="btn-ghost"
              style={{ width: '100%', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
            >
              Cancel
            </button>
          </>
        )}

        {/* ── IDLE ── */}
        {calibrationState === 'idle' && (
          <>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--accent-lime)',
                  letterSpacing: '0.1em',
                  marginBottom: '4px',
                }}
              >
                GYROSCOPE ZEROING
              </div>
              <h2
                className="font-display"
                style={{ fontSize: '1.3rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}
              >
                Calibrate Steering Center
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Hold the phone in your natural driving grip. The center will be locked for precision steering.
              </p>
            </div>

            {/* Live orb preview */}
            <MotionSignature
              value={tiltVector}
              size={150}
              label="CURRENT POSITION"
              showValues={true}
              interactive={false}
            />

            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                onStart();
              }}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
            >
              Hold Still &amp; Calibrate
            </button>
            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                onCancel();
              }}
              className="btn-ghost"
              style={{ width: '100%', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
            >
              Cancel
            </button>
          </>
        )}

        {/* ── COLLECTING ── */}
        {isCollecting && (
          <>
            <div>
              <h2
                className="font-display"
                style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '6px' }}
              >
                Hold Phone Steady…
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Sampling neutral sensor orientation (2 seconds).
              </p>
            </div>

            {/* Live orb showing movement */}
            <MotionSignature
              value={tiltVector}
              size={150}
              label="SAMPLING SENSORS"
              showValues={true}
              interactive={false}
            />

            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: 'var(--surface-subtle)',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  borderRadius: '3px',
                  backgroundColor: 'var(--accent-lime)',
                  transition: 'width 80ms linear',
                  boxShadow: '0 0 10px var(--accent-lime)',
                }}
              />
            </div>

            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                onCancel();
              }}
              className="btn-ghost"
              style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};
