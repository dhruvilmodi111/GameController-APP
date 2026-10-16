import type { RoomState, DeviceInfo, JoinRoomPayload, JoinRoomResponse } from '@gyro-play/shared';
import crypto from 'node:crypto';

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private socketToRoom: Map<string, { roomId: string; role: 'host' | 'controller' }> = new Map();
  private roomCleanups: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Generates a readable 4-character room code (avoiding ambiguous letters like O, 0, I, 1)
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);

    return code;
  }

  public createRoom(hostSocketId: string): RoomState {
    // If this host socket already had a room, clean it up
    const existing = this.socketToRoom.get(hostSocketId);
    if (existing) {
      this.handleDisconnect(hostSocketId);
    }

    const roomId = this.generateRoomCode();
    const room: RoomState = {
      roomId,
      hostSocketId,
      hostConnected: true,
      controllerConnected: false,
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    this.socketToRoom.set(hostSocketId, { roomId, role: 'host' });

    // Clear any cleanup timer for this room
    this.cancelCleanup(roomId);

    return room;
  }

  public getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId.toUpperCase().trim());
  }

  public joinRoom(
    payload: JoinRoomPayload,
    socketId: string
  ): JoinRoomResponse & { room?: RoomState } {
    const normalizedRoomId = payload.roomId?.toUpperCase().trim();

    if (!normalizedRoomId || normalizedRoomId.length < 3) {
      return {
        success: false,
        roomId: normalizedRoomId,
        role: payload.role,
        error: 'Please enter a valid 4-character Room Code.',
      };
    }

    const room = this.rooms.get(normalizedRoomId);
    if (!room) {
      return {
        success: false,
        roomId: normalizedRoomId,
        role: payload.role,
        error: `Room "${normalizedRoomId}" not found. Verify the code displayed on your desktop screen.`,
      };
    }

    if (payload.role === 'host') {
      room.hostSocketId = socketId;
      room.hostConnected = true;
      this.socketToRoom.set(socketId, { roomId: normalizedRoomId, role: 'host' });
      this.cancelCleanup(normalizedRoomId);
      return { success: true, roomId: normalizedRoomId, role: 'host', room };
    }

    // Role is 'controller'
    // Verify if host is connected
    if (!room.hostConnected) {
      return {
        success: false,
        roomId: normalizedRoomId,
        role: 'controller',
        error: `The desktop game host for Room "${normalizedRoomId}" is currently offline.`,
      };
    }

    // Security Check: Is another phone already controlling this room?
    if (room.controllerConnected && room.controllerSocketId && room.controllerSocketId !== socketId) {
      // Check if it's the same legitimate device reconnecting with its token
      const isAuthorizedReconnect =
        payload.controllerToken &&
        room.controllerToken &&
        payload.controllerToken === room.controllerToken;

      if (!isAuthorizedReconnect) {
        return {
          success: false,
          roomId: normalizedRoomId,
          role: 'controller',
          error: `Room "${normalizedRoomId}" already has an active motion controller. Another device is currently playing.`,
        };
      }
    }

    // Assign / refresh controller
    const controllerToken = payload.controllerToken || crypto.randomUUID();
    room.controllerSocketId = socketId;
    room.controllerToken = controllerToken;
    room.controllerConnected = true;
    room.lastControllerSeq = 0;
    if (payload.deviceInfo) {
      room.controllerInfo = payload.deviceInfo;
    }

    this.socketToRoom.set(socketId, { roomId: normalizedRoomId, role: 'controller' });
    this.cancelCleanup(normalizedRoomId);

    return {
      success: true,
      roomId: normalizedRoomId,
      role: 'controller',
      controllerToken,
      room,
    };
  }

  public handleDisconnect(socketId: string): {
    roomId?: string;
    role?: 'host' | 'controller';
    room?: RoomState;
  } {
    const mapping = this.socketToRoom.get(socketId);
    if (!mapping) return {};

    const { roomId, role } = mapping;
    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomId);

    if (room) {
      if (role === 'host') {
        room.hostConnected = false;
        room.hostSocketId = undefined;
      } else if (role === 'controller') {
        room.controllerConnected = false;
        room.controllerSocketId = undefined;
        room.lastControllerSeq = 0;
      }

      // Schedule room garbage collection if both host and controller are disconnected
      if (!room.hostConnected && !room.controllerConnected) {
        this.scheduleCleanup(roomId, 60000); // 60s grace period for reloads
      }
    }

    return { roomId, role, room };
  }

  private scheduleCleanup(roomId: string, delayMs: number) {
    this.cancelCleanup(roomId);
    const timeout = setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (room && !room.hostConnected && !room.controllerConnected) {
        this.rooms.delete(roomId);
      }
      this.roomCleanups.delete(roomId);
    }, delayMs);
    this.roomCleanups.set(roomId, timeout);
  }

  private cancelCleanup(roomId: string) {
    const existing = this.roomCleanups.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.roomCleanups.delete(roomId);
    }
  }

  public getMapping(socketId: string) {
    return this.socketToRoom.get(socketId);
  }

  public getAllRoomsCount(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();
