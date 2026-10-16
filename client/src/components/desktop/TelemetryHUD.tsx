import React from 'react';
import { Flame, Compass, Zap } from 'lucide-react';
import type { GameTelemetry } from '@shared/types';
import type { GameMode } from '../../logic/game/engine';

interface TelemetryHUDProps {
  telemetry: GameTelemetry;
  steeringAngle?: number;
  compassRef?: React.Ref<HTMLDivElement>;
  steeringTextRef?: React.Ref<HTMLDivElement>;
  rttLatencyMs?: number;
  oneWayLatencyMs?: number;
  updateHz?: number;
  latestSeq?: number;
  controllerConnected?: boolean;
  gameMode?: GameMode;
  neonRushHits?: number;
  neonRushPenaltyMs?: number;
  isKeyboardActive?: boolean;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  steeringAngle = 0,
  compassRef,
  steeringTextRef,
  rttLatencyMs = 0,
  oneWayLatencyMs = 0,
  updateHz = 0,
  latestSeq = 0,
  controllerConnected = false,
  gameMode = 'race',
  neonRushHits = 0,
  neonRushPenaltyMs = 0,
  isKeyboardActive = false,
}) => {
  const { speedKmh, gear, nitroRemaining, currentLap, totalLaps, lapTimeSeconds, bestLapTimeSeconds } = telemetry;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px',
      }}
    >
      {/* Top Bar: Lap Counter, Motion Link Diagnostics, and Lap Timers */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
        }}
      >
        {/* Lap Counter */}
        <div
          className="elevated-panel"
          style={{
            padding: '10px 18px',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>LAP</div>
            <div className="font-display" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-lime)' }}>
              {currentLap} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>/ {totalLaps}</span>
            </div>
          </div>
        </div>

        {/* Center: Live Motion Link & Latency Diagnostics */}
        <div
          className="elevated-panel"
          style={{
            padding: '8px 16px',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            border: controllerConnected ? '1px solid var(--border-medium)' : '1px solid #ff5c5c',
            backgroundColor: 'rgba(11, 13, 12, 0.85)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Connection Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: controllerConnected ? 'var(--accent-lime)' : '#ff5c5c',
                boxShadow: controllerConnected ? '0 0 8px var(--accent-lime)' : '0 0 8px #ff5c5c',
              }}
            />
            <span style={{ fontWeight: 700, color: controllerConnected ? 'var(--text-primary)' : '#ff5c5c', letterSpacing: '0.04em' }}>
              {controllerConnected ? 'PHONE SYNCED' : 'PHONE OFFLINE'}
            </span>
          </div>

          <span style={{ color: 'var(--border-subtle)' }}>│</span>

          {/* Measured Round-Trip Latency (RTT) */}
          <div title="Measured bidirectional round-trip latency via ping-sync echo packets">
            <span style={{ color: 'var(--text-tertiary)' }}>RTT: </span>
            <strong
              style={{
                color: rttLatencyMs < 35 ? 'var(--accent-lime)' : rttLatencyMs < 80 ? '#ffb800' : '#ff5c5c',
              }}
            >
              {rttLatencyMs}ms
            </strong>
          </div>

          {/* Estimated One-Way Transit */}
          <div title="Estimated one-way sensor-to-screen transit (~RTT / 2)">
            <span style={{ color: 'var(--text-tertiary)' }}>ONE-WAY: </span>
            <strong style={{ color: 'var(--text-secondary)' }}>
              ~{oneWayLatencyMs}ms
            </strong>
          </div>

          <span style={{ color: 'var(--border-subtle)' }}>│</span>

          {/* Update frequency (Hz) */}
          <div title="Live incoming motion packets per second">
            <span style={{ color: 'var(--text-tertiary)' }}>RATE: </span>
            <strong
              style={{
                color: updateHz >= 30 ? 'var(--accent-lime)' : updateHz > 0 ? '#ffb800' : 'var(--text-tertiary)',
              }}
            >
              {updateHz} Hz
            </strong>
          </div>

          <span style={{ color: 'var(--border-subtle)' }}>│</span>

          {/* Latest Sequence Number */}
          <div title="Highest sequence packet validated and accepted in order">
            <span style={{ color: 'var(--text-tertiary)' }}>SEQ: </span>
            <strong style={{ color: 'var(--text-primary)' }}>
              #{latestSeq}
            </strong>
          </div>

          {isKeyboardActive && (
            <>
              <span style={{ color: 'var(--border-subtle)' }}>│</span>
              <div style={{ color: 'var(--accent-lime)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⌨️</span> <strong>KEYBOARD</strong>
              </div>
            </>
          )}
        </div>

        {/* Lap Times + Mode Badge */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {gameMode === 'neonrush' && (
            <div style={{
              padding: '6px 12px',
              border: `1px solid ${neonRushHits === 0 ? 'var(--border-lime)' : '#ff007f'}`,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: neonRushHits === 0 ? 'rgba(255, 42, 58, 0.08)' : 'rgba(255, 0, 128, 0.12)',
              color: neonRushHits === 0 ? 'var(--accent-lime)' : '#ff5c5c',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: neonRushHits === 0 ? '0 0 12px rgba(255, 42, 58, 0.2)' : '0 0 16px rgba(255, 0, 128, 0.3)',
            }}>
              <Zap size={12} />
              {neonRushHits === 0 ? 'CLEAN RUN (0 FAULTS)' : `+${(neonRushPenaltyMs / 1000).toFixed(1)}s PENALTY (${neonRushHits})`}
            </div>
          )}
          <div
            className="elevated-panel"
            style={{
              padding: '10px 20px',
              pointerEvents: 'auto',
              display: 'flex',
              gap: '24px',
              textAlign: 'right',
            }}
          >
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>CURRENT</div>
              <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {lapTimeSeconds.toFixed(2)}s
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>BEST</div>
              <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--accent-lime)' }}>
                {bestLapTimeSeconds > 0 ? `${bestLapTimeSeconds.toFixed(2)}s` : '--:--'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Speedometer, Gear, Nitro, and Steering Gyro Indicator */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        {/* Left: Phone Steering Angle Telemetry */}
        <div
          className="elevated-panel"
          style={{
            padding: '14px 18px',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            ref={compassRef}
            style={{
              position: 'relative',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'var(--surface-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `rotate(${steeringAngle * 40}deg)`,
              transition: 'transform 0.05s ease-out',
            }}
          >
            <Compass size={24} color="var(--accent-lime)" />
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              STEERING ANGLE
            </div>
            <div
              ref={steeringTextRef}
              className="font-mono"
              style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-lime)' }}
            >
              {(steeringAngle * 35).toFixed(0)}°
            </div>
          </div>
        </div>

        {/* Center / Right: Speedometer Cockpit cluster */}
        <div
          className="elevated-panel"
          style={{
            padding: '16px 28px',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Gear */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>GEAR</div>
            <div
              className="font-display"
              style={{ fontSize: '2.4rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}
            >
              {gear}
            </div>
          </div>

          {/* Speed Digital Gauge */}
          <div style={{ textAlign: 'center', minWidth: '110px' }}>
            <div
              className="font-display"
              style={{ fontSize: '3.2rem', fontWeight: 700, lineHeight: 0.9, color: 'var(--accent-lime)' }}
            >
              {speedKmh}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', marginTop: '4px' }}>
              KM / H
            </div>
          </div>

          {/* Nitro Fuel Bar */}
          <div style={{ width: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Flame size={12} color="var(--accent-lime)" /> BOOST
              </div>
              <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-lime)', fontWeight: 600 }}>
                {nitroRemaining}%
              </div>
            </div>
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
                  width: `${nitroRemaining}%`,
                  height: '100%',
                  backgroundColor: 'var(--accent-lime)',
                  boxShadow: '0 0 10px rgba(255, 42, 58, 0.4)',
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
