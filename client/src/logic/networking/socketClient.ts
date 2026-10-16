import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types';

export class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private pingIntervalId: number | null = null;
  private currentLatency = 0;
  private latencyCallbacks: Array<(lat: number) => void> = [];

  public getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socket) {
      // Connect to the same origin, relying on Vite's proxy during dev or direct origin in prod
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.startPingTracking();
      });

      this.socket.on('disconnect', () => {
        this.stopPingTracking();
      });
    }
    return this.socket;
  }

  private startPingTracking() {
    this.stopPingTracking();
    this.pingIntervalId = window.setInterval(() => {
      if (this.socket && this.socket.connected) {
        const start = performance.now();
        this.socket.emit('ping-sync', start, () => {
          const rtt = Math.round(performance.now() - start);
          this.currentLatency = rtt;
          this.latencyCallbacks.forEach((cb) => cb(rtt));
        });
      }
    }, 2000);
  }

  private stopPingTracking() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  public onLatencyUpdate(callback: (latency: number) => void): () => void {
    this.latencyCallbacks.push(callback);
    return () => {
      this.latencyCallbacks = this.latencyCallbacks.filter((cb) => cb !== callback);
    };
  }

  public getLatency(): number {
    return this.currentLatency;
  }

  public disconnect() {
    this.stopPingTracking();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
