import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@gyro-play/shared';
import { getLocalIpAddress, getAllAvailableIps } from './utils/lanIp.js';
import { roomManager } from './roomManager.js';
import { registerSocketHandlers } from './socketHandlers.js';

const app = express();
const server = http.createServer(app);

const SERVER_PORT = Number(process.env.PORT) || 3001;
const CLIENT_PORT = Number(process.env.CLIENT_PORT) || 5173;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Socket.IO Server configuration with low latency settings
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling'],
});

// REST Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// REST Download APK endpoint
app.get('/api/download-apk', (_req, res) => {
  const apkPath = path.resolve(process.cwd(), '../mobile/android/app/build/outputs/apk/debug/app-debug.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'gyro-play-controller.apk');
  } else {
    res.status(404).send('APK not found. Please build it first.');
  }
});

// REST Network & Server Info (used by Desktop client to build QR code)
app.get('/api/info', (_req, res) => {
  const lanIp = getLocalIpAddress();
  const availableIps = getAllAvailableIps();
  res.json({
    lanIp,
    serverPort: SERVER_PORT,
    clientPort: CLIENT_PORT,
    availableIps,
    apkDownloadUrl: `http://${lanIp}:${SERVER_PORT}/api/download-apk`,
    activeRooms: roomManager.getAllRoomsCount(),
    controllerUrlTemplate: lanIp.startsWith('http://') || lanIp.startsWith('https://')
      ? `${lanIp.replace(/\/$/, '')}/controller?room={ROOM_ID}`
      : `http://${lanIp}:${CLIENT_PORT}/controller?room={ROOM_ID}`,
  });
});

// Register real-time Socket.IO Handlers
registerSocketHandlers(io, SERVER_PORT, CLIENT_PORT);

server.listen(SERVER_PORT, '0.0.0.0', () => {
  const lanIp = getLocalIpAddress();
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                GYRO//PLAY BACKEND SERVER                       ║
║        Your Phone. Your Motion. Your Game.                     ║
╠════════════════════════════════════════════════════════════════╣
║  • Local Server:       http://localhost:${SERVER_PORT}                    ║
║  • LAN IP:             http://${lanIp}:${SERVER_PORT}                 ║
║  • Client Expected at: http://${lanIp}:${CLIENT_PORT}                 ║
║  • Health Endpoint:    http://localhost:${SERVER_PORT}/api/health         ║
╚════════════════════════════════════════════════════════════════╝
`);
});
