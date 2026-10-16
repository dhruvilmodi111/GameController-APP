import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  MotionData,
  CalibrationData,
  JoinRoomPayload,
  GameCommand,
  GameTelemetry,
} from '@gyro-play/shared';
import { roomManager } from './roomManager.js';
import { getLocalIpAddress, getAllAvailableIps } from './utils/lanIp.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(io: AppServer, _port: number, clientPort: number) {
  io.on('connection', (socket: AppSocket) => {
    // 1. Host creates a new game session
    socket.on('create-room', (ack) => {
      const room = roomManager.createRoom(socket.id);
      socket.join(room.roomId);

      const lanIp = getLocalIpAddress();
      const lanUrl = lanIp.startsWith('http://') || lanIp.startsWith('https://')
        ? `${lanIp.replace(/\/$/, '')}/controller?room=${room.roomId}`
        : `http://${lanIp}:${clientPort}/controller?room=${room.roomId}`;
      const availableIps = getAllAvailableIps();

      if (typeof ack === 'function') {
        ack({
          success: true,
          roomId: room.roomId,
          lanUrl,
          availableIps,
        });
      }

      socket.emit('room-created', {
        roomId: room.roomId,
        lanUrl,
        availableIps,
      });
      socket.emit('room-status', room);
    });

    // 2. Joining an existing session (Mobile Controller or Desktop Host Reconnecting)
    socket.on('join-room', (payload: JoinRoomPayload, ack) => {
      const result = roomManager.joinRoom(payload, socket.id);

      if (!result.success || !result.room) {
        if (typeof ack === 'function') {
          ack({
            success: false,
            roomId: payload.roomId,
            role: payload.role,
            error: result.error || 'Failed to join game session.',
          });
        }
        return;
      }

      const room = result.room;
      socket.join(room.roomId);

      // Confirm successful connection back to client with controllerToken
      if (typeof ack === 'function') {
        ack({
          success: true,
          roomId: room.roomId,
          role: payload.role,
          controllerToken: result.controllerToken,
        });
      }

      // Broadcast verified room status to everyone in the room
      io.to(room.roomId).emit('room-status', room);

      if (payload.role === 'controller' && room.hostSocketId) {
        // Explicitly notify host that controller is confirmed connected
        io.to(room.hostSocketId).emit('controller-joined', {
          controllerId: socket.id,
          deviceInfo: payload.deviceInfo,
        });
      }
    });

    // 3. High-frequency Motion Data streaming from Phone -> Desktop Game
    socket.on('controller-input', (raw: any) => {
      // 1. Session Isolation & Authenticated Controller Check
      const mapping = roomManager.getMapping(socket.id);
      if (!mapping || mapping.role !== 'controller') return;

      const room = roomManager.getRoom(mapping.roomId);
      if (!room || room.controllerSocketId !== socket.id || !room.hostSocketId) return;

      // 2. Structural & Type Validation
      if (!raw || typeof raw !== 'object') return;

      // 3. Sequence & Stale Packet Handling
      let seq = typeof raw.seq === 'number' ? Math.floor(raw.seq) : undefined;
      if (seq !== undefined) {
        if (room.lastControllerSeq !== undefined && seq <= room.lastControllerSeq) {
          // Reject out-of-order or duplicate stale packet
          return;
        }
        room.lastControllerSeq = seq;
      } else {
        room.lastControllerSeq = (room.lastControllerSeq ?? 0) + 1;
        seq = room.lastControllerSeq;
      }

      // 4. Timestamp Validation
      const now = Date.now();
      let timestamp = typeof raw.timestamp === 'number' && !isNaN(raw.timestamp) ? raw.timestamp : now;
      if (timestamp > now + 10000) {
        timestamp = now;
      }

      // 5. Clamping & Sanitization of Control Inputs
      // Steering clamped to [-1.0, 1.0]
      const rawSteering = Number(raw.steering);
      const steering = isNaN(rawSteering) ? 0 : Math.max(-1.0, Math.min(1.0, rawSteering));

      // Throttle clamped to [0.0, 1.0]
      const rawThrottle = Number(raw.throttle);
      const throttle = isNaN(rawThrottle) ? 0 : Math.max(0.0, Math.min(1.0, rawThrottle));

      // Brake clamped to [0.0, 1.0]
      const rawBrake = Number(raw.brake);
      const brake = isNaN(rawBrake) ? 0 : Math.max(0.0, Math.min(1.0, rawBrake));

      // Buttons / Toggles
      const nitro = Boolean(raw.nitro);
      const handbrake = Boolean(raw.handbrake);

      // Euler Angles
      const tiltX = isNaN(Number(raw.tiltX)) ? 0 : Number(raw.tiltX);
      const tiltY = isNaN(Number(raw.tiltY)) ? 0 : Number(raw.tiltY);
      const tiltZ = isNaN(Number(raw.tiltZ)) ? 0 : Number(raw.tiltZ);

      // Accelerometer vector (optional)
      let accel = undefined;
      if (raw.accel && typeof raw.accel === 'object') {
        accel = {
          x: isNaN(Number(raw.accel.x)) ? 0 : Number(raw.accel.x),
          y: isNaN(Number(raw.accel.y)) ? 0 : Number(raw.accel.y),
          z: isNaN(Number(raw.accel.z)) ? 0 : Number(raw.accel.z),
        };
      }

      const validatedPayload: MotionData = {
        seq,
        steering,
        tiltX,
        tiltY,
        tiltZ,
        throttle,
        brake,
        nitro,
        handbrake,
        timestamp,
        accel,
      };

      // 6. Forward only to the verified host of this specific session
      socket.to(room.hostSocketId).emit('motion-update', validatedPayload);
    });

    // 4. Calibration events from Phone
    socket.on('controller-calibrate', (data: CalibrationData) => {
      const mapping = roomManager.getMapping(socket.id);
      if (!mapping || mapping.role !== 'controller') return;

      const room = roomManager.getRoom(mapping.roomId);
      if (!room || room.controllerSocketId !== socket.id || !room.hostSocketId) return;

      socket.to(room.hostSocketId).emit('game-command-received', {
        action: 'calibrate',
        payload: data,
      });
    });

    // 5. Game commands (start, pause, restart, haptic feedback)
    socket.on('game-command', (cmd: GameCommand) => {
      const mapping = roomManager.getMapping(socket.id);
      if (!mapping) return;

      const room = roomManager.getRoom(mapping.roomId);
      if (!room) return;

      if (mapping.role === 'controller' && room.hostSocketId) {
        socket.to(room.hostSocketId).emit('game-command-received', cmd);
      } else if (mapping.role === 'host' && room.controllerSocketId) {
        socket.to(room.controllerSocketId).emit('game-command-received', cmd);
      }
    });

    // 6. Game telemetry (Speed, Gear, Nitro, Lap time) from Desktop -> Phone
    socket.on('game-telemetry', (telemetry: GameTelemetry) => {
      const mapping = roomManager.getMapping(socket.id);
      if (!mapping || mapping.role !== 'host') return;

      const room = roomManager.getRoom(mapping.roomId);
      if (room && room.controllerSocketId) {
        socket.to(room.controllerSocketId).emit('telemetry-update', telemetry);
      }
    });

    // 7. Low-latency Ping / Clock Sync
    socket.on('ping-sync', (timestamp: number, ack) => {
      if (typeof ack === 'function') {
        ack(timestamp);
      }
    });

    // 8. Disconnect handling with detailed reasons
    socket.on('disconnect', (reason) => {
      const { roomId, role, room } = roomManager.handleDisconnect(socket.id);
      if (roomId) {
        if (role === 'controller') {
          // Immediately send neutral safe packet to host to stop car acceleration
          if (room && room.hostSocketId) {
            io.to(room.hostSocketId).emit('motion-update', {
              seq: (room.lastControllerSeq ?? 0) + 1,
              steering: 0,
              tiltX: 0,
              tiltY: 0,
              tiltZ: 0,
              throttle: 0,
              brake: 0,
              nitro: false,
              handbrake: false,
              timestamp: Date.now(),
            });
          }
          io.to(roomId).emit('controller-disconnected', {
            reason: reason === 'transport close' ? 'Phone lost Wi-Fi connection or closed browser' : `Controller disconnected: ${reason}`,
          });
        } else if (role === 'host') {
          io.to(roomId).emit('host-disconnected', {
            reason: reason === 'transport close' ? 'Desktop host session closed' : `Host disconnected: ${reason}`,
          });
        }
        if (room) {
          io.to(roomId).emit('room-status', room);
        }
      }
    });
  });
}
