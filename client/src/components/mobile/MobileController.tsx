import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import {
  Smartphone,
  Zap,
  Maximize,
  Minimize,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  Shield,
  ShieldOff,
  Settings2,
  Activity,
  Terminal,
  Flag,
  X,
} from 'lucide-react';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameTelemetry,
  DeviceInfo,
  ConnectionStatus,
  CalibrationData,
} from '@shared/types';
import { sensorProcessor } from '../../logic/sensors/sensorProcessing';
import type { ControlProfile } from '../../logic/sensors/sensorProcessing';
import { useSensor } from '../../hooks/useSensor';
import { useWakeLock } from '../../hooks/useWakeLock';
import { SteeringVisualizer } from './SteeringVisualizer';
import { CalibrationFlow } from './CalibrationFlow';
import { CalibrationDialog } from './CalibrationDialog';
import { MobileLanding } from './MobileLanding';
import { ConnectionStatusBadge } from '../common/ConnectionStatusBadge';
import { soundEngine } from '../../logic/game/audio';

// How often (ms) to emit motion data to the server when armed
const EMIT_INTERVAL_MS = 16; // ~60 Hz

interface MobileControllerProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  socketStatus: 'connected' | 'reconnecting' | 'disconnected';
  initialRoomId?: string;
  latency: number;
}

export const MobileController: React.FC<MobileControllerProps> = ({
  socket,
  socketStatus,
  initialRoomId = '',
  latency,
}) => {
  // ─── Connection state ─────────────────────────────────────────────────
  const [roomId, setRoomId]                           = useState(initialRoomId);
  const [controllerStatus, setControllerStatus]       = useState<ConnectionStatus>('waiting');
  const [isConnecting, setIsConnecting]               = useState(false);
  const [joinError, setJoinError]                     = useState<string | null>(null);
  const [disconnectReason, setDisconnectReason]       = useState<string | null>(null);

  // ─── Sensor hook ──────────────────────────────────────────────────────
  const {
    availability,
    calibrationState,
    output:    sensorOutput,
    rawAngles,
    acceleration,
    rotationRate,
    requestPermission,
    startCalibration,
    cancelCalibration,
    recalibrate,
  } = useSensor();

  const sensorAvailable = availability === 'available';
  const needsPermission = availability === 'permission_needed';
  const sensorDenied    = availability === 'denied';
  const sensorMissing   = availability === 'unavailable';

  // ─── Control state ────────────────────────────────────────────────────
  /** armed = actively sending driving commands; default armed */
  const [armed, setArmed]         = useState(true);
  const [throttle, setThrottle]   = useState(0);
  const [brake, setBrake]         = useState(0);
  const [nitro, setNitro]         = useState(false);
  const [handbrake, setHandbrake] = useState(false);

  // Steering Control Mode: 'tilt' (default) or 'slider' (optional fallback)
  const [controlMode, setControlMode]         = useState<'tilt' | 'slider'>('tilt');
  const [touchSteering, setTouchSteering]     = useState(0);
  const [autoCenterSlider, setAutoCenterSlider] = useState(true);

  // ─── UI state ─────────────────────────────────────────────────────────
  const [showCalibFlow, setShowCalibFlow]     = useState(false);
  const [showSettings, setShowSettings]       = useState(false);
  const [showDebugPanel, setShowDebugPanel]   = useState(false);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [profile, setProfile]                 = useState<ControlProfile>('smooth');

  const { requestLock } = useWakeLock();

  // ─── Telemetry ────────────────────────────────────────────────────────
  const [telemetry, setTelemetry] = useState<GameTelemetry>({
    speedKmh: 0, gear: 1, rpm: 1000, nitroRemaining: 100,
    currentLap: 1, totalLaps: 3, lapTimeSeconds: 0,
    bestLapTimeSeconds: 0, checkpointProgress: 0,
  });

  // ─── Derived values ───────────────────────────────────────────────────
  // Phone tilt steering is the active DEFAULT. Touch slider is optional fallback.
  const isTiltDriving = controlMode === 'tilt';
  const steering      = isTiltDriving ? sensorOutput.steering : touchSteering;
  const tiltDegrees   = isTiltDriving ? sensorOutput.tiltX : (touchSteering * 35);
  const tiltVector    = {
    x: steering,
    y: sensorAvailable ? Math.max(-1, Math.min(1, sensorOutput.tiltY / 45)) : 0,
  };

  // ─── Haptic helper ────────────────────────────────────────────────────
  const triggerHaptic = (duration = 25) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(duration);
      }
    } catch { /* ignore */ }
  };

  // ─── Profile switching ────────────────────────────────────────────────
  const handleProfileChange = (p: ControlProfile) => {
    setProfile(p);
    sensorProcessor.setProfile(p);
  };

  // ─── Room connection ──────────────────────────────────────────────────
  const handleConnectRoom = useCallback(
    (code: string) => {
      if (!socket || !socket.connected) {
        setJoinError('Cannot connect: Not connected to backend server. Verify local Wi-Fi.');
        return;
      }
      setIsConnecting(true);
      setJoinError(null);
      setDisconnectReason(null);
      setRoomId(code);

      const savedToken = sessionStorage.getItem(`gyroplay_token_${code}`) || undefined;
      const deviceInfo: DeviceInfo = {
        userAgent: navigator.userAgent,
        hasGyroscope: sensorAvailable,
        screen: {
          width: window.innerWidth,
          height: window.innerHeight,
          pixelRatio: window.devicePixelRatio || 1,
        },
      };

      socket.emit('join-room', { roomId: code, role: 'controller', deviceInfo, controllerToken: savedToken }, (res) => {
        setIsConnecting(false);
        if (res.success) {
          setControllerStatus('connected');
          setJoinError(null);
          setArmed(true);
          if (res.controllerToken) {
            sessionStorage.setItem(`gyroplay_token_${code}`, res.controllerToken);
          }
          requestLock();
          // Open calibration immediately on first connect
          if (sensorAvailable) {
            setShowCalibFlow(true);
          }
        } else {
          setControllerStatus('disconnected');
          setJoinError(res.error || 'Failed to join game session.');
        }
      });
    },
    [socket, sensorAvailable, requestLock]
  );

  // Auto-join if room ID is in URL
  useEffect(() => {
    if (!socket || !initialRoomId || controllerStatus === 'connected') return;
    if (socket.connected) handleConnectRoom(initialRoomId);
  }, [socket, initialRoomId, controllerStatus, handleConnectRoom]);

  // ─── Socket events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onTelemetry = (data: GameTelemetry) => setTelemetry(data);
    const onHostDisconnected = (data?: { reason: string }) => {
      setControllerStatus('disconnected');
      setArmed(false);
      setDisconnectReason(data?.reason || 'Desktop host ended the game session.');
    };
    const onErrorMessage = (msg: string) => setJoinError(msg);

    socket.on('telemetry-update', onTelemetry);
    socket.on('host-disconnected', onHostDisconnected);
    socket.on('error-message', onErrorMessage);
    return () => {
      socket.off('telemetry-update', onTelemetry);
      socket.off('host-disconnected', onHostDisconnected);
      socket.off('error-message', onErrorMessage);
    };
  }, [socket]);

  // Reflect socket reconnect/disconnect
  useEffect(() => {
    if (socketStatus === 'reconnecting' && controllerStatus === 'connected') {
      setControllerStatus('reconnecting');
      setArmed(false);
    } else if (socketStatus === 'connected' && controllerStatus === 'reconnecting' && roomId) {
      handleConnectRoom(roomId);
    } else if (socketStatus === 'disconnected' && controllerStatus === 'connected') {
      setControllerStatus('disconnected');
      setArmed(false);
      setDisconnectReason('Lost connection to backend server.');
    }
  }, [socketStatus, controllerStatus, roomId, handleConnectRoom]);

  // ─── 60Hz emission loop (only when armed & connected) ─────────────────
  const seqRef = useRef(1);

  useEffect(() => {
    if (!socket || controllerStatus !== 'connected' || !armed) return;

    const interval = window.setInterval(() => {
      const currentSeq = seqRef.current++;
      // Merge physical tilt-drive with tactile touch triggers
      const effectiveThrottle = Math.max(throttle, sensorOutput.tiltThrottle ?? 0);
      const effectiveBrake = Math.max(brake, sensorOutput.tiltBrake ?? 0);

      const payload = sensorProcessor.createMotionPayload(
        steering,
        tiltDegrees,
        rawAngles.pitch,
        rawAngles.yaw,
        effectiveThrottle,
        effectiveBrake,
        nitro,
        handbrake,
        acceleration,
        currentSeq
      );
      socket.emit('controller-input', payload);
    }, EMIT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, controllerStatus, armed, steering, tiltDegrees, rawAngles, throttle, brake, nitro, handbrake, acceleration, sensorOutput.tiltThrottle, sensorOutput.tiltBrake]);

  // When disarmed, send one final zeroed packet with a sequence number to stop the car safely
  const prevArmedRef = useRef(armed);
  useEffect(() => {
    if (prevArmedRef.current && !armed && socket && controllerStatus === 'connected') {
      const safeSeq = seqRef.current++;
      socket.emit(
        'controller-input',
        sensorProcessor.createMotionPayload(0, 0, 0, 0, 0, 0, false, false, undefined, safeSeq)
      );
    }
    prevArmedRef.current = armed;
  }, [armed, socket, controllerStatus]);

  // ─── Calibration callbacks ────────────────────────────────────────────
  const handleCalibrateZero = useCallback(() => {
    sensorProcessor.calibrateCurrentPosition(rawAngles.roll, rawAngles.pitch, rawAngles.yaw);
    sensorProcessor.resetFilterState();
    triggerHaptic(50);
  }, [rawAngles]);

  const handleCalibrationChange = useCallback((data: CalibrationData) => {
    sensorProcessor.setCalibration(data);
  }, []);

  // ─── Fullscreen ───────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleExitCockpit = () => {
    setArmed(false);
    setControllerStatus('waiting');
    setDisconnectReason(null);
    setJoinError(null);
  };

  // ─── Calibration flow close ───────────────────────────────────────────
  const handleCalibFlowClose = () => {
    setShowCalibFlow(false);
    setArmed(true);
    if (calibrationState !== 'done') {
      cancelCalibration();
    }
  };

  const handleStartRace = (mode: 'race' | 'neonrush' = 'race') => {
    if (socket && socket.connected) {
      socket.emit('game-command', { action: 'start', payload: { mode } });
      triggerHaptic(50);
      soundEngine.playButtonClickSound();
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // LANDING (not yet paired)
  // ─────────────────────────────────────────────────────────────────────
  if (controllerStatus !== 'connected') {
    return (
      <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>
        {disconnectReason && (
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: 'rgba(255, 77, 77, 0.1)',
              borderBottom: '1px solid rgba(255, 77, 77, 0.3)',
              color: '#ff5c5c',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} />
              <span>{disconnectReason}</span>
            </div>
            <button
              onClick={() => setDisconnectReason(null)}
              className="btn-ghost"
              style={{ padding: '2px 6px', fontSize: '0.75rem', color: '#ff5c5c' }}
            >
              Dismiss
            </button>
          </div>
        )}
        <MobileLanding
          initialRoomId={roomId}
          onConnect={handleConnectRoom}
          isConnecting={isConnecting}
          error={joinError}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // COCKPIT (connected)
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div
      id="cockpit"
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 65px)',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 14px',
        gap: '10px',
        touchAction: 'none',
      }}
    >
      {/* ── iOS Permission overlay ── */}
      {needsPermission && (
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(11, 13, 12, 0.96)',
            zIndex: 150,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '28px', textAlign: 'center', gap: '16px',
          }}
        >
          <Smartphone size={48} color="var(--accent-lime)" />
          <h2 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
            MOTION ACCESS REQUIRED
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '280px', lineHeight: 1.5 }}>
            iOS requires your explicit permission to read gyroscope &amp; accelerometer data for steering.
          </p>
          <button
            onClick={requestPermission}
            className="btn-primary"
            style={{ padding: '14px 28px', fontSize: '1rem' }}
          >
            Enable Gyroscope
          </button>
        </div>
      )}

      {/* ── Sensor denied overlay ── */}
      {sensorDenied && !needsPermission && (
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundColor: 'rgba(11, 13, 12, 0.92)',
            zIndex: 150,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '28px', textAlign: 'center', gap: '16px',
          }}
        >
          <AlertTriangle size={44} color="#ffb800" />
          <h2 className="font-display" style={{ fontSize: '1.3rem', color: '#ffb800' }}>
            SENSOR ACCESS DENIED
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '280px', lineHeight: 1.5 }}>
            Gyroscope permission was denied. Reload the page and allow sensor access, or use the touch controls below.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary"
            style={{ borderColor: 'var(--border-lime)' }}
          >
            <RefreshCw size={14} color="var(--accent-lime)" /> Reload Page
          </button>
        </div>
      )}

      {/* ── Calibration flow modal ── */}
      {showCalibFlow && (
        <CalibrationFlow
          calibrationState={calibrationState}
          tiltVector={tiltVector}
          onStart={startCalibration}
          onCancel={() => { cancelCalibration(); setShowCalibFlow(false); }}
          onClose={handleCalibFlowClose}
        />
      )}

      {/* ── Settings / calibration dialog ── */}
      {showSettings && (
        <CalibrationDialog
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onCalibrateZero={handleCalibrateZero}
          onCalibrationChange={handleCalibrationChange}
        />
      )}

      {/* ── Sensor Debug Panel ── */}
      {showDebugPanel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 13, 12, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDebugPanel(false);
          }}
        >
          <div
            className="elevated-panel"
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px',
              border: '1px solid var(--border-lime)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={16} color="var(--accent-lime)" />
                <span style={{ fontSize: '0.82rem', color: 'var(--accent-lime)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  SENSOR DIAGNOSTICS & DEBUG
                </span>
              </div>
              <button onClick={() => setShowDebugPanel(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Status grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', fontSize: '0.72rem' }}>
              <div style={{ background: 'var(--surface-sunken)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>SENSOR AVAILABILITY</div>
                <div style={{ color: sensorAvailable ? 'var(--accent-lime)' : '#ffb800', fontWeight: 600 }}>
                  {availability.toUpperCase()}
                </div>
              </div>
              <div style={{ background: 'var(--surface-sunken)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>CALIBRATION STATE</div>
                <div style={{ color: calibrationState === 'done' ? 'var(--accent-lime)' : 'var(--text-primary)', fontWeight: 600 }}>
                  {calibrationState.toUpperCase()}
                </div>
              </div>
              <div style={{ background: 'var(--surface-sunken)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>SYSTEM ARM STATE</div>
                <div style={{ color: armed ? 'var(--accent-lime)' : '#ff5c5c', fontWeight: 600 }}>
                  {armed ? 'ARMED (ACTIVE)' : 'DISARMED (SAFE 0)'}
                </div>
              </div>
              <div style={{ background: 'var(--surface-sunken)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: '2px' }}>CONTROL PROFILE</div>
                <div style={{ color: 'var(--accent-lime)', fontWeight: 600 }}>
                  {profile.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Raw sensor readings */}
            <div style={{ marginBottom: '14px', background: 'var(--surface-sunken)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-lime)', marginBottom: '6px', fontWeight: 600 }}>
                GYROSCOPE ORIENTATION (EULER ANGLES)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.72rem' }}>
                <div>Roll (γ): <strong style={{ color: 'var(--text-primary)' }}>{rawAngles.roll.toFixed(1)}°</strong></div>
                <div>Pitch (β): <strong style={{ color: 'var(--text-primary)' }}>{rawAngles.pitch.toFixed(1)}°</strong></div>
                <div>Yaw (α): <strong style={{ color: 'var(--text-primary)' }}>{rawAngles.yaw.toFixed(1)}°</strong></div>
              </div>
            </div>

            {/* Accelerometer & Gyro Rate */}
            <div style={{ marginBottom: '14px', background: 'var(--surface-sunken)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-lime)', marginBottom: '6px', fontWeight: 600 }}>
                ACCELEROMETER & ROTATION RATE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.72rem', marginBottom: '6px' }}>
                <div>Ax: <strong style={{ color: 'var(--text-primary)' }}>{acceleration.x.toFixed(2)}</strong></div>
                <div>Ay: <strong style={{ color: 'var(--text-primary)' }}>{acceleration.y.toFixed(2)}</strong></div>
                <div>Az: <strong style={{ color: 'var(--text-primary)' }}>{acceleration.z.toFixed(2)}</strong></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.72rem' }}>
                <div>dα/dt: <strong style={{ color: 'var(--text-primary)' }}>{rotationRate.alpha.toFixed(1)}°/s</strong></div>
                <div>dβ/dt: <strong style={{ color: 'var(--text-primary)' }}>{rotationRate.beta.toFixed(1)}°/s</strong></div>
                <div>dγ/dt: <strong style={{ color: 'var(--text-primary)' }}>{rotationRate.gamma.toFixed(1)}°/s</strong></div>
              </div>
            </div>

            {/* Calibrated Center */}
            <div style={{ marginBottom: '14px', background: 'var(--surface-sunken)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-lime)', marginBottom: '6px', fontWeight: 600 }}>
                CALIBRATED CENTER & SENSITIVITY
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.72rem', marginBottom: '6px' }}>
                <div>Center X: <strong style={{ color: 'var(--text-primary)' }}>{sensorProcessor.getCalibration().offsetX.toFixed(1)}°</strong></div>
                <div>Center Y: <strong style={{ color: 'var(--text-primary)' }}>{sensorProcessor.getCalibration().offsetY.toFixed(1)}°</strong></div>
                <div>Center Z: <strong style={{ color: 'var(--text-primary)' }}>{sensorProcessor.getCalibration().offsetZ.toFixed(1)}°</strong></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.72rem' }}>
                <div>Deadzone: <strong style={{ color: 'var(--text-primary)' }}>{(sensorProcessor.getCalibration().deadzone * 100).toFixed(0)}%</strong></div>
                <div>Sens: <strong style={{ color: 'var(--text-primary)' }}>{sensorProcessor.getCalibration().sensitivity.toFixed(1)}x</strong></div>
                <div>Invert: <strong style={{ color: 'var(--text-primary)' }}>{sensorProcessor.getCalibration().invertSteering ? 'ON' : 'OFF'}</strong></div>
              </div>
            </div>

            {/* Normalized Output Values */}
            <div style={{ marginBottom: '14px', background: 'var(--surface-sunken)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-lime)', marginBottom: '6px', fontWeight: 600 }}>
                NORMALIZED OUTPUTS ([-1, 1] / [0, 1])
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.72rem' }}>
                <div>Steering: <strong style={{ color: steering === 0 ? 'var(--text-secondary)' : 'var(--accent-lime)' }}>{steering.toFixed(3)}</strong></div>
                <div>Throttle: <strong style={{ color: throttle > 0 ? 'var(--accent-lime)' : 'var(--text-secondary)' }}>{throttle.toFixed(2)}</strong></div>
                <div>Brake: <strong style={{ color: brake > 0 ? '#ff5c5c' : 'var(--text-secondary)' }}>{brake.toFixed(2)}</strong></div>
                <div>Nitro: <strong style={{ color: nitro ? 'var(--accent-lime)' : 'var(--text-secondary)' }}>{nitro ? 'ACTIVE' : 'OFF'}</strong></div>
              </div>
            </div>

            <button
              onClick={() => setShowDebugPanel(false)}
              className="btn-primary"
              style={{ width: '100%', padding: '8px', fontSize: '0.75rem' }}
            >
              Close Diagnostics
            </button>
          </div>
        </div>
      )}

      {/* ─── TOP BAR ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Left actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              handleExitCockpit();
            }}
            className="btn-ghost"
            style={{ padding: '8px 10px', minHeight: '42px', minWidth: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Leave cockpit"
          >
            <ArrowLeft size={16} />
          </button>

          {sensorAvailable && (
            <>
              <button
                onClick={() => {
                  soundEngine.playButtonClickSound();
                  recalibrate();
                  setShowCalibFlow(true);
                }}
                className="btn-secondary"
                style={{ padding: '6px 12px', minHeight: '42px', fontSize: '0.72rem', gap: '6px' }}
              >
                <RefreshCw size={12} color="var(--accent-lime)" />
                Recalibrate
              </button>
              <button
                onClick={() => {
                  soundEngine.playButtonClickSound();
                  handleCalibrateZero();
                }}
                className="btn-secondary"
                style={{ padding: '6px 12px', minHeight: '42px', fontSize: '0.72rem', gap: '6px' }}
                title="Instantly set current angle as 0°"
              >
                Reset 0°
              </button>
            </>
          )}

          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              setShowSettings(true);
            }}
            className="btn-ghost"
            style={{ padding: '8px 10px', minHeight: '42px', minWidth: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Sensor settings"
            title="Sensor Settings"
          >
            <Settings2 size={16} />
          </button>

          <button
            onClick={() => {
              soundEngine.playButtonClickSound();
              setShowDebugPanel((v) => !v);
            }}
            className="btn-ghost"
            style={{
              padding: '8px 10px',
              minHeight: '42px',
              minWidth: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: showDebugPanel ? 'var(--accent-lime)' : 'var(--text-tertiary)',
            }}
            aria-label="Sensor debug panel"
            title="Sensor Diagnostics"
          >
            <Terminal size={16} />
          </button>
        </div>

        {/* Right: status + fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Latency badge */}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: latency < 30 ? 'var(--accent-lime)' : latency < 80 ? '#ffb800' : '#ff5c5c',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 8px',
            }}
          >
            {latency}ms
          </div>
          <ConnectionStatusBadge status={controllerStatus} latency={latency} compact={true} />
          <button onClick={toggleFullscreen} className="btn-ghost" style={{ padding: '6px' }}>
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      </div>

      {/* ─── SENSOR STATUS BANNER ────────────────────────────────────── */}
      {sensorMissing && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(255, 184, 0, 0.08)',
            border: '1px solid rgba(255, 184, 0, 0.25)',
            color: '#ffb800', fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <AlertTriangle size={13} />
          <span>Gyroscope unavailable — using touch controls below</span>
        </div>
      )}

      {/* ─── STEERING MODE & PROFILE SELECTOR ────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Primary Mode Pill: Tilt (Default) vs Slider (Fallback) */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--surface-sunken)',
            padding: '3px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            gap: '4px',
          }}
        >
          <button
            onClick={() => {
              setControlMode('tilt');
              triggerHaptic(20);
              soundEngine.playButtonClickSound();
            }}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              border: controlMode === 'tilt' ? '1px solid var(--border-lime)' : '1px solid transparent',
              backgroundColor: controlMode === 'tilt' ? 'rgba(255, 42, 58, 0.18)' : 'transparent',
              color: controlMode === 'tilt' ? 'var(--accent-lime)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📱</span>
            <span>TILT STEERING (DEFAULT)</span>
          </button>
          <button
            onClick={() => {
              setControlMode('slider');
              triggerHaptic(20);
              soundEngine.playButtonClickSound();
            }}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              border: controlMode === 'slider' ? '1px solid var(--border-lime)' : '1px solid transparent',
              backgroundColor: controlMode === 'slider' ? 'rgba(255, 42, 58, 0.18)' : 'transparent',
              color: controlMode === 'slider' ? 'var(--accent-lime)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🕹️</span>
            <span>SLIDER FALLBACK</span>
          </button>
        </div>

        {/* Filter Profiles & Quick Calibration for Tilt Mode */}
        {controlMode === 'tilt' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {(['smooth', 'precision'] as ControlProfile[]).map((p) => (
              <button
                key={p}
                onClick={() => handleProfileChange(p)}
                className={profile === p ? 'btn-primary' : 'btn-secondary'}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {p === 'smooth' ? '🟢 SMOOTH (ANTI-JITTER)' : '🔵 PRECISION (SNAPPY)'}
              </button>
            ))}
            {sensorAvailable && (
              <button
                onClick={handleCalibrateZero}
                className="btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.66rem',
                  borderColor: 'var(--border-lime)',
                  color: 'var(--accent-lime)',
                  whiteSpace: 'nowrap',
                }}
                title="Hold phone comfortably and tap to center"
              >
                🎯 Set Neutral 0°
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── CENTER COCKPIT ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '16px',
          flex: 1,
        }}
      >
        {/* Speed telemetry */}
        <div
          className="elevated-panel"
          style={{ padding: '10px 14px', textAlign: 'center', minWidth: '80px' }}
        >
          <div
            className="font-display"
            style={{ fontSize: '2.1rem', fontWeight: 700, lineHeight: 1, color: 'var(--accent-lime)' }}
          >
            {telemetry.speedKmh}
          </div>
          <div style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            KM / H
          </div>
          <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600, marginTop: '3px' }}>
            G {telemetry.gear}
          </div>
        </div>

        {/* Steering wheel visualizer */}
        <SteeringVisualizer steering={steering} tiltDegrees={tiltDegrees} />

        {/* Boost + Lap */}
        <div
          className="elevated-panel"
          style={{ padding: '10px 14px', textAlign: 'center', minWidth: '80px' }}
        >
          <div style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            BOOST
          </div>
          <div
            className="font-mono"
            style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-lime)' }}
          >
            {telemetry.nitroRemaining}%
          </div>
          <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: '3px' }}>
            LAP {telemetry.currentLap}/{telemetry.totalLaps}
          </div>
        </div>
      </div>

      {/* ─── LIVE DATA STRIP ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', gap: '8px',
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          justifyContent: 'center',
        }}
      >
        <span>
          STR <strong style={{ color: 'var(--accent-lime)' }}>
            {steering >= 0 ? `+${steering.toFixed(2)}` : steering.toFixed(2)}
          </strong>
        </span>
        <span>·</span>
        <span>
          TILT <strong style={{ color: 'var(--text-primary)' }}>{tiltDegrees.toFixed(1)}°</strong>
        </span>
        <span>·</span>
        <span>
          <Activity size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
          {' '}
          {sensorAvailable ? (
            <span style={{ color: 'var(--accent-lime)' }}>GYRO</span>
          ) : (
            <span style={{ color: '#ffb800' }}>TOUCH</span>
          )}
        </span>
        {sensorAvailable && (
          <>
            <span>·</span>
            <span>
              {(sensorOutput.tiltThrottle ?? 0) > 0.08 ? (
                <span style={{ color: 'var(--accent-lime)', fontWeight: 700 }}>
                  TILT GAS {Math.round((sensorOutput.tiltThrottle ?? 0) * 100)}%
                </span>
              ) : (sensorOutput.tiltBrake ?? 0) > 0.08 ? (
                <span style={{ color: '#ff5c5c', fontWeight: 700 }}>
                  TILT BRAKE {Math.round((sensorOutput.tiltBrake ?? 0) * 100)}%
                </span>
              ) : (
                <span style={{ color: 'var(--text-tertiary)' }}>TILT: LEVEL</span>
              )}
            </span>
          </>
        )}
      </div>

      {/* ─── TILT MODE: CLEAN CALIBRATION BUTTON (NO TURNING SLIDERS OR CLUTTER) ── */}
      {controlMode === 'tilt' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
          <button
            onClick={() => {
              handleCalibrateZero();
              triggerHaptic(30);
              soundEngine.playButtonClickSound();
            }}
            className="btn-secondary"
            style={{
              flex: 1,
              padding: '9px 14px',
              fontSize: '0.74rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              borderColor: 'var(--border-lime)',
              color: 'var(--accent-lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: 'rgba(255, 42, 58, 0.08)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            <span>🎯</span>
            <span>CALIBRATE NEUTRAL (0°)</span>
          </button>
          {!sensorAvailable && (
            <button
              onClick={() => {
                requestPermission();
                triggerHaptic(40);
              }}
              style={{
                flex: 1,
                padding: '9px 14px',
                fontSize: '0.74rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                border: '1.5px solid var(--accent-lime)',
                backgroundColor: 'rgba(255, 42, 58, 0.2)',
                color: 'var(--accent-lime)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <span>⚡</span>
              <span>ACTIVATE GYRO</span>
            </button>
          )}
        </div>
      )}

      {/* ─── TOUCH FALLBACK SLIDER (ONLY when user explicitly chooses slider fallback mode) ── */}
      {controlMode === 'slider' && (
        <div
          style={{
            backgroundColor: 'var(--surface-sunken)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)', fontWeight: 600 }}>
              🕹️ TOUCH STEERING SLIDER
            </span>
            <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 700 }}>
              {touchSteering > 0 ? `+${(touchSteering * 100).toFixed(0)}% RIGHT` : touchSteering < 0 ? `${(touchSteering * 100).toFixed(0)}% LEFT` : 'CENTER (0%)'}
            </span>
            <button
              onClick={() => setAutoCenterSlider((v) => !v)}
              style={{
                fontSize: '0.62rem',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: autoCenterSlider ? 'rgba(255, 42, 58, 0.15)' : 'transparent',
                color: autoCenterSlider ? 'var(--accent-lime)' : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              Spring: {autoCenterSlider ? 'ON' : 'OFF'}
            </button>
          </div>

          <input
            type="range"
            min="-1"
            max="1"
            step="0.02"
            value={touchSteering}
            onChange={(e) => setTouchSteering(parseFloat(e.target.value))}
            onTouchEnd={() => {
              if (autoCenterSlider) setTouchSteering(0);
            }}
            onMouseUp={() => {
              if (autoCenterSlider) setTouchSteering(0);
            }}
            style={{ width: '100%', accentColor: 'var(--accent-lime)', height: '28px', cursor: 'pointer' }}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => { setTouchSteering(-0.8); triggerHaptic(20); }}
              className="btn-secondary"
              style={{ flex: 1, padding: '4px', fontSize: '0.68rem' }}
            >
              ◀ Steer Left
            </button>
            <button
              onClick={() => { setTouchSteering(0); triggerHaptic(20); }}
              className="btn-secondary"
              style={{ flex: 1, padding: '4px', fontSize: '0.68rem', borderColor: 'var(--border-lime)', color: 'var(--accent-lime)' }}
            >
              ● Center (0°)
            </button>
            <button
              onClick={() => { setTouchSteering(0.8); triggerHaptic(20); }}
              className="btn-secondary"
              style={{ flex: 1, padding: '4px', fontSize: '0.68rem' }}
            >
              Steer Right ▶
            </button>
          </div>
        </div>
      )}

      {/* ─── START / RESTART RACE BUTTONS ─── */}
      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
        <button
          onClick={() => handleStartRace('race')}
          style={{
            flex: 1,
            padding: '11px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--border-lime)',
            backgroundColor: 'rgba(255, 42, 58, 0.16)',
            color: 'var(--accent-lime)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 0 12px rgba(255, 42, 58, 0.15)',
          }}
        >
          <Flag size={15} /> START RACE
        </button>
        <button
          onClick={() => handleStartRace('neonrush')}
          style={{
            flex: 1,
            padding: '11px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid #ff007f',
            backgroundColor: 'rgba(255, 0, 127, 0.14)',
            color: '#ff007f',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 0 12px rgba(255, 0, 127, 0.15)',
          }}
        >
          <Zap size={15} /> NEON RUSH
        </button>
      </div>

      {/* ─── ARM / DISARM CONTROL ────────────────────────────────────── */}
      <button
        id="arm-button"
        onClick={() => {
          soundEngine.playButtonClickSound();
          const next = !armed;
          setArmed(next);
          triggerHaptic(next ? 60 : 30);
          // Prompt calibration if arming for the first time with sensor available
          if (next && sensorAvailable && calibrationState === 'idle') {
            setShowCalibFlow(true);
          }
        }}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 'var(--radius-lg)',
          border: `2px solid ${armed ? '#ff5c5c' : 'var(--border-lime)'}`,
          backgroundColor: armed ? 'rgba(255, 92, 92, 0.12)' : 'var(--accent-lime-dim)',
          color: armed ? '#ff5c5c' : 'var(--accent-lime)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '1rem',
          letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: armed ? '0 0 20px rgba(255, 92, 92, 0.2)' : '0 0 16px rgba(255, 42, 58, 0.12)',
        }}
      >
        {armed ? <ShieldOff size={18} /> : <Shield size={18} />}
        {armed ? 'DISARM CONTROLS' : 'ARM CONTROLS'}
      </button>

      {/* ─── GAS / BRAKE / DRIFT / NITRO ────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          height: '120px',
        }}
      >
        {/* Left: DRIFT + BRAKE */}
        <div style={{ display: 'flex', gap: '6px', height: '100%' }}>
          <button
            onPointerDown={() => { setHandbrake(true); triggerHaptic(30); }}
            onPointerUp={() => setHandbrake(false)}
            onPointerLeave={() => setHandbrake(false)}
            onPointerCancel={() => setHandbrake(false)}
            disabled={!armed}
            className="font-mono"
            style={{
              flex: '0 0 58px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              backgroundColor: handbrake ? 'var(--surface-hover)' : 'var(--surface-elevated)',
              color: handbrake ? 'var(--accent-lime)' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '0.68rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: armed ? 'pointer' : 'not-allowed',
              opacity: armed ? 1 : 0.45,
              touchAction: 'none',
            }}
          >
            DRIFT
          </button>
          <button
            onPointerDown={() => { setBrake(1.0); triggerHaptic(40); }}
            onPointerUp={() => setBrake(0)}
            onPointerLeave={() => setBrake(0)}
            onPointerCancel={() => setBrake(0)}
            disabled={!armed}
            className="font-display"
            style={{
              flex: 1,
              borderRadius: 'var(--radius-lg)',
              border: `1.5px solid ${brake > 0 ? '#ff5c5c' : 'var(--border-medium)'}`,
              backgroundColor: brake > 0 ? 'rgba(255, 92, 92, 0.18)' : 'var(--surface-elevated)',
              color: brake > 0 ? '#ff5c5c' : 'var(--text-primary)',
              fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: brake > 0 ? 'scale(0.97)' : 'scale(1)',
              transition: 'all 0.08s ease',
              cursor: armed ? 'pointer' : 'not-allowed',
              opacity: armed ? 1 : 0.45,
              touchAction: 'none',
            }}
          >
            BRAKE
          </button>
        </div>

        {/* Right: GAS + NITRO */}
        <div style={{ display: 'flex', gap: '6px', height: '100%' }}>
          <button
            onPointerDown={() => { setThrottle(1.0); triggerHaptic(20); }}
            onPointerUp={() => setThrottle(0)}
            onPointerLeave={() => setThrottle(0)}
            onPointerCancel={() => setThrottle(0)}
            disabled={!armed}
            className="font-display"
            style={{
              flex: 1,
              borderRadius: 'var(--radius-lg)',
              border: `1.5px solid ${throttle > 0 ? 'var(--accent-lime)' : 'var(--border-medium)'}`,
              backgroundColor: throttle > 0 ? 'rgba(255, 42, 58, 0.18)' : 'var(--surface-elevated)',
              color: throttle > 0 ? 'var(--accent-lime)' : 'var(--text-primary)',
              fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: throttle > 0 ? '0 0 18px rgba(255, 42, 58, 0.3)' : 'none',
              transform: throttle > 0 ? 'scale(0.97)' : 'scale(1)',
              transition: 'all 0.08s ease',
              cursor: armed ? 'pointer' : 'not-allowed',
              opacity: armed ? 1 : 0.45,
              touchAction: 'none',
            }}
          >
            GAS
          </button>
          <button
            onPointerDown={() => { setNitro(true); triggerHaptic(55); soundEngine.playNitroSound(); }}
            onPointerUp={() => setNitro(false)}
            onPointerLeave={() => setNitro(false)}
            onPointerCancel={() => setNitro(false)}
            disabled={!armed}
            className="font-mono"
            style={{
              flex: '0 0 62px',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${nitro ? 'var(--accent-lime)' : 'var(--border-lime)'}`,
              backgroundColor: nitro ? 'var(--accent-lime)' : 'var(--accent-lime-subtle)',
              color: nitro ? '#0B0D0C' : 'var(--accent-lime)',
              fontWeight: 700, fontSize: '0.68rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
              cursor: armed ? 'pointer' : 'not-allowed',
              opacity: armed ? 1 : 0.45,
              boxShadow: nitro ? '0 0 20px var(--accent-lime-glow)' : 'none',
              touchAction: 'none',
            }}
          >
            <Zap size={15} />
            BOOST
          </button>
        </div>
      </div>
    </div>
  );
};
