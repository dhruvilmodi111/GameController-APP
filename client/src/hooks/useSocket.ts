import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';
import { socketService } from '../logic/networking/socketClient';

export type SocketConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export function useSocket() {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    const s = socketService.getSocket();
    setSocket(s);

    if (s.connected) {
      setConnectionState('connected');
    }

    const onConnect = () => {
      setConnectionState('connected');
      setReconnectAttempt(0);
      setErrorMessage(null);
    };

    const onDisconnect = (reason: string) => {
      if (reason === 'io client disconnect') {
        setConnectionState('disconnected');
      } else {
        setConnectionState('reconnecting');
      }
    };

    const onConnectError = (err: Error) => {
      setConnectionState('reconnecting');
      setErrorMessage(
        err.message?.includes('xhr poll error')
          ? 'Cannot reach game server. Check Wi-Fi connection.'
          : err.message || 'Connection error'
      );
    };

    const onReconnectAttempt = (attempt: number) => {
      setConnectionState('reconnecting');
      setReconnectAttempt(attempt);
    };

    const onReconnectFailed = () => {
      setConnectionState('disconnected');
      setErrorMessage('Server connection timed out. Please ensure the laptop is online.');
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.io.on('reconnect_attempt', onReconnectAttempt);
    s.io.on('reconnect_failed', onReconnectFailed);

    const unbindLatency = socketService.onLatencyUpdate((lat) => {
      setLatency(lat);
    });

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.io.off('reconnect_failed', onReconnectFailed);
      unbindLatency();
    };
  }, []);

  const reconnect = () => {
    if (socket) {
      setConnectionState('reconnecting');
      setErrorMessage(null);
      socket.connect();
    }
  };

  return {
    socket,
    isConnected: connectionState === 'connected',
    connectionState,
    reconnectAttempt,
    errorMessage,
    latency,
    reconnect,
  };
}
