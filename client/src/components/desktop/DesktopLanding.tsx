import React, { useState, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import {
  Play,
  Smartphone,
  Copy,
  Check,
  X,
  Wifi,
  ShieldAlert,
  Edit2,
  RefreshCw,
  CheckCircle2,
  Download,
} from 'lucide-react';
import type {
  RoomState,
  ConnectionStatus,
  NetworkInterfaceInfo,
  ClientToServerEvents,
  ServerToClientEvents,
  MotionData,
} from '@shared/types';
import { TrackPreview } from './TrackPreview';
import { PhoneMotionIllustration } from './PhoneMotionIllustration';
import { ConnectionStatusBadge } from '../common/ConnectionStatusBadge';
import { MotionSignature, MotionSignatureInput } from '../common/MotionSignature';
import { soundEngine } from '../../logic/game/audio';

interface DesktopLandingProps {
  roomId: string;
  pairUrl: string;
  roomState: RoomState | null;
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  serverErrorMessage: string | null;
  latency: number;
  availableIps?: NetworkInterfaceInfo[];
  socket?: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  onCustomHostChange?: (host: string) => void;
  onLaunchRace: () => void;
  onSoloTest: () => void;
  onRefreshRoom: () => void;
}

export const DesktopLanding: React.FC<DesktopLandingProps> = ({
  roomId,
  pairUrl,
  roomState,
  connectionStatus,
  reconnectAttempt,
  serverErrorMessage,
  latency,
  availableIps = [],
  socket,
  onCustomHostChange,
  onLaunchRace,
  onSoloTest,
  onRefreshRoom,
}) => {
  const [showPairModal, setShowPairModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [customIpInput, setCustomIpInput] = useState('');
  const [liveMotion, setLiveMotion] = useState<MotionSignatureInput | undefined>(undefined);
  const prevConnectedRef = useRef(false);

  // Subscribe to live motion-update packets to animate Motion Signature on desktop
  useEffect(() => {
    if (!socket) return;
    const onMotion = (payload: MotionData) => {
      setLiveMotion({
        x: payload.steering,
        y: Math.max(-1, Math.min(1, (payload.tiltX || 0) / 35)),
      });
    };
    socket.on('motion-update', onMotion);
    return () => {
      socket.off('motion-update', onMotion);
    };
  }, [socket]);

  // Audio feedback when controller successfully links
  useEffect(() => {
    const isConn = !!roomState?.controllerConnected;
    if (isConn && !prevConnectedRef.current) {
      soundEngine.playPairingSound();
    }
    prevConnectedRef.current = isConn;
  }, [roomState?.controllerConnected]);

  // Extract host IP from current pairUrl
  useEffect(() => {
    try {
      if (pairUrl) {
        const parsed = new URL(pairUrl);
        setCustomIpInput(parsed.protocol.startsWith('https') ? parsed.origin : parsed.hostname);
      }
    } catch {
      // ignore
    }
  }, [pairUrl]);

  const handleCopy = () => {
    if (!pairUrl) return;
    soundEngine.playButtonClickSound();
    navigator.clipboard.writeText(pairUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCustomHost = (host: string) => {
    if (!host.trim()) return;
    soundEngine.playButtonClickSound();
    onCustomHostChange?.(host.trim());
    setShowNetworkSettings(false);
  };

  const isControllerConfirmed = connectionStatus === 'connected' && !!roomState?.controllerConnected;


  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '36px 28px 60px',
        display: 'flex',
        flexDirection: 'column',
        gap: '44px',
      }}
    >
      {/* Server Reconnection / Error Banner */}
      {connectionStatus === 'reconnecting' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(255, 184, 0, 0.1)',
            border: '1px solid rgba(255, 184, 0, 0.35)',
            color: '#ffb800',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={15} className="animate-spin" />
            <span>
              Reconnecting to backend server... (Attempt {reconnectAttempt}/10)
              {serverErrorMessage ? ` • ${serverErrorMessage}` : ''}
            </span>
          </div>
          <button
            onClick={onRefreshRoom}
            className="btn-ghost"
            style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#ffb800' }}
          >
            Retry Now
          </button>
        </div>
      )}

      {connectionStatus === 'disconnected' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(255, 77, 77, 0.1)',
            border: '1px solid rgba(255, 77, 77, 0.35)',
            color: '#ff5c5c',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={16} />
            <span>
              Backend server connection lost. Verify that the server is running on port 3001.
            </span>
          </div>
          <button
            onClick={onRefreshRoom}
            className="btn-ghost"
            style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#ff5c5c' }}
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 1.25fr) minmax(260px, 0.75fr)',
          gap: '40px',
          alignItems: 'center',
        }}
      >
        {/* Left Column: Headline, Subtitle, Actions, and Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status Indicator */}
          <div>
            <ConnectionStatusBadge
              status={connectionStatus}
              latency={latency}
              roomId={roomId}
              deviceInfoName={roomState?.controllerInfo?.userAgent?.includes('iPhone') ? 'iPhone' : roomState?.controllerInfo?.userAgent?.includes('Android') ? 'Android' : undefined}
              reconnectAttempt={reconnectAttempt}
              onClick={() => setShowPairModal(true)}
            />
          </div>

          {/* Main Hero Headlines */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--accent-lime)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}
            >
              GYRO//PLAY • MOTION ENGINE V1.0
            </div>
            <h1
              className="font-display"
              style={{
                fontSize: 'clamp(2.8rem, 5.5vw, 4.4rem)',
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
                marginBottom: '16px',
              }}
            >
              No buttons. <br />
              <span style={{ color: 'var(--accent-lime)' }}>Just motion.</span>
            </h1>
            <p
              style={{
                fontSize: '1.18rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                maxWidth: '520px',
              }}
            >
              Turn your phone into a precision motion controller.
            </p>
          </div>

          {/* Call-to-Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                onLaunchRace();
              }}
              className="btn-primary"
              style={{ padding: '14px 28px', fontSize: '1rem' }}
            >
              <Play size={18} fill="#0B0D0C" />
              {isControllerConfirmed ? 'Launch Race (Phone Ready)' : 'Launch Race'}
            </button>

            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                setShowPairModal(true);
              }}
              className="btn-secondary"
              style={{
                padding: '14px 24px',
                fontSize: '1rem',
                borderColor: isControllerConfirmed ? 'var(--border-lime)' : 'var(--border-medium)',
              }}
            >
              <Smartphone size={18} color="var(--accent-lime)" />
              {isControllerConfirmed ? 'View Connected Phone' : 'Connect Controller'}
            </button>

            <a
              href="/gyroplay.apk"
              download="gyroplay.apk"
              className="btn-secondary"
              style={{
                padding: '14px 20px',
                fontSize: '0.92rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderColor: 'var(--border-lime)',
                color: 'var(--accent-lime)',
                backgroundColor: 'rgba(255, 42, 58, 0.08)',
              }}
              title="Download compiled native Android APK package (104 MB)"
            >
              <Download size={17} />
              Download Android APK
            </a>

            <button
              onClick={() => {
                soundEngine.playButtonClickSound();
                onSoloTest();
              }}
              className="btn-ghost"
              style={{ fontSize: '0.85rem' }}
              title="Test drive with WASD/Arrow keys"
            >
              Keyboard Solo Mode →
            </button>
          </div>
        </div>

        {/* Right Column: Live Motion Signature Telemetry Reticle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--surface-elevated)',
            border: isControllerConfirmed ? '1px solid var(--border-lime)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            position: 'relative',
            boxShadow: isControllerConfirmed ? '0 12px 32px rgba(255, 42, 58, 0.12)' : 'none',
            transition: 'border-color var(--transition-normal), box-shadow var(--transition-normal)',
          }}
        >
          <MotionSignature
            size={200}
            value={isControllerConfirmed ? liveMotion : undefined}
            label={isControllerConfirmed ? 'LIVE PHONE TILT // 60HZ STREAM' : 'MOTION SIGNATURE // TEST MATRIX'}
            showValues={true}
            interactive={!isControllerConfirmed}
          />
          <div
            style={{
              marginTop: '14px',
              fontSize: '0.72rem',
              color: isControllerConfirmed ? 'var(--accent-lime)' : 'var(--text-tertiary)',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {isControllerConfirmed
              ? 'Receiving 60Hz live motion packets from paired smartphone'
              : 'Hover or drag mouse to simulate tilt vectors'}
          </div>
        </div>
      </section>

      {/* Visual Previews Section: Racing Track & Tilted Phone Illustration */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        <TrackPreview />
        <PhoneMotionIllustration />
      </section>

      {/* Pairing Modal / Dialog */}
      {showPairModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 13, 12, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
            overflowY: 'auto',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPairModal(false);
          }}
        >
          <div
            className="elevated-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '32px',
              border: '1px solid var(--border-medium)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowPairModal(false)}
              className="btn-ghost"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                padding: '6px',
              }}
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: 'var(--accent-lime)',
                  marginBottom: '6px',
                }}
              >
                DEVICE PAIRING PROTOCOL
              </div>
              <h2 className="font-display" style={{ fontSize: '1.6rem', fontWeight: 700 }}>
                {isControllerConfirmed ? 'Controller Connected!' : 'Pair Your Smartphone'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
                {isControllerConfirmed
                  ? 'Your motion controller is confirmed linked to this race session.'
                  : 'Scan the QR code below or visit the URL on your mobile phone.'}
              </p>
            </div>

            {/* If Confirmed Connected */}
            {isControllerConfirmed ? (
              <div
                style={{
                  padding: '24px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-lime)',
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-lime)' }}>
                  <CheckCircle2 size={20} />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    Active Motion Link Established
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Connected device: <strong style={{ color: 'var(--text-primary)' }}>{roomState?.controllerInfo?.userAgent?.slice(0, 50) || 'Mobile Web Controller'}</strong>
                </div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  Latency: <strong style={{ color: 'var(--accent-lime)' }}>{latency} ms</strong> • Room: <strong style={{ color: 'var(--accent-lime)' }}>{roomId}</strong>
                </div>
              </div>
            ) : (
              <>
                {/* QR Code Container */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    backgroundColor: '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '20px',
                    boxShadow: '0 0 32px rgba(255, 42, 58, 0.2)',
                  }}
                >
                  {pairUrl ? (
                    <QRCodeSVG
                      value={pairUrl}
                      size={190}
                      level="M"
                      fgColor="#0B0D0C"
                      bgColor="#ffffff"
                    />
                  ) : (
                    <div style={{ height: '190px', display: 'flex', alignItems: 'center', color: '#0B0D0C' }}>
                      Generating Reachable QR...
                    </div>
                  )}
                </div>

                {/* Room Code Display */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      MANUAL ROOM CODE
                    </div>
                    <div
                      className="font-display"
                      style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-lime)', letterSpacing: '0.1em' }}
                    >
                      {roomId || '----'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <ConnectionStatusBadge
                      status={connectionStatus}
                      latency={latency}
                      reconnectAttempt={reconnectAttempt}
                      compact={true}
                    />
                  </div>
                </div>

                {/* Reachable URL Box with Copy */}
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <input
                    type="text"
                    readOnly
                    value={pairUrl || ''}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleCopy}
                    className="btn-secondary"
                    style={{ padding: '10px 16px', fontSize: '0.8rem' }}
                  >
                    {copied ? <Check size={14} color="var(--accent-lime)" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {/* Direct APK Download Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 42, 58, 0.08)',
                    border: '1px solid var(--border-lime)',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Download size={16} color="var(--accent-lime)" />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      Prefer a native Android App?
                    </span>
                  </div>
                  <a
                    href="/gyroplay.apk"
                    download="gyroplay.apk"
                    style={{
                      fontSize: '0.74rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-lime)',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Download APK (104 MB) ↓
                  </a>
                </div>
              </>
            )}

            {/* Network Requirements & Wi-Fi Diagnostic Accordion */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '20px',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <Wifi size={14} color="var(--accent-lime)" />
                  <span>Networking & Wi-Fi Requirements</span>
                </div>
                <button
                  onClick={() => setShowNetworkSettings(!showNetworkSettings)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-lime)',
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Edit2 size={12} />
                  {showNetworkSettings ? 'Hide Options' : 'Configure IP'}
                </button>
              </div>

              <div>
                • <strong>Same Wi-Fi Network:</strong> Your smartphone and laptop must be connected to the exact same Wi-Fi router.
              </div>
              <div>
                • <strong>Firewall & Ports:</strong> Ensure your OS firewall allows incoming traffic on port <strong>5173</strong> (Web Client/Proxy) and <strong>3001</strong> (WebSocket Server).
              </div>

              {/* IP Selection / Custom Override */}
              {showNetworkSettings && (
                <div
                  style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Detected Network Interfaces on Host:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {availableIps.map((iface) => (
                      <button
                        key={`${iface.name}-${iface.address}`}
                        onClick={() => handleApplyCustomHost(iface.address)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-mono)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: customIpInput === iface.address ? 'var(--accent-lime-dim)' : 'var(--surface-subtle)',
                          color: customIpInput === iface.address ? 'var(--accent-lime)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {iface.name}: {iface.address}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <input
                      type="text"
                      placeholder="Custom IP or Domain"
                      value={customIpInput}
                      onChange={(e) => setCustomIpInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: 'var(--surface-subtle)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => handleApplyCustomHost(customIpInput)}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                    >
                      Apply IP
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  soundEngine.playButtonClickSound();
                  setShowPairModal(false);
                  onLaunchRace();
                }}
                className="btn-primary"
                style={{ flex: 1, padding: '12px' }}
              >
                {isControllerConfirmed ? 'Enter Cockpit & Race' : 'Start Race'}
              </button>
              <button
                onClick={() => {
                  soundEngine.playButtonClickSound();
                  setShowPairModal(false);
                }}
                className="btn-secondary"
                style={{ padding: '12px 20px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
