import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, CheckCircle2, Play, Copy, Check, Radio } from 'lucide-react';
import type { RoomState } from '@shared/types';
import { Badge } from '../common/Badge';

interface DesktopLobbyProps {
  roomId: string;
  pairUrl: string;
  roomState: RoomState | null;
  onLaunchGame: () => void;
  onSoloTest: () => void;
}

export const DesktopLobby: React.FC<DesktopLobbyProps> = ({
  roomId,
  pairUrl,
  roomState,
  onLaunchGame,
  onSoloTest,
}) => {
  const [copied, setCopied] = useState(false);
  const isControllerConnected = roomState?.controllerConnected;

  const handleCopy = () => {
    if (!pairUrl) return;
    navigator.clipboard.writeText(pairUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        maxWidth: '1000px',
        margin: '0 auto',
        minHeight: 'calc(100vh - 80px)',
      }}
    >
      {/* Title & Tagline */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1
          className="font-display"
          style={{
            fontSize: '2.5rem',
            fontWeight: 900,
            letterSpacing: '0.06em',
            marginBottom: '8px',
          }}
        >
          PAIR YOUR <span className="text-cyan">PHONE</span> TO PLAY
        </h1>
        <p style={{ color: '#8b9bb4', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
          Scan the QR code with your smartphone camera. Your phone becomes your precision steering wheel and throttle.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          width: '100%',
        }}
      >
        {/* Left Column: QR Code & Connection Link */}
        <div
          className="glass-panel"
          style={{
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
            <Badge variant={isControllerConnected ? 'lime' : 'cyan'} pulse={!isControllerConnected}>
              <Radio size={12} />
              {isControllerConnected ? 'PAIRED' : 'AWAITING PHONE'}
            </Badge>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 0 30px rgba(0, 240, 255, 0.35)',
              marginBottom: '20px',
              marginTop: '12px',
            }}
          >
            {pairUrl ? (
              <QRCodeSVG
                value={pairUrl}
                size={200}
                level="M"
                includeMargin={false}
              />
            ) : (
              <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                Generating QR...
              </div>
            )}
          </div>

          {/* Room Code */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: '#8b9bb4', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Room Code
            </div>
            <div
              className="font-display text-cyan"
              style={{
                fontSize: '2.4rem',
                fontWeight: 900,
                letterSpacing: '0.15em',
                lineHeight: 1.1,
              }}
            >
              {roomId || '----'}
            </div>
          </div>

          {/* Direct URL Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <input
              type="text"
              readOnly
              value={pairUrl || ''}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#8b9bb4',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCopy}
              style={{
                background: 'transparent',
                border: 'none',
                color: copied ? '#00ff88' : '#00f0ff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Right Column: Instructions & Status Action */}
        <div
          className="glass-panel"
          style={{
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 className="font-display" style={{ fontSize: '1.25rem', marginBottom: '18px', color: '#f0f4fc' }}>
              HOW IT WORKS
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(0, 240, 255, 0.1)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#f0f4fc' }}>Scan & Connect</div>
                  <div style={{ fontSize: '0.85rem', color: '#8b9bb4' }}>
                    Open your smartphone camera or mobile browser on the same Wi-Fi network and open the link.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(255, 0, 85, 0.1)',
                    border: '1px solid #ff0055',
                    color: '#ff0055',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#f0f4fc' }}>Tilt to Steer</div>
                  <div style={{ fontSize: '0.85rem', color: '#8b9bb4' }}>
                    Hold phone in landscape. Turn it left or right like a real steering wheel.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(0, 255, 136, 0.1)',
                    border: '1px solid #00ff88',
                    color: '#00ff88',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#f0f4fc' }}>Throttle & Nitro</div>
                  <div style={{ fontSize: '0.85rem', color: '#8b9bb4' }}>
                    Hold the on-screen Gas trigger with your right thumb, Brake with your left, and trigger Nitro for hyper boost!
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Status Box & CTA */}
          <div style={{ marginTop: '28px' }}>
            {isControllerConnected ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(0, 255, 136, 0.08)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00ff88' }}>
                  <CheckCircle2 size={20} />
                  <span style={{ fontWeight: 700 }}>Smartphone Controller Linked & Ready!</span>
                </div>
                <button
                  onClick={onLaunchGame}
                  className="cyber-btn cyber-btn-lime"
                  style={{ width: '100%', padding: '14px' }}
                >
                  <Play size={18} />
                  ENTER COCKPIT & RACE
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(0, 240, 255, 0.05)',
                    border: '1px solid rgba(0, 240, 255, 0.2)',
                    fontSize: '0.85rem',
                    color: '#8b9bb4',
                  }}
                >
                  <Smartphone size={18} className="animate-pulse-glow" color="#00f0ff" />
                  <span>Waiting for phone connection...</span>
                </div>

                <button
                  onClick={onSoloTest}
                  className="cyber-btn"
                  style={{ width: '100%', padding: '12px' }}
                >
                  <Play size={16} />
                  Test Drive Now (Keyboard WASD)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
