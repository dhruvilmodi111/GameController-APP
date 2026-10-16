/**
 * GYRO//PLAY — Mobile Socket.IO Service
 *
 * Handles Socket.IO connection to desktop host via Node.js server.
 * Manages heartbeat ping-sync, reconnection, authenticated token persistence,
 * and high-rate packet streaming (~60Hz).
 */

import { io, Socket } from 'socket.io-client';
import type {
  MotionData,
  CalibrationData,
  JoinRoomPayload,
  JoinRoomResponse,
  RoomState,
  GameTelemetry,
  GameCommand,
} from './types';

type LatencyCallback = (ms: number) => void;
type StatusCallback = (status: 'connected' | 'reconnecting' | 'disconnected') => void;
type TelemetryCallback = (telemetry: GameTelemetry) => void;
type CommandCallback = (cmd: GameCommand) => void;

class SocketService {
  private socket: Socket | null = null;
  private latencyCallbacks: LatencyCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private telemetryCallbacks: TelemetryCallback[] = [];
  private commandCallbacks: CommandCallback[] = [];
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private serverUrl = '';
  private currentRoomId = '';
  private currentToken = '';

  connect(url: string): Socket {
    if (this.socket && this.socket.connected && this.serverUrl === url) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.serverUrl = url;

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 6000,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
      forceNew: false,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this.notifyStatus('connected');
      this.startPing();

      // If reconnecting to an existing session, re-join with stored token
      if (this.currentRoomId) {
        this.joinRoom(this.currentRoomId, this.currentToken);
      }
    });

    this.socket.on('disconnect', () => {
      this.notifyStatus('disconnected');
      this.stopPing();
    });

    this.socket.on('connect_error', () => {
      this.notifyStatus('reconnecting');
    });

    this.socket.on('telemetry-update', (data: GameTelemetry) => {
      this.telemetryCallbacks.forEach(cb => cb(data));
    });

    this.socket.on('game-command', (cmd: GameCommand) => {
      this.commandCallbacks.forEach(cb => cb(cmd));
    });

    return this.socket;
  }

  joinRoom(
    roomId: string,
    token?: string,
    ack?: (res: JoinRoomResponse) => void,
  ) {
    if (!this.socket) return;
    this.currentRoomId = roomId.toUpperCase();

    const payload: JoinRoomPayload = {
      roomId: this.currentRoomId,
      role: 'controller',
      controllerToken: token,
      deviceInfo: {
        platform: 'Android React Native',
        hasGyroscope: true,
      },
    };

    this.socket.emit('join-room', payload, (res: JoinRoomResponse) => {
      if (res && res.success && res.controllerToken) {
        this.currentToken = res.controllerToken;
      }
      if (ack) ack(res);
    });
  }

  sendMotion(data: MotionData) {
    if (!this.socket?.connected) return;
    this.socket.emit('controller-input', data);
  }

  sendCalibration(data: CalibrationData) {
    if (!this.socket?.connected) return;
    this.socket.emit('controller-calibrate', data);
  }

  leaveRoom() {
    if (this.socket && this.currentRoomId) {
      this.socket.emit('leave-room', { roomId: this.currentRoomId, role: 'controller' });
    }
    this.currentRoomId = '';
    this.currentToken = '';
  }

  disconnect() {
    this.stopPing();
    this.leaveRoom();
    this.socket?.disconnect();
    this.socket = null;
    this.notifyStatus('disconnected');
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  onStatusChange(cb: StatusCallback): () => void {
    this.statusCallbacks.push(cb);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(f => f !== cb);
    };
  }

  onLatencyUpdate(cb: LatencyCallback): () => void {
    this.latencyCallbacks.push(cb);
    return () => {
      this.latencyCallbacks = this.latencyCallbacks.filter(f => f !== cb);
    };
  }

  onTelemetry(cb: TelemetryCallback): () => void {
    this.telemetryCallbacks.push(cb);
    return () => {
      this.telemetryCallbacks = this.telemetryCallbacks.filter(f => f !== cb);
    };
  }

  onGameCommand(cb: CommandCallback): () => void {
    this.commandCallbacks.push(cb);
    return () => {
      this.commandCallbacks = this.commandCallbacks.filter(f => f !== cb);
    };
  }

  private notifyStatus(status: 'connected' | 'reconnecting' | 'disconnected') {
    this.statusCallbacks.forEach(cb => cb(status));
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (!this.socket?.connected) return;
      const t0 = Date.now();
      this.socket.emit('ping-sync', t0, (echo: number) => {
        const rtt = Math.max(1, Date.now() - echo);
        this.latencyCallbacks.forEach(cb => cb(rtt));
      });
    }, 2000);
  }

  private stopPing() {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const socketService = new SocketService();
