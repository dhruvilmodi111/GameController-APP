import { RaceTrack } from './track';
import { Car } from './car';
import { ParticleSystem } from './particles';
import { soundEngine } from './audio';
import type { GameTelemetry, MotionData } from '@shared/types';

export type GamePhase = 'idle' | 'countdown' | 'racing' | 'paused' | 'finished';
export type GameMode = 'race' | 'neonrush';

export interface LapRecord {
  lap: number;
  time: number;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public track: RaceTrack;
  public car: Car;
  public particles: ParticleSystem;

  // Game state machine
  public phase: GamePhase = 'idle';
  public mode: GameMode = 'race';
  private animFrameId: number | null = null;
  private lastTime = 0;

  // Frame-Rate Independent Physics (Fixed Timestep Accumulator)
  private readonly FIXED_DT_MS = 1000 / 60; // 16.6667ms per tick (60 Hz)
  private accumulator = 0;

  // Countdown
  private countdownStartTime = 0;
  private readonly COUNTDOWN_DURATION_MS = 3000;
  private lastCountdownBeepAt = -1;

  // Laps & Timing
  public currentLap = 1;
  public totalLaps = 3;
  public lapStartTime = 0;
  public currentLapTime = 0;
  public bestLapTime: number | null = null;
  public raceStartTime = 0;
  public totalRaceTime = 0;
  public lapRecords: LapRecord[] = [];

  // Checkpoint tracking
  public nextCheckpointIndex = 1;
  private lapInProgress = false;

  // Neon Rush mode state
  public neonRushBoundaryPenalty = 0; // ms added
  public neonRushBoundaryHits = 0;
  private lastBarrierHitTime = 0;
  private wasInBarrier = false;

  // Input states
  private currentMotion: MotionData = {
    seq: 0,
    steering: 0,
    tiltX: 0,
    tiltY: 0,
    tiltZ: 0,
    throttle: 0,
    brake: 0,
    nitro: false,
    handbrake: false,
    timestamp: 0,
  };
  private lastMotionTimestamp = 0;
  private readonly MOTION_WATCHDOG_TIMEOUT_MS = 300;
  private lastReceivedSeq = 0;
  private lastTelemetryTime = 0;

  // Keyboard fallback
  private keysDown: Set<string> = new Set();
  public isKeyboardActive = false;

  // Victory celebration
  private celebrationParticles: Array<{
    x: number; y: number; vx: number; vy: number;
    color: string; alpha: number; size: number;
  }> = [];

  // Callbacks
  private telemetryCallback?: (t: GameTelemetry) => void;
  private lapCompletedCallback?: (lap: number, time: number) => void;
  private raceFinishedCallback?: (bestLap: number, totalTime: number) => void;
  private phaseChangeCallback?: (phase: GamePhase) => void;
  private boundaryHitCallback?: (hits: number, penaltyMs: number) => void;
  private watchdogAlertCallback?: (msg: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;

    this.track = new RaceTrack();
    this.car = new Car();
    this.particles = new ParticleSystem();

    this.canvas.width = this.track.width;
    this.canvas.height = this.track.height;

    this.bindKeyboard();
    this.renderIdle();
  }

  private bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
      this.isKeyboardActive = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
      if (this.keysDown.size === 0) {
        this.isKeyboardActive = false;
      }
    });
  }

  // ─── Motion Input ───────────────────────────────────────────────────────────

  public setMotionInput(motion: MotionData) {
    if (typeof motion.seq === 'number' && motion.seq > 0) {
      if (motion.seq <= this.lastReceivedSeq) return;
      this.lastReceivedSeq = motion.seq;
    }
    this.currentMotion = motion;
    this.lastMotionTimestamp = performance.now();
  }

  public resetMotionInput() {
    this.currentMotion = {
      seq: 0,
      steering: 0,
      tiltX: 0,
      tiltY: 0,
      tiltZ: 0,
      throttle: 0,
      brake: 0,
      nitro: false,
      handbrake: false,
      timestamp: performance.now(),
    };
    this.lastMotionTimestamp = 0;
  }

  public getCurrentMotion(): MotionData { return { ...this.currentMotion }; }
  public getLastReceivedSeq(): number { return this.lastReceivedSeq; }

  // ─── Callbacks Registration ──────────────────────────────────────────────────

  public onTelemetry(cb: (t: GameTelemetry) => void) { this.telemetryCallback = cb; }
  public onLapCompleted(cb: (lap: number, time: number) => void) { this.lapCompletedCallback = cb; }
  public onRaceFinished(cb: (bestLap: number, totalTime: number) => void) { this.raceFinishedCallback = cb; }
  public onPhaseChange(cb: (phase: GamePhase) => void) { this.phaseChangeCallback = cb; }
  public onBoundaryHit(cb: (hits: number, penaltyMs: number) => void) { this.boundaryHitCallback = cb; }
  public onWatchdogAlert(cb: (msg: string) => void) { this.watchdogAlertCallback = cb; }

  // ─── Phase Management ────────────────────────────────────────────────────────

  private setPhase(phase: GamePhase) {
    this.phase = phase;
    this.phaseChangeCallback?.(phase);
  }

  public startCountdown(mode: GameMode = 'race') {
    this.mode = mode;
    this.totalLaps = mode === 'neonrush' ? 1 : 3;

    // Reset race state
    this.currentLap = 1;
    this.nextCheckpointIndex = 1;
    this.lapInProgress = true;
    this.currentLapTime = 0;
    this.lapRecords = [];
    this.bestLapTime = null;
    this.totalRaceTime = 0;
    this.lastReceivedSeq = 0;
    this.neonRushBoundaryPenalty = 0;
    this.neonRushBoundaryHits = 0;
    this.celebrationParticles = [];
    this.wasInBarrier = false;
    this.accumulator = 0;

    this.car.reset();
    this.particles.clear();

    this.lastCountdownBeepAt = -1;
    this.countdownStartTime = performance.now();
    this.setPhase('countdown');
    soundEngine.start();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  // Alias
  public start(mode: GameMode = 'race') {
    this.startCountdown(mode);
  }

  public pause() {
    if (this.phase !== 'racing') return;
    this.setPhase('paused');
    this.renderPause();
  }

  public resume() {
    if (this.phase === 'paused') {
      this.setPhase('racing');
      this.lapStartTime += performance.now() - this.lastTime;
      this.lastTime = performance.now();
      this.accumulator = 0;
      this.animFrameId = requestAnimationFrame(this.loop);
    } else if (this.phase === 'idle' || this.phase === 'finished') {
      this.startCountdown(this.mode);
    }
  }

  public reset() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.setPhase('idle');
    this.car.reset();
    this.particles.clear();
    this.currentLapTime = 0;
    this.accumulator = 0;
    soundEngine.stop();
    this.renderIdle();
  }

  public get isRunning() { return this.phase === 'racing' || this.phase === 'countdown'; }
  public get isPaused() { return this.phase === 'paused'; }
  public get isFinished() { return this.phase === 'finished'; }

  // ─── Game Loop (Stable Fixed-Timestep Strategy) ──────────────────────────────

  private loop = (timestamp: number) => {
    const elapsed = Math.min(timestamp - this.lastTime, 100); // Clamp to avoid spiral of death
    this.lastTime = timestamp;

    if (this.phase === 'countdown') {
      this.updateCountdown(timestamp);
      this.renderCountdown(timestamp);
    } else if (this.phase === 'racing') {
      // Accumulate frame time and execute physics in deterministic 60Hz ticks
      this.accumulator += elapsed;
      let ticks = 0;
      while (this.accumulator >= this.FIXED_DT_MS && ticks < 4) {
        this.fixedUpdate(timestamp);
        this.accumulator -= this.FIXED_DT_MS;
        ticks++;
      }
      this.render(timestamp);
    } else if (this.phase === 'finished') {
      this.updateCelebration(timestamp);
      this.render(timestamp);
      this.drawFinishOverlay();
    } else {
      return; // idle or paused
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // ─── Countdown Phase ─────────────────────────────────────────────────────────

  private updateCountdown(timestamp: number) {
    const elapsed = timestamp - this.countdownStartTime;
    const remaining = Math.ceil((this.COUNTDOWN_DURATION_MS - elapsed) / 1000);

    if (remaining !== this.lastCountdownBeepAt && remaining >= 1 && remaining <= 3) {
      this.lastCountdownBeepAt = remaining;
      soundEngine.playCountdownBeep(false);
    }

    if (elapsed >= this.COUNTDOWN_DURATION_MS) {
      this.lapStartTime = performance.now();
      this.raceStartTime = performance.now();
      this.accumulator = 0;
      this.setPhase('racing');
      soundEngine.playCountdownBeep(true); // GO!
    }
  }

  private renderCountdown(timestamp: number) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.track.draw(this.ctx, this.mode === 'neonrush', timestamp);
    this.car.draw(this.ctx);

    const elapsed = timestamp - this.countdownStartTime;
    const remaining = Math.ceil((this.COUNTDOWN_DURATION_MS - elapsed) / 1000);
    const label = remaining <= 0 ? 'GO!' : String(remaining);

    // Dim overlay
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(10, 13, 19, 0.55)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Mode badge
    const modeLabel = this.mode === 'neonrush' ? '⚡ NEON RUSH — AVOID BOUNDARIES' : '🏁 CHAMPIONSHIP RACE — 3 LAPS';
    this.ctx.font = 'bold 22px "JetBrains Mono", monospace';
    this.ctx.fillStyle = this.mode === 'neonrush' ? '#ff007f' : '#FF2A3A';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(modeLabel, this.canvas.width / 2, this.canvas.height / 2 - 95);

    // Countdown animation
    const cycleFrac = (elapsed % 1000) / 1000;
    const scale = 1 + (1 - cycleFrac) * 0.45;
    const alpha = remaining <= 0 ? 1 : 0.45 + 0.55 * (1 - cycleFrac);

    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(scale, scale);
    this.ctx.globalAlpha = Math.min(1, alpha);

    this.ctx.shadowColor = label === 'GO!' ? '#FF2A3A' : (this.mode === 'neonrush' ? '#ff007f' : '#00f0ff');
    this.ctx.shadowBlur = 45;

    this.ctx.font = 'bold 130px "JetBrains Mono", monospace';
    this.ctx.fillStyle = label === 'GO!' ? '#FF2A3A' : '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, 0, 0);
    this.ctx.restore();

    // Guidance footer
    this.ctx.globalAlpha = 0.75;
    this.ctx.font = '13px "JetBrains Mono", monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.fillText('PHONE MOTION: TILT TO STEER · TILT FORWARD = GAS · TILT BACK = BRAKE', this.canvas.width / 2, this.canvas.height / 2 + 95);
    this.ctx.fillText('KEYBOARD FALLBACK: [W/A/S/D] OR ARROWS · [SHIFT] BOOST · [SPACE] DRIFT', this.canvas.width / 2, this.canvas.height / 2 + 120);

    this.ctx.restore();
  }

  // ─── Fixed Timestep Physics Update ──────────────────────────────────────────

  private fixedUpdate(timestamp: number) {
    const now = performance.now();

    // 1. Controller Watchdog & Stale / Disconnect Safety
    if (this.lastMotionTimestamp > 0) {
      const elapsedSincePacket = now - this.lastMotionTimestamp;

      // Stale input (> 300ms): zero out active throttle to prevent runaway
      if (elapsedSincePacket > this.MOTION_WATCHDOG_TIMEOUT_MS) {
        this.currentMotion.throttle = 0;
        this.currentMotion.brake = 0;
        this.currentMotion.nitro = false;
        this.currentMotion.steering *= 0.86;
        if (Math.abs(this.currentMotion.steering) < 0.02) this.currentMotion.steering = 0;
      }

      // If phone input is disconnected or stale for > 1500ms while racing without keyboard, auto-pause
      if (elapsedSincePacket > 1500 && this.phase === 'racing' && this.keysDown.size === 0) {
        this.pause();
        this.watchdogAlertCallback?.('Phone controller signal lost. Game paused for safety.');
        return;
      }
    }

    // 2. Control Resolution (Real Motion Data + Keyboard Fallback)
    let steering = this.currentMotion.steering;
    let throttle = this.currentMotion.throttle;
    let brake = this.currentMotion.brake;
    let nitro = this.currentMotion.nitro;
    let handbrake = this.currentMotion.handbrake;

    // Fallback: If throttle and brake are 0, check tiltY (pitch) delta
    if (throttle === 0 && brake === 0 && this.currentMotion.tiltY !== 0) {
      // Natural resting grip is ~45°. Pushing phone forward (<35°) accelerates. Pulling back (>55°) brakes.
      const pitch = this.currentMotion.tiltY;
      if (pitch < 34) {
        throttle = Math.min(1.0, (34 - pitch) / 24);
      } else if (pitch > 56) {
        brake = Math.min(1.0, (pitch - 56) / 22);
      }
    }

    // Keyboard Fallback Overrides
    if (this.keysDown.has('ArrowLeft') || this.keysDown.has('KeyA')) steering = -1.0;
    else if (this.keysDown.has('ArrowRight') || this.keysDown.has('KeyD')) steering = 1.0;
    if (this.keysDown.has('ArrowUp') || this.keysDown.has('KeyW')) throttle = 1.0;
    if (this.keysDown.has('ArrowDown') || this.keysDown.has('KeyS')) brake = 1.0;
    if (this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight')) nitro = true;
    if (this.keysDown.has('Space')) handbrake = true;

    // 3. Collision Detection against Track Geometry
    const collision = this.track.getCollisionInfo(this.car.x, this.car.y);

    // Wall / Barrier Collision Resolution
    if (collision.isCollidingBarrier) {
      this.car.handleBarrierCollision(collision.normalX, collision.normalY, collision.penetration);

      // Emit vibrant boundary collision sparks
      this.particles.emitSparks(
        this.car.x,
        this.car.y,
        Math.atan2(collision.normalY, collision.normalX),
        this.mode === 'neonrush'
      );

      // Audio feedback (debounced to avoid audio clipping)
      if (now - this.lastBarrierHitTime > 180) {
        soundEngine.playBarrierHitSound();
        this.lastBarrierHitTime = now;
      }

      // Neon Rush: Penalize boundary hits
      if (this.mode === 'neonrush' && !this.wasInBarrier) {
        this.neonRushBoundaryHits++;
        this.neonRushBoundaryPenalty += 1000; // +1.00s penalty per strike
        this.boundaryHitCallback?.(this.neonRushBoundaryHits, this.neonRushBoundaryPenalty);
      }
      this.wasInBarrier = true;
    } else {
      this.wasInBarrier = false;
    }

    // 4. Update Car Physics (Fixed 60Hz delta)
    this.car.update(
      steering,
      throttle,
      brake,
      nitro,
      handbrake,
      collision.isOnGrass,
      this.particles,
      1.0
    );

    // 5. Update Particle System
    this.particles.update();

    // 6. Sound Engine Pitch Modulation
    const speedRatio = Math.abs(this.car.speed) / this.car.maxSpeed;
    soundEngine.updateEnginePitch(speedRatio, throttle > 0.05);

    // 7. Race Timing & Lap Progress
    this.currentLapTime = (timestamp - this.lapStartTime) / 1000;
    this.checkLapProgress();

    // 8. Send Telemetry to Mobile Controller (~20 Hz)
    if (this.telemetryCallback && timestamp - this.lastTelemetryTime >= 50) {
      this.lastTelemetryTime = timestamp;
      const speedKmh = this.car.getSpeedKmh();
      const gear = speedKmh < 10 ? 1 : speedKmh < 48 ? 2 : speedKmh < 88 ? 3 : speedKmh < 135 ? 4 : speedKmh < 175 ? 5 : 6;
      this.telemetryCallback({
        speedKmh,
        gear,
        rpm: Math.round(1500 + speedRatio * 6500),
        nitroRemaining: Math.round(this.car.nitroFuel),
        currentLap: this.currentLap,
        totalLaps: this.totalLaps,
        lapTimeSeconds: Number(this.currentLapTime.toFixed(2)),
        bestLapTimeSeconds: this.bestLapTime ? Number(this.bestLapTime.toFixed(2)) : 0,
        checkpointProgress: this.nextCheckpointIndex / this.track.waypoints.length,
      });
    }
  }

  // ─── Lap / Checkpoint Detection ──────────────────────────────────────────────

  private checkLapProgress() {
    const pts = this.track.waypoints;

    if (this.nextCheckpointIndex < pts.length) {
      const cp = pts[this.nextCheckpointIndex];
      const dist = Math.hypot(this.car.x - cp.x, this.car.y - cp.y);
      if (dist < this.track.roadWidth * 0.95) {
        soundEngine.playCheckpointSound();
        this.nextCheckpointIndex++;
      }
    } else {
      // All checkpoints cleared — check start/finish line
      const finish = pts[0];
      const dist = Math.hypot(this.car.x - finish.x, this.car.y - finish.y);
      if (dist < this.track.roadWidth * 0.95 && this.lapInProgress) {
        this.completeLap();
      }
    }
  }

  private completeLap() {
    const lapTime = this.currentLapTime;
    soundEngine.playCheckpointSound();

    if (!this.bestLapTime || lapTime < this.bestLapTime) {
      this.bestLapTime = lapTime;
    }

    this.lapRecords.push({ lap: this.currentLap, time: lapTime });
    this.lapCompletedCallback?.(this.currentLap, lapTime);

    if (this.currentLap >= this.totalLaps) {
      // Race finished!
      this.totalRaceTime = (performance.now() - this.raceStartTime) / 1000;
      this.setPhase('finished');
      this.spawnCelebrationParticles();
      soundEngine.playVictoryFanfare();
      soundEngine.stop();
      this.raceFinishedCallback?.(this.bestLapTime!, this.totalRaceTime);
    } else {
      // Next lap
      this.currentLap++;
      this.lapStartTime = performance.now();
      this.nextCheckpointIndex = 1;
      this.lapInProgress = true;
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  public render(timestamp = 0) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.track.draw(this.ctx, this.mode === 'neonrush', timestamp);
    this.particles.draw(this.ctx);
    this.car.draw(this.ctx);

    if (this.phase === 'racing') {
      this.drawNextCheckpointArrow();
    }
  }

  private drawNextCheckpointArrow() {
    const pts = this.track.waypoints;
    const targetIdx = this.nextCheckpointIndex < pts.length ? this.nextCheckpointIndex : 0;
    const target = pts[targetIdx];
    const dist = Math.hypot(this.car.x - target.x, this.car.y - target.y);

    if (dist < 110) return;

    this.ctx.save();
    const angle = Math.atan2(target.y - this.car.y, target.x - this.car.x);
    const arrowDist = 58;
    const ax = this.car.x + Math.cos(angle) * arrowDist;
    const ay = this.car.y + Math.sin(angle) * arrowDist;

    this.ctx.translate(ax, ay);
    this.ctx.rotate(angle);
    this.ctx.globalAlpha = 0.8;
    const color = targetIdx === 0 ? '#ffffff' : (this.mode === 'neonrush' ? '#ff007f' : '#c6ff4d');
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2.8;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -6);
    this.ctx.lineTo(15, 0);
    this.ctx.lineTo(0, 6);
    this.ctx.stroke();
    this.ctx.restore();
  }

  // ─── Pause Overlay ───────────────────────────────────────────────────────────

  private renderPause() {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(10, 13, 19, 0.70)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 32;
    this.ctx.font = 'bold 84px "JetBrains Mono", monospace';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('PAUSED', cx, cy - 20);

    this.ctx.shadowBlur = 0;
    this.ctx.font = '16px "JetBrains Mono", monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    this.ctx.fillText('Press [P] or click Resume to continue race', cx, cy + 50);

    this.ctx.restore();
  }

  // ─── Idle State ──────────────────────────────────────────────────────────────

  private renderIdle() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.track.draw(this.ctx, this.mode === 'neonrush', 0);
    this.car.draw(this.ctx);
  }

  // ─── Finish / Victory Celebration ────────────────────────────────────────────

  private spawnCelebrationParticles() {
    const colors = ['#c6ff4d', '#00f0ff', '#ffffff', '#ff007f', '#ffb800'];
    for (let i = 0; i < 140; i++) {
      this.celebrationParticles.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 450,
        y: this.canvas.height / 2 + (Math.random() - 0.5) * 220,
        vx: (Math.random() - 0.5) * 8.5,
        vy: (Math.random() - 1.25) * 7.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        size: Math.random() * 8 + 3,
      });
    }
  }

  private updateCelebration(_timestamp: number) {
    for (const p of this.celebrationParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.14; // gravity
      p.alpha -= 0.007;
    }
    this.celebrationParticles = this.celebrationParticles.filter((p) => p.alpha > 0);
  }

  private drawFinishOverlay() {
    for (const p of this.celebrationParticles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      this.ctx.restore();
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  public destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    soundEngine.stop();
  }
}
