/**
 * GYRO//PLAY — Pairing System Integration Tests
 * Run: npm test  (from project root)
 *  OR: node tests/test-pairing-system.mjs
 *
 * This script auto-starts the backend server via `tsx`, waits for it to be
 * ready, runs all tests, then shuts the server down automatically.
 */

import { io } from 'socket.io-client';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_URL = 'http://localhost:3001';
const TIMEOUT_MS = 8000;
let passCount = 0;
let failCount = 0;
let serverProcess = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const createSocket = () => io(SERVER_URL, { transports: ['websocket'] });
const withTimeout = (p, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT: ${label}`)), TIMEOUT_MS))]);

function pass(label) { passCount++; console.log(`  ✅ PASS: ${label}`); }
function fail(label, reason) { failCount++; console.error(`  ❌ FAIL: ${label} — ${reason}`); }

// ─── Server Lifecycle ────────────────────────────────────────────────────────

async function startServer() {
  const serverDir = resolve(__dirname, '../server');
  console.log('  🚀 Starting backend server (tsx)...');

  serverProcess = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: serverDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '3001' },
  });

  // Poll until /api/health responds or timeout
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${SERVER_URL}/api/health`);
      if (res.ok) {
        console.log('  ✅ Server is up and healthy.\n');
        return true;
      }
    } catch { /* not ready yet */ }
    await sleep(300);
  }
  console.error('  ❌ Server failed to start within 10 seconds.');
  return false;
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testServerHealth() {
  console.log('[1] Server Health Check');
  try {
    const res = await fetch(`${SERVER_URL}/api/health`);
    const data = await res.json();
    data.status === 'ok'
      ? pass('Health endpoint returns ok')
      : fail('Health endpoint', data.status);
  } catch (err) {
    fail('Health endpoint reachable', err.message);
  }
}

async function testRoomCreation() {
  console.log('\n[2] Room Creation');
  const host = createSocket();
  try {
    await withTimeout(new Promise((r) => host.on('connect', r)), 'host connect');
    pass('Host socket connects');
    const result = await withTimeout(new Promise((r) => host.emit('create-room', r)), 'create-room');
    result.success && result.roomId?.length === 4
      ? pass(`Room created with 4-letter code: ${result.roomId}`)
      : fail('Room creation', JSON.stringify(result));
    result.lanUrl?.includes(result.roomId)
      ? pass('LAN URL contains room ID')
      : fail('LAN URL format', result.lanUrl);
  } finally { host.disconnect(); }
}

async function testInvalidRoomRejection() {
  console.log('\n[3] Invalid Room Rejection');
  const c = createSocket();
  try {
    await withTimeout(new Promise((r) => c.on('connect', r)), 'connect');
    const result = await withTimeout(
      new Promise((r) => c.emit('join-room', {
        roomId: 'XXXX',
        role: 'controller',
        deviceInfo: { userAgent: 'Test', screen: { width: 390, height: 844, pixelRatio: 2 } },
      }, r)),
      'join-room'
    );
    !result.success && result.error
      ? pass(`Non-existent room rejected: "${result.error}"`)
      : fail('Non-existent room should be rejected', JSON.stringify(result));
  } finally { c.disconnect(); }
}

async function testFullPairingLifecycle() {
  console.log('\n[4] Full Pairing Lifecycle');
  const host = createSocket();
  const controller = createSocket();
  try {
    await Promise.all([
      withTimeout(new Promise((r) => host.on('connect', r)), 'host'),
      withTimeout(new Promise((r) => controller.on('connect', r)), 'controller'),
    ]);
    pass('Host and Controller connect');

    const roomData = await withTimeout(new Promise((r) => host.emit('create-room', r)), 'create-room');
    if (!roomData.success) { fail('Room creation', JSON.stringify(roomData)); return; }
    pass(`Room created: ${roomData.roomId}`);

    const joinedPromise = withTimeout(new Promise((r) => host.on('controller-joined', r)), 'controller-joined');
    const joinResult = await withTimeout(
      new Promise((r) => controller.emit('join-room', {
        roomId: roomData.roomId,
        role: 'controller',
        deviceInfo: { userAgent: 'TestPhone', screen: { width: 390, height: 844, pixelRatio: 2 } },
      }, r)),
      'join-room'
    );
    joinResult.success
      ? pass('Controller joined valid room')
      : fail('Controller join', joinResult.error);
    joinResult.controllerToken?.length > 10
      ? pass('controllerToken issued')
      : fail('controllerToken', JSON.stringify(joinResult));

    const joined = await joinedPromise;
    joined.controllerId
      ? pass('Host got controller-joined event')
      : fail('controller-joined', JSON.stringify(joined));

    const motionReceived = withTimeout(new Promise((r) => host.on('motion-update', r)), 'motion-update');
    controller.emit('controller-input', {
      steering: 0.5, tiltX: 12, tiltY: 3, tiltZ: 0,
      throttle: 1, brake: 0, nitro: false, handbrake: false,
      timestamp: Date.now(),
    });
    const motion = await motionReceived;
    Math.abs(motion.steering - 0.5) < 0.01
      ? pass('Motion forwarded correctly')
      : fail('Motion forwarding', JSON.stringify(motion));
  } finally { host.disconnect(); controller.disconnect(); }
}

async function testSessionTakeoverBlocking() {
  console.log('\n[5] Session Takeover Blocking');
  const host = createSocket();
  const legit = createSocket();
  const attacker = createSocket();
  try {
    await Promise.all([
      withTimeout(new Promise((r) => host.on('connect', r)), 'host'),
      withTimeout(new Promise((r) => legit.on('connect', r)), 'legit'),
      withTimeout(new Promise((r) => attacker.on('connect', r)), 'attacker'),
    ]);
    const roomData = await withTimeout(new Promise((r) => host.emit('create-room', r)), 'create-room');
    await withTimeout(
      new Promise((r) => legit.emit('join-room', {
        roomId: roomData.roomId, role: 'controller',
        deviceInfo: { userAgent: 'LegitPhone', screen: { width: 390, height: 844, pixelRatio: 2 } },
      }, r)),
      'legit join'
    );
    await sleep(200);
    const attackResult = await withTimeout(
      new Promise((r) => attacker.emit('join-room', {
        roomId: roomData.roomId, role: 'controller',
        deviceInfo: { userAgent: 'Attacker', screen: { width: 390, height: 844, pixelRatio: 2 } },
      }, r)),
      'attacker join'
    );
    !attackResult.success
      ? pass('Attacker blocked from active session')
      : fail('Takeover should be blocked', JSON.stringify(attackResult));
  } finally { host.disconnect(); legit.disconnect(); attacker.disconnect(); }
}

async function testDisconnectHandling() {
  console.log('\n[6] Disconnect Handling');
  const host = createSocket();
  const controller = createSocket();
  try {
    await Promise.all([
      withTimeout(new Promise((r) => host.on('connect', r)), 'host'),
      withTimeout(new Promise((r) => controller.on('connect', r)), 'controller'),
    ]);
    const roomData = await withTimeout(new Promise((r) => host.emit('create-room', r)), 'create-room');
    await withTimeout(
      new Promise((r) => controller.emit('join-room', {
        roomId: roomData.roomId, role: 'controller',
        deviceInfo: { userAgent: 'Test', screen: { width: 390, height: 844, pixelRatio: 2 } },
      }, r)),
      'join'
    );
    const disconnectedPromise = withTimeout(
      new Promise((r) => host.on('controller-disconnected', r)),
      'controller-disconnected'
    );
    controller.disconnect();
    const data = await disconnectedPromise;
    data?.reason
      ? pass(`Host notified of disconnect: "${data.reason}"`)
      : fail('controller-disconnected data', JSON.stringify(data));
  } finally { host.disconnect(); }
}

async function testPingSync() {
  console.log('\n[7] Ping-Sync Round Trip');
  const s = createSocket();
  try {
    await withTimeout(new Promise((r) => s.on('connect', r)), 'connect');
    const t1 = Date.now();
    const ack = await withTimeout(new Promise((r) => s.emit('ping-sync', t1, r)), 'ping-sync');
    const rtt = Date.now() - t1;
    ack === t1
      ? pass(`Ping-sync echo correct (RTT: ${rtt}ms)`)
      : fail('Ping-sync mismatch', `expected ${t1}, got ${ack}`);
  } finally { s.disconnect(); }
}

async function testMotionStreamingAndValidation() {
  console.log('\n[8] Real Motion Streaming & Server Clamping');
  const host = createSocket();
  const controller = createSocket();
  try {
    await Promise.all([
      withTimeout(new Promise((r) => host.on('connect', r)), 'host'),
      withTimeout(new Promise((r) => controller.on('connect', r)), 'controller'),
    ]);

    const roomData = await withTimeout(new Promise((r) => host.emit('create-room', r)), 'create-room');
    await withTimeout(
      new Promise((r) => controller.emit('join-room', { roomId: roomData.roomId, role: 'controller' }, r)),
      'join-room'
    );

    // 1. Test Clamping of excessive values (steering > 1.0, throttle > 1.0, brake < 0.0)
    const clampPromise = withTimeout(new Promise((r) => host.on('motion-update', r)), 'clamped-motion');
    controller.emit('controller-input', {
      seq: 1,
      steering: 4.8, // Should clamp to 1.0
      throttle: 9.9, // Should clamp to 1.0
      brake: -1.5,   // Should clamp to 0.0
      tiltX: 15, tiltY: 0, tiltZ: 0, nitro: true, handbrake: false,
      timestamp: Date.now(),
    });

    const clampedPacket = await clampPromise;
    clampedPacket.steering === 1.0 && clampedPacket.throttle === 1.0 && clampedPacket.brake === 0.0
      ? pass('Server clamped excessive control values to safe [-1, 1] / [0, 1] range')
      : fail('Server clamping failed', JSON.stringify(clampedPacket));

    clampedPacket.seq === 1
      ? pass('Sequence number received and validated in order')
      : fail('Sequence number mismatch', `expected 1, got ${clampedPacket.seq}`);

    // 2. Test Stale / Out-of-Order Packet Drop
    const seq5Promise = withTimeout(new Promise((r) => host.on('motion-update', r)), 'seq-5');
    controller.emit('controller-input', {
      seq: 5,
      steering: 0.25, throttle: 0.5, brake: 0, tiltX: 0, tiltY: 0, tiltZ: 0,
      nitro: false, handbrake: false, timestamp: Date.now(),
    });
    const packet5 = await seq5Promise;
    packet5.seq === 5 ? pass('Packet seq #5 received') : fail('Seq #5 failed', JSON.stringify(packet5));

    // Send stale packet seq #2 (out of order), followed by valid seq #6
    let receivedStale = false;
    const staleListener = (p) => {
      if (p.seq === 2) receivedStale = true;
    };
    host.on('motion-update', staleListener);

    const seq6Promise = withTimeout(new Promise((r) => {
      const handler = (p) => {
        if (p.seq === 6) {
          host.off('motion-update', handler);
          r(p);
        }
      };
      host.on('motion-update', handler);
    }), 'seq-6');

    controller.emit('controller-input', {
      seq: 2, // Stale!
      steering: -0.99, throttle: 1.0, brake: 0, tiltX: 0, tiltY: 0, tiltZ: 0,
      nitro: false, handbrake: false, timestamp: Date.now(),
    });

    controller.emit('controller-input', {
      seq: 6,
      steering: 0.1, throttle: 0.2, brake: 0, tiltX: 0, tiltY: 0, tiltZ: 0,
      nitro: false, handbrake: false, timestamp: Date.now(),
    });

    await seq6Promise;
    host.off('motion-update', staleListener);

    !receivedStale
      ? pass('Out-of-order packet (seq #2 after seq #5) dropped by server')
      : fail('Stale packet was not dropped', 'Received seq #2');

    // 3. Test Disconnect Safety: host receives a safe zeroed neutral packet automatically
    const neutralPacketPromise = withTimeout(new Promise((r) => host.on('motion-update', r)), 'neutral-packet');
    controller.disconnect();
    const safePacket = await neutralPacketPromise;
    safePacket.throttle === 0 && safePacket.steering === 0 && safePacket.brake === 0
      ? pass('Host received safe neutral control packet upon controller disconnect')
      : fail('Disconnect safety packet failed', JSON.stringify(safePacket));

  } finally {
    host.disconnect();
    controller.disconnect();
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏎️  GYRO//PLAY — Pairing System Integration Tests');
  console.log('='.repeat(55));

  const serverReady = await startServer();
  if (!serverReady) {
    console.error('\n❌ Cannot run tests: server did not start.\n');
    process.exit(1);
  }

  try {
    await testServerHealth();
    await testRoomCreation();
    await testInvalidRoomRejection();
    await testFullPairingLifecycle();
    await testSessionTakeoverBlocking();
    await testDisconnectHandling();
    await testPingSync();
    await testMotionStreamingAndValidation();
  } catch (err) {
    console.error('\nUnhandled error:', err);
    failCount++;
  } finally {
    stopServer();
  }

  console.log('\n' + '='.repeat(55));
  console.log(`\n  Total: ${passCount + failCount} tests  |  ✅ ${passCount} Passed  |  ❌ ${failCount} Failed\n`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
