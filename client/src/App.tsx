import { useState, useEffect, useCallback } from 'react';
import type { RoomState, ConnectionStatus, NetworkInterfaceInfo } from '@shared/types';
import { useSocket } from './hooks/useSocket';
import { Header } from './components/common/Header';
import { DesktopLanding } from './components/desktop/DesktopLanding';
import { DesktopGame } from './components/desktop/DesktopGame';
import { MobileController } from './components/mobile/MobileController';
import { DeveloperTelemetryPanel, type DeveloperTelemetryData } from './components/common/DeveloperTelemetryPanel';

export function App() {
  const {
    socket,
    isConnected,
    connectionState,
    reconnectAttempt,
    errorMessage,
    latency,
    reconnect,
  } = useSocket();

  // Mode detection from URL
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const [roomId, setRoomId] = useState<string>('');
  const [pairUrl, setPairUrl] = useState<string>('');
  const [availableIps, setAvailableIps] = useState<NetworkInterfaceInfo[]>([]);
  const [customHost, setCustomHost] = useState<string>('');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameState, setGameState] = useState<'lobby' | 'playing'>('lobby');

  // Parse URL on initial mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const path = url.pathname;
    const roomParam = url.searchParams.get('room');
    const modeParam = url.searchParams.get('mode');

    if (path.includes('controller') || modeParam === 'mobile' || modeParam === 'controller') {
      setMode('mobile');
      if (roomParam) {
        setRoomId(roomParam.toUpperCase());
      }
    } else {
      setMode('desktop');
    }
  }, []);

  // Room Creation Function
  const requestCreateRoom = useCallback(() => {
    if (!socket || !isConnected) return;

    socket.emit('create-room', (res) => {
      if (res.success) {
        setRoomId(res.roomId);
        setAvailableIps(res.availableIps || []);

        // Compute pairing URL based on customHost, current origin, or detected lanUrl
        if (customHost) {
          if (customHost.startsWith('http://') || customHost.startsWith('https://')) {
            setPairUrl(`${customHost.replace(/\/$/, '')}/controller?room=${res.roomId}`);
          } else {
            const clientPort = window.location.port || '5173';
            setPairUrl(`http://${customHost}:${clientPort}/controller?room=${res.roomId}`);
          }
        } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          // If desktop was opened via tunnel or direct IP in the browser, use that exact origin
          setPairUrl(`${window.location.origin}/controller?room=${res.roomId}`);
        } else {
          setPairUrl(res.lanUrl);
        }
      }
    });
  }, [socket, isConnected, customHost]);

  // When in desktop mode, create a room once socket connects
  useEffect(() => {
    if (mode !== 'desktop' || !isConnected) return;

    if (!roomId) {
      requestCreateRoom();
    }

    const onRoomStatus = (state: RoomState) => {
      setRoomState(state);
    };

    const onControllerJoined = (data: { controllerId: string }) => {
      setRoomState((prev) => (prev ? { ...prev, controllerConnected: true, controllerSocketId: data.controllerId } : prev));
    };

    const onControllerDisconnected = () => {
      setRoomState((prev) => (prev ? { ...prev, controllerConnected: false, controllerSocketId: undefined } : prev));
    };

    socket?.on('room-status', onRoomStatus);
    socket?.on('controller-joined', onControllerJoined);
    socket?.on('controller-disconnected', onControllerDisconnected);

    return () => {
      socket?.off('room-status', onRoomStatus);
      socket?.off('controller-joined', onControllerJoined);
      socket?.off('controller-disconnected', onControllerDisconnected);
    };
  }, [socket, isConnected, mode, roomId, requestCreateRoom]);

  // Re-compute pairUrl if custom host or roomId changes
  const handleCustomHostChange = (newHost: string) => {
    setCustomHost(newHost);
    if (roomId) {
      if (newHost.startsWith('http://') || newHost.startsWith('https://')) {
        setPairUrl(`${newHost.replace(/\/$/, '')}/controller?room=${roomId}`);
      } else {
        const clientPort = window.location.port || '5173';
        setPairUrl(`http://${newHost}:${clientPort}/controller?room=${roomId}`);
      }
    }
  };

  const handleToggleMode = (newMode: 'desktop' | 'mobile') => {
    setMode(newMode);
    const url = new URL(window.location.href);
    if (newMode === 'mobile') {
      url.searchParams.set('mode', 'mobile');
      if (roomId) url.searchParams.set('room', roomId);
    } else {
      url.searchParams.delete('mode');
    }
    window.history.pushState({}, '', url.toString());
  };

  // Derive consolidated connection status
  let overallStatus: ConnectionStatus = 'waiting';
  if (connectionState === 'disconnected') {
    overallStatus = 'disconnected';
  } else if (connectionState === 'reconnecting') {
    overallStatus = 'reconnecting';
  } else if (roomState?.controllerConnected) {
    overallStatus = 'connected';
  } else {
    overallStatus = 'waiting';
  }

  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [telemetryData, setTelemetryData] = useState<DeveloperTelemetryData>({
    connectionStatus: 'waiting',
    latencyMs: 0,
    oneWayMs: 0,
    updateHz: 0,
    packetSeq: 0,
  });

  // Track real incoming motion packets for dev telemetry
  useEffect(() => {
    if (!socket) return;
    let packetCount = 0;
    let lastHzCalc = performance.now();

    const onMotion = (payload: any) => {
      packetCount++;
      const now = performance.now();
      let calculatedHz = telemetryData.updateHz;
      if (now - lastHzCalc >= 1000) {
        calculatedHz = Math.round((packetCount * 1000) / (now - lastHzCalc));
        packetCount = 0;
        lastHzCalc = now;
      }

      setTelemetryData((prev) => ({
        ...prev,
        connectionStatus: overallStatus,
        socketId: socket.id,
        roomId: roomId || undefined,
        latencyMs: latency,
        oneWayMs: Math.round(latency / 2),
        updateHz: calculatedHz,
        packetSeq: payload.seq,
        roll: payload.tiltX,
        pitch: payload.pitch,
        yaw: payload.yaw,
        steering: payload.steering,
        throttle: payload.throttle,
        brake: payload.brake,
        nitro: payload.nitro,
        drift: payload.handbrake,
        accelX: payload.acceleration?.x,
        accelY: payload.acceleration?.y,
        accelZ: payload.acceleration?.z,
        activeControlSource: payload.isKeyboard ? 'keyboard' : 'gyro',
      }));
    };

    socket.on('motion-update', onMotion);
    return () => {
      socket.off('motion-update', onMotion);
    };
  }, [socket, overallStatus, roomId, latency, telemetryData.updateHz]);

  // Keep transport values synced in telemetry panel even without active motion
  useEffect(() => {
    setTelemetryData((prev) => ({
      ...prev,
      connectionStatus: overallStatus,
      socketId: socket?.id,
      roomId: roomId || undefined,
      latencyMs: latency,
      oneWayMs: Math.round(latency / 2),
    }));
  }, [overallStatus, socket?.id, roomId, latency]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Navigation */}
      <Header
        currentMode={mode}
        onToggleMode={handleToggleMode}
        latency={latency}
        connectionStatus={overallStatus}
        reconnectAttempt={reconnectAttempt}
        deviceInfoName={
          roomState?.controllerInfo?.userAgent?.includes('iPhone')
            ? 'iPhone'
            : roomState?.controllerInfo?.userAgent?.includes('Android')
            ? 'Android'
            : undefined
        }
        roomId={roomId}
        onToggleTelemetry={() => setIsTelemetryOpen((v) => !v)}
        isTelemetryOpen={isTelemetryOpen}
      />

      {/* Main Body View */}
      <main style={{ flex: 1, position: 'relative', overflowY: mode === 'desktop' && gameState === 'lobby' ? 'auto' : 'hidden' }}>
        {mode === 'desktop' ? (
          gameState === 'lobby' ? (
            <DesktopLanding
              roomId={roomId}
              pairUrl={pairUrl}
              roomState={roomState}
              connectionStatus={overallStatus}
              reconnectAttempt={reconnectAttempt}
              serverErrorMessage={errorMessage}
              latency={latency}
              availableIps={availableIps}
              socket={socket}
              onCustomHostChange={handleCustomHostChange}
              onLaunchRace={() => setGameState('playing')}
              onSoloTest={() => setGameState('playing')}
              onRefreshRoom={reconnect}
            />
          ) : (
            <DesktopGame
              socket={socket}
              onExit={() => setGameState('lobby')}
            />
          )
        ) : (
          <MobileController
            socket={socket}
            socketStatus={connectionState}
            initialRoomId={roomId}
            latency={latency}
          />
        )}
      </main>

      {/* Compact Collapsible Developer Telemetry Panel */}
      <DeveloperTelemetryPanel
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
        data={telemetryData}
      />
    </div>
  );
}

export default App;
