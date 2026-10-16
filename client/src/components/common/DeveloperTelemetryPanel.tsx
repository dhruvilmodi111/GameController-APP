import React, { useState } from 'react';
import { Terminal, X, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { ConnectionStatus } from '@shared/types';
import { soundEngine } from '../../logic/game/audio';

export interface DeveloperTelemetryData {
  connectionStatus: ConnectionStatus;
  socketId?: string;
  roomId?: string;
  latencyMs: number;
  oneWayMs?: number;
  updateHz?: number;
  packetSeq?: number;
  deviceInfo?: string;
  // Sensor / Input details
  roll?: number;
  pitch?: number;
  yaw?: number;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  steering?: number;
  throttle?: number;
  brake?: number;
  nitro?: boolean;
  drift?: boolean;
  activeControlSource?: 'gyro' | 'touch' | 'keyboard' | 'idle';
}

interface DeveloperTelemetryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: DeveloperTelemetryData;
}

export const DeveloperTelemetryPanel: React.FC<DeveloperTelemetryPanelProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    soundEngine.playButtonClickSound();
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="animate-slide-up"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '380px',
        maxWidth: 'calc(100vw - 40px)',
        backgroundColor: 'rgba(14, 17, 15, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-lime)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 42, 58, 0.1)',
        zIndex: 9999,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.72rem',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: 'rgba(255, 42, 58, 0.08)',
          borderBottom: '1px solid var(--border-medium)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} color="var(--accent-lime)" />
          <span style={{ fontWeight: 700, color: 'var(--accent-lime)', letterSpacing: '0.06em' }}>
            DEV TELEMETRY // REAL-TIME
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              setIsCollapsed(!isCollapsed);
            }}
            className="btn-ghost"
            style={{ padding: '4px' }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            aria-label="Toggle collapse"
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              onClose();
            }}
            className="btn-ghost"
            style={{ padding: '4px' }}
            title="Close Panel"
            aria-label="Close telemetry"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Panel Content */}
      {!isCollapsed && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Transport Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div style={{ background: 'var(--surface-subtle)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.62rem' }}>CONNECTION</div>
              <div style={{ fontWeight: 600, color: data.connectionStatus === 'connected' ? 'var(--accent-lime)' : '#ff5c5c' }}>
                {data.connectionStatus.toUpperCase()}
              </div>
            </div>
            <div style={{ background: 'var(--surface-subtle)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.62rem' }}>ROOM / SOCKET</div>
              <div style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {data.roomId || 'NONE'} {data.socketId ? `(${data.socketId.slice(0, 5)})` : ''}
              </div>
            </div>
            <div style={{ background: 'var(--surface-subtle)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.62rem' }}>RTT / 1-WAY</div>
              <div style={{ color: data.latencyMs < 35 ? 'var(--accent-lime)' : '#ffb800', fontWeight: 600 }}>
                {data.latencyMs}ms / ~{data.oneWayMs ?? Math.round(data.latencyMs / 2)}ms
              </div>
            </div>
            <div style={{ background: 'var(--surface-subtle)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '0.62rem' }}>PACKET RATE / SEQ</div>
              <div style={{ color: 'var(--text-primary)' }}>
                {data.updateHz ?? 0} Hz / #{data.packetSeq ?? 0}
              </div>
            </div>
          </div>

          {/* Sensor Angles (Euler) */}
          <div style={{ background: 'var(--surface-subtle)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--accent-lime)', fontSize: '0.64rem', fontWeight: 700, marginBottom: '4px' }}>
              GYRO EULER ORIENTATION
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
              <div>Roll: <strong style={{ color: 'var(--text-primary)' }}>{data.roll?.toFixed(1) ?? '0.0'}°</strong></div>
              <div>Pitch: <strong style={{ color: 'var(--text-primary)' }}>{data.pitch?.toFixed(1) ?? '0.0'}°</strong></div>
              <div>Yaw: <strong style={{ color: 'var(--text-primary)' }}>{data.yaw?.toFixed(1) ?? '0.0'}°</strong></div>
            </div>
          </div>

          {/* Linear Acceleration */}
          {(data.accelX !== undefined || data.accelY !== undefined) && (
            <div style={{ background: 'var(--surface-subtle)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--accent-lime)', fontSize: '0.64rem', fontWeight: 700, marginBottom: '4px' }}>
                ACCELEROMETER VECTORS (m/s²)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                <div>Ax: <strong style={{ color: 'var(--text-primary)' }}>{data.accelX?.toFixed(2) ?? '0.00'}</strong></div>
                <div>Ay: <strong style={{ color: 'var(--text-primary)' }}>{data.accelY?.toFixed(2) ?? '0.00'}</strong></div>
                <div>Az: <strong style={{ color: 'var(--text-primary)' }}>{data.accelZ?.toFixed(2) ?? '0.00'}</strong></div>
              </div>
            </div>
          )}

          {/* Controls State */}
          <div style={{ background: 'var(--surface-subtle)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--accent-lime)', fontSize: '0.64rem', fontWeight: 700, marginBottom: '4px' }}>
              NORMALIZED CONTROLS // ACTIVE: {data.activeControlSource?.toUpperCase() || 'IDLE'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div>Steering: <strong style={{ color: 'var(--accent-lime)' }}>{data.steering?.toFixed(2) ?? '0.00'}</strong></div>
              <div>Throttle: <strong style={{ color: (data.throttle ?? 0) > 0 ? 'var(--accent-lime)' : 'var(--text-secondary)' }}>{((data.throttle ?? 0) * 100).toFixed(0)}%</strong></div>
              <div>Brake: <strong style={{ color: (data.brake ?? 0) > 0 ? '#ff5c5c' : 'var(--text-secondary)' }}>{((data.brake ?? 0) * 100).toFixed(0)}%</strong></div>
              <div>Nitro / Drift: <strong style={{ color: data.nitro ? 'var(--accent-lime)' : 'var(--text-secondary)' }}>{data.nitro ? 'ON' : 'OFF'} / {data.drift ? 'ON' : 'OFF'}</strong></div>
            </div>
          </div>

          {/* Copy snapshot */}
          <button
            onClick={handleCopy}
            className="btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.7rem',
              gap: '6px',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            {copied ? <Check size={12} color="var(--accent-lime)" /> : <Copy size={12} />}
            {copied ? 'Telemetry JSON Copied!' : 'Copy Telemetry Snapshot'}
          </button>
        </div>
      )}
    </div>
  );
};
