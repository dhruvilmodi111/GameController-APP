import { useState, useEffect } from 'react';
import { Smartphone, ArrowRight, AlertCircle } from 'lucide-react';
import { MotionSignature } from '../common/MotionSignature';
import { sensorProcessor } from '../../logic/sensors/sensorProcessing';

interface MobileLandingProps {
  initialRoomId?: string;
  onConnect: (roomId: string) => void;
  isConnecting?: boolean;
  error?: string | null;
}

export const MobileLanding: React.FC<MobileLandingProps> = ({
  initialRoomId = '',
  onConnect,
  isConnecting = false,
  error,
}) => {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [tiltVector, setTiltVector] = useState({ x: 0, y: 0 });
  const [hasGyroPermission, setHasGyroPermission] = useState(false);

  // Auto-listen to device orientation for live Motion Signature preview
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const roll = e.gamma || 0;
      const pitch = e.beta || 0;
      const yaw = e.alpha || 0;

      const orientationType = screen.orientation?.type || '';
      const processed = sensorProcessor.processOrientation(roll, pitch, yaw, orientationType);

      setTiltVector({
        x: processed.steering,
        y: Math.max(-1, Math.min(1, processed.tiltY / 45)),
      });
      setHasGyroPermission(true);
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    onConnect(roomId.trim().toUpperCase());
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: 'calc(100vh - 65px)',
        padding: '24px 20px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        maxWidth: '440px',
        margin: '0 auto',
      }}
    >
      {/* Top Branding & Status Tag */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--accent-lime)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            MOBILE LINK
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: hasGyroPermission ? 'var(--accent-lime)' : 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: hasGyroPermission ? 'var(--accent-lime)' : 'var(--text-tertiary)',
              }}
            />
            {hasGyroPermission ? 'GYRO ACTIVE' : 'TOUCH / GYRO'}
          </div>
        </div>

        {/* Main Headline */}
        <div style={{ marginBottom: '24px' }}>
          <h1
            className="font-display"
            style={{
              fontSize: '2.2rem',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              marginBottom: '10px',
            }}
          >
            Your phone is <br />
            <span style={{ color: 'var(--accent-lime)' }}>the controller.</span>
          </h1>
          <p
            style={{
              fontSize: '0.92rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45,
            }}
          >
            Precision tilt steering. Zero hardware needed. Connect to your desktop game session below.
          </p>
        </div>

        {/* Centerpiece: Motion Signature & Minimal Phone Illustration */}
        <div
          className="elevated-panel"
          style={{
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '28px',
            position: 'relative',
          }}
        >
          {/* Reusable Motion Signature */}
          <MotionSignature
            value={tiltVector}
            size={160}
            label="LIVE MOTION SENSOR"
            showValues={true}
            interactive={true}
          />

          <div
            style={{
              marginTop: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Smartphone size={13} color="var(--accent-lime)" />
            <span>Tilt device or touch to test orb response</span>
          </div>
        </div>
      </div>

      {/* Connection Form & Connect Button */}
      <div style={{ marginTop: 'auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              htmlFor="roomInput"
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.08em',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              Desktop Room Code
            </label>
            <input
              id="roomInput"
              type="text"
              maxLength={6}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="e.g. RACE"
              className="font-mono"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '1.4rem',
                textAlign: 'center',
                letterSpacing: '0.25em',
                fontWeight: 700,
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-lime)',
                outline: 'none',
                transition: 'border-color var(--transition-fast)',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#ff4d4d',
                fontSize: '0.78rem',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 77, 77, 0.08)',
                border: '1px solid rgba(255, 77, 77, 0.2)',
              }}
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Prominent Primary Connect Button */}
          <button
            type="submit"
            disabled={!roomId.trim() || isConnecting}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '1.05rem',
              fontWeight: 700,
            }}
          >
            {isConnecting ? (
              'Connecting...'
            ) : (
              <>
                Connect to Game
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Ensure phone and laptop are on the same Wi-Fi network
        </div>
      </div>
    </div>
  );
};
