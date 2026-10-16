/**
 * GYRO//PLAY — React Native Shared Types
 * Mirrors the shared/types.ts contract used by the Node.js server.
 */

export type UserRole = 'host' | 'controller';

export type ConnectionStatus = 'waiting' | 'connected' | 'reconnecting' | 'disconnected';

export interface MotionData {
  seq?: number;
  steering: number;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  throttle: number;
  brake: number;
  nitro: boolean;
  handbrake: boolean;
  timestamp: number;
  accel?: { x: number; y: number; z: number };
}

export interface CalibrationData {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  sensitivity: number;
  deadzone: number;
  invertSteering: boolean;
}

export interface DeviceInfo {
  userAgent?: string;
  vendor?: string;
  platform?: string;
  screen?: { width: number; height: number; pixelRatio: number };
  hasGyroscope?: boolean;
}

export interface RoomState {
  roomId: string;
  hostSocketId?: string;
  controllerSocketId?: string;
  controllerToken?: string;
  hostConnected: boolean;
  controllerConnected: boolean;
  controllerInfo?: DeviceInfo;
  createdAt: number;
  lastPingMs?: number;
  lastControllerSeq?: number;
}

export interface JoinRoomPayload {
  roomId: string;
  role: UserRole;
  deviceInfo?: DeviceInfo;
  controllerToken?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  roomId: string;
  role: UserRole;
  controllerToken?: string;
  error?: string;
}

export interface GameTelemetry {
  speedKmh: number;
  gear: number;
  rpm: number;
  nitroRemaining: number;
  currentLap: number;
  totalLaps: number;
  lapTimeSeconds: number;
  bestLapTimeSeconds: number;
  checkpointProgress: number;
}

export interface GameCommand {
  action: 'start' | 'pause' | 'resume' | 'restart' | 'calibrate' | 'haptic-pulse';
  payload?: any;
}
