/**
 * GYRO//PLAY — Shared Types
 * Common contracts between Node.js backend, React Desktop Game, and Mobile Controller.
 */

export type UserRole = 'host' | 'controller';

export type ConnectionStatus = 'waiting' | 'connected' | 'reconnecting' | 'disconnected';

export interface MotionData {
  /** Packet sequence number for ordering, drop & latency monitoring */
  seq?: number;
  /** Normalized steering value: -1.0 (full left) to +1.0 (full right) */
  steering: number;
  /** Raw or smoothed roll in degrees (-90 to +90) */
  tiltX: number;
  /** Raw or smoothed pitch in degrees (-90 to +90) */
  tiltY: number;
  /** Raw yaw / alpha degrees (0 to 360) */
  tiltZ: number;
  /** Throttle trigger value: 0.0 (idle) to 1.0 (full gas) */
  throttle: number;
  /** Brake/Reverse trigger value: 0.0 (released) to 1.0 (hard brake) */
  brake: number;
  /** Nitro boost button state */
  nitro: boolean;
  /** Handbrake / drift toggle state */
  handbrake: boolean;
  /** Client high-resolution timestamp */
  timestamp: number;
  /** Optional accelerometer 3D vector in m/s² */
  accel?: { x: number; y: number; z: number };
}

export interface CalibrationData {
  /** Zero-reference offset for roll (steering) */
  offsetX: number;
  /** Zero-reference offset for pitch */
  offsetY: number;
  /** Zero-reference offset for yaw */
  offsetZ: number;
  /** Steering sensitivity multiplier (default 1.0) */
  sensitivity: number;
  /** Deadzone threshold around center (e.g., 0.05) */
  deadzone: number;
  /** Invert steering axis */
  invertSteering: boolean;
}

export interface DeviceInfo {
  userAgent?: string;
  vendor?: string;
  platform?: string;
  screen?: {
    width: number;
    height: number;
    pixelRatio: number;
  };
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

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: string;
  isInternal: boolean;
}

export interface CreateRoomResponse {
  success: boolean;
  roomId: string;
  lanUrl: string;
  availableIps: NetworkInterfaceInfo[];
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

export interface ServerInfo {
  lanIp: string;
  serverPort: number;
  clientPort: number;
  availableIps: NetworkInterfaceInfo[];
  controllerUrlTemplate: string;
}

/** Socket.IO events sent from Client to Server */
export interface ClientToServerEvents {
  'create-room': (ack: (res: CreateRoomResponse) => void) => void;
  'join-room': (payload: JoinRoomPayload, ack: (res: JoinRoomResponse) => void) => void;
  'controller-input': (data: MotionData) => void;
  'controller-calibrate': (data: CalibrationData) => void;
  'game-command': (cmd: GameCommand) => void;
  'game-telemetry': (telemetry: GameTelemetry) => void;
  'ping-sync': (timestamp: number, ack: (echo: number) => void) => void;
}

/** Socket.IO events sent from Server to Client */
export interface ServerToClientEvents {
  'room-created': (data: { roomId: string; lanUrl: string; availableIps: NetworkInterfaceInfo[] }) => void;
  'room-status': (state: RoomState) => void;
  'controller-joined': (data: { controllerId: string; deviceInfo?: DeviceInfo }) => void;
  'controller-disconnected': (data?: { reason: string }) => void;
  'host-disconnected': (data?: { reason: string }) => void;
  'motion-update': (data: MotionData) => void;
  'telemetry-update': (telemetry: GameTelemetry) => void;
  'game-command-received': (cmd: GameCommand) => void;
  'error-message': (msg: string) => void;
}
