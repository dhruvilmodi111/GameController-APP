import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Volume2, VolumeX, Terminal } from 'lucide-react';
import type { ConnectionStatus } from '@shared/types';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { soundEngine } from '../../logic/game/audio';

interface HeaderProps {
  currentMode: 'desktop' | 'mobile';
  onToggleMode: (mode: 'desktop' | 'mobile') => void;
  latency: number;
  connectionStatus: ConnectionStatus;
  reconnectAttempt?: number;
  deviceInfoName?: string;
  roomId?: string;
  onToggleTelemetry?: () => void;
  isTelemetryOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onToggleMode,
  latency,
  connectionStatus,
  reconnectAttempt,
  deviceInfoName,
  roomId,
  onToggleTelemetry,
  isTelemetryOpen = false,
}) => {
  const [isMuted, setIsMuted] = useState(() => soundEngine.getMuted());

  useEffect(() => {
    setIsMuted(soundEngine.getMuted());
  }, []);

  const handleToggleMute = () => {
    const nextMuted = soundEngine.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.playButtonClickSound();
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-primary)',
        zIndex: 50,
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      {/* Brand Logo & Tagline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--border-lime)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Minimalist gyro dot */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-lime)',
              boxShadow: '0 0 8px var(--accent-lime)',
            }}
          />
        </div>

        <div>
          <div
            className="font-display"
            style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            GYRO<span style={{ color: 'var(--accent-lime)' }}>//</span>PLAY
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              letterSpacing: '0.06em',
            }}
          >
            NO BUTTONS. JUST MOTION.
          </div>
        </div>
      </div>

      {/* Center / Right Status, Controls, & Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <ConnectionStatusBadge
          status={connectionStatus}
          latency={latency}
          roomId={roomId}
          deviceInfoName={deviceInfoName}
          reconnectAttempt={reconnectAttempt}
          compact={false}
        />

        {/* Global Sound Mute Toggle */}
        <button
          onClick={handleToggleMute}
          className="btn-ghost"
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-elevated)',
            color: isMuted ? 'var(--text-tertiary)' : 'var(--accent-lime)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.74rem',
            fontFamily: 'var(--font-mono)',
          }}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <span style={{ display: 'none' }}>MUTE</span>
        </button>

        {/* Developer Telemetry Panel Toggle */}
        {onToggleTelemetry && (
          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              onToggleTelemetry();
            }}
            className="btn-ghost"
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: isTelemetryOpen ? 'rgba(255, 42, 58, 0.12)' : 'var(--surface-elevated)',
              color: isTelemetryOpen ? 'var(--accent-lime)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontFamily: 'var(--font-mono)',
            }}
            title="Toggle Developer Telemetry Panel"
            aria-label="Developer Telemetry"
          >
            <Terminal size={14} />
            <span style={{ display: 'none' }}>DEV</span>
          </button>
        )}

        {/* Mode Switcher (Desktop ↔ Phone) */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--surface-elevated)',
            padding: '3px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              onToggleMode('desktop');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: currentMode === 'desktop' ? 'var(--surface-subtle)' : 'transparent',
              color: currentMode === 'desktop' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.78rem',
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Monitor size={14} color={currentMode === 'desktop' ? 'var(--accent-lime)' : 'currentColor'} />
            Desktop
          </button>
          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              onToggleMode('mobile');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: currentMode === 'mobile' ? 'var(--surface-subtle)' : 'transparent',
              color: currentMode === 'mobile' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.78rem',
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Smartphone size={14} color={currentMode === 'mobile' ? 'var(--accent-lime)' : 'currentColor'} />
            Phone
          </button>
        </div>
      </div>
    </header>
  );
};

