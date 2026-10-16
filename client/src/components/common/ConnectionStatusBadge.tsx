import React from 'react';
import { Smartphone, Radio, AlertTriangle, RefreshCw } from 'lucide-react';
import type { ConnectionStatus } from '@shared/types';

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  latency?: number;
  roomId?: string;
  deviceInfoName?: string;
  reconnectAttempt?: number;
  onClick?: () => void;
  compact?: boolean;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  status,
  latency = 0,
  roomId,
  deviceInfoName,
  reconnectAttempt = 0,
  onClick,
  compact = false,
}) => {
  if (status === 'disconnected') {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'rgba(255, 77, 77, 0.08)',
          border: '1px solid rgba(255, 77, 77, 0.3)',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          color: '#ff5c5c',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#ff4d4d',
            display: 'inline-block',
          }}
        />
        <AlertTriangle size={12} />
        <span>DISCONNECTED</span>
      </div>
    );
  }

  if (status === 'reconnecting') {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'rgba(255, 184, 0, 0.08)',
          border: '1px solid rgba(255, 184, 0, 0.3)',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          color: '#ffb800',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <RefreshCw size={12} className="animate-spin" />
        <span>RECONNECTING{reconnectAttempt > 0 ? ` (${reconnectAttempt}/10)` : '...'}</span>
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--border-lime)',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          boxShadow: '0 0 14px rgba(255, 42, 58, 0.18)',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <span
          className="status-dot-active"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-lime)',
            display: 'inline-block',
          }}
        />
        <Smartphone size={13} color="var(--accent-lime)" />
        <span style={{ fontWeight: 600 }}>
          {deviceInfoName ? `PAIRED: ${deviceInfoName}` : 'CONTROLLER PAIRED'}
        </span>
        {!compact && latency > 0 && (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
            ({latency}ms)
          </span>
        )}
      </div>
    );
  }

  // Status is 'waiting'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        fontSize: '0.72rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--transition-fast)',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-lime)',
          opacity: 0.6,
          display: 'inline-block',
        }}
      />
      <Radio size={12} color="var(--accent-lime)" />
      <span>WAITING • {roomId ? `ROOM ${roomId}` : 'AWAITING SESSION'}</span>
    </div>
  );
};
