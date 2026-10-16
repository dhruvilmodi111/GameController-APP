import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import {
  Play, Pause, RotateCcw, Volume2, VolumeX, ArrowLeft,
  AlertTriangle, Zap, Flag, Trophy, ShieldAlert
} from 'lucide-react';
import type { ClientToServerEvents, ServerToClientEvents, MotionData, GameTelemetry, GameCommand } from '@shared/types';
import { GameEngine, type GamePhase, type GameMode } from '../../logic/game/engine';
import { soundEngine } from '../../logic/game/audio';
import { TelemetryHUD } from './TelemetryHUD';

interface DesktopGameProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  onExit: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return m > 0 ? `${m}:${s}` : `${s}s`;
}

function getNeonRushRank(hits: number): { rank: string; color: string; label: string } {
  if (hits === 0) return { rank: 'S', color: 'var(--accent-lime)', label: 'PERFECT RUN · 0 BOUNDARY HITS' };
  if (hits <= 2) return { rank: 'A', color: '#00f0ff', label: 'EXCELLENT · CLEAN RACING LINE' };
  if (hits <= 4) return { rank: 'B', color: '#ffb800', label: 'GOOD EFFORT · MINOR SCRAPES' };
  return { rank: 'C', color: '#ff5c5c', label: 'MULTIPLE WALL STRIKES' };
}

export const DesktopGame: React.FC<DesktopGameProps> = ({ socket, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Direct DOM references for 60fps steering gauge
  const compassRef = useRef<HTMLDivElement | null>(null);
  const steeringTextRef = useRef<HTMLDivElement | null>(null);

  // Game state
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [gameMode, setGameMode] = useState<GameMode>('race');
  const [isMuted, setIsMuted] = useState(() => soundEngine.getMuted());
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null);
  const [boundaryHitFlash, setBoundaryHitFlash] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const hitFlashTimerRef = useRef<number | null>(null);

  // Race results
  const [bestLap, setBestLap] = useState<number | null>(null);
  const [totalRaceTime, setTotalRaceTime] = useState<number>(0);
  const [neonRushPenalty, setNeonRushPenalty] = useState<number>(0);
  const [neonRushHits, setNeonRushHits] = useState<number>(0);
  const [lapRecords, setLapRecords] = useState<Array<{ lap: number; time: number }>>([]);

  // Link Diagnostics
  const [linkStats, setLinkStats] = useState({
    rttLatencyMs: 0,
    oneWayLatencyMs: 0,
    updateHz: 0,
    latestSeq: 0,
    controllerConnected: false,
  });

  const motionMetricsRef = useRef({
    packetCount: 0,
    latestSeq: 0,
    lastIntervalTime: performance.now(),
    rttLatencyMs: 0,
  });

  const [telemetry, setTelemetry] = useState<GameTelemetry>({
    speedKmh: 0, gear: 1, rpm: 1000, nitroRemaining: 100,
    currentLap: 1, totalLaps: 3, lapTimeSeconds: 0, bestLapTimeSeconds: 0, checkpointProgress: 0,
  });

  // Start / Restart race callback
  const handleStartRace = useCallback((mode: GameMode) => {
    const engine = engineRef.current;
    if (!engine) return;
    setGameMode(mode);
    setBestLap(null);
    setLapRecords([]);
    setNeonRushPenalty(0);
    setNeonRushHits(0);
    setDisconnectNotice(null);
    setBoundaryHitFlash(false);
    engine.startCountdown(mode);
  }, []);

  const restartRace = useCallback(() => {
    handleStartRace(gameMode);
  }, [handleStartRace, gameMode]);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.phase === 'paused') {
      engine.resume();
      setDisconnectNotice(null);
    } else if (engine.phase === 'racing') {
      engine.pause();
    }
  }, []);

  const toggleSound = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  // Keyboard shortcut listeners (P / Escape to pause, R to restart)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause();
      } else if (e.code === 'KeyR' && phase !== 'countdown') {
        restartRace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePause, restartRace, phase]);

  // Main Canvas & Engine Initialization
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;

    engine.onPhaseChange((p) => {
      setPhase(p);
      if (p === 'finished') {
        setNeonRushPenalty(engine.neonRushBoundaryPenalty);
        setNeonRushHits(engine.neonRushBoundaryHits);
        setLapRecords([...engine.lapRecords]);
      }
    });

    engine.onTelemetry((t) => {
      setTelemetry(t);
      setIsKeyboardActive(engine.isKeyboardActive);
      if (socket && socket.connected) socket.emit('game-telemetry', t);
    });

    engine.onBoundaryHit((hits, penaltyMs) => {
      setNeonRushPenalty(penaltyMs);
      setNeonRushHits(hits);
      setBoundaryHitFlash(true);
      if (hitFlashTimerRef.current) window.clearTimeout(hitFlashTimerRef.current);
      hitFlashTimerRef.current = window.setTimeout(() => setBoundaryHitFlash(false), 800);
    });

    engine.onWatchdogAlert((msg) => {
      setDisconnectNotice(msg);
    });

    engine.onRaceFinished((record, totalTime) => {
      setBestLap(record);
      setTotalRaceTime(totalTime);
    });

    // Socket listeners
    if (socket) {
      const onMotion = (data: MotionData) => {
        engine.setMotionInput(data);

        if (compassRef.current) {
          compassRef.current.style.transform = `rotate(${data.steering * 40}deg)`;
        }
        if (steeringTextRef.current) {
          steeringTextRef.current.textContent = `${(data.steering * 35).toFixed(0)}°`;
        }

        motionMetricsRef.current.packetCount++;
        if (typeof data.seq === 'number') {
          motionMetricsRef.current.latestSeq = data.seq;
        }
      };

      const onCommand = (cmd: GameCommand) => {
        if (cmd.action === 'start') {
          const mode = (cmd.payload?.mode as GameMode) || gameMode;
          setGameMode(mode);
          handleStartRace(mode);
        } else if (cmd.action === 'pause') { engine.pause(); }
        else if (cmd.action === 'resume') { engine.resume(); }
        else if (cmd.action === 'restart') {
          engine.reset();
          handleStartRace(gameMode);
        }
      };

      const onControllerJoined = () => {
        setDisconnectNotice(null);
        setLinkStats((prev) => ({ ...prev, controllerConnected: true }));
        // Auto-start race countdown when mobile controller joins so car is immediately drivable
        if (engine.phase === 'idle') {
          handleStartRace('race');
        }
      };

      const onControllerDisconnected = (data?: { reason: string }) => {
        engine.resetMotionInput();
        engine.pause();
        setDisconnectNotice(data?.reason || 'Phone controller disconnected. Game paused for safety.');
        setLinkStats((prev) => ({ ...prev, controllerConnected: false, updateHz: 0 }));
      };

      socket.on('motion-update', onMotion);
      socket.on('game-command-received', onCommand);
      socket.on('controller-joined', onControllerJoined);
      socket.on('controller-disconnected', onControllerDisconnected);

      // Ping-Sync every 1 second
      const pingTimer = window.setInterval(() => {
        if (!socket.connected) return;
        const pingStart = performance.now();
        socket.emit('ping-sync', pingStart, () => {
          const rtt = Math.max(1, Math.round(performance.now() - pingStart));
          motionMetricsRef.current.rttLatencyMs = rtt;
        });
      }, 1000);

      // Stats update every 250ms
      const statsTimer = window.setInterval(() => {
        const now = performance.now();
        const elapsed = (now - motionMetricsRef.current.lastIntervalTime) / 1000;
        const hz = elapsed > 0 ? Math.round(motionMetricsRef.current.packetCount / elapsed) : 0;
        motionMetricsRef.current.packetCount = 0;
        motionMetricsRef.current.lastIntervalTime = now;
        const rtt = motionMetricsRef.current.rttLatencyMs;
        setLinkStats((prev) => ({
          ...prev,
          rttLatencyMs: rtt,
          oneWayLatencyMs: Math.max(1, Math.round(rtt / 2)),
          updateHz: hz,
          latestSeq: motionMetricsRef.current.latestSeq,
        }));
      }, 250);

      return () => {
        clearInterval(pingTimer);
        clearInterval(statsTimer);
        socket.off('motion-update', onMotion);
        socket.off('game-command-received', onCommand);
        socket.off('controller-joined', onControllerJoined);
        socket.off('controller-disconnected', onControllerDisconnected);
        engine.destroy();
      };
    }

    return () => { engine.destroy(); };
  }, [socket, gameMode]);

  const isActiveGame = phase === 'racing' || phase === 'countdown' || phase === 'paused';

  // Neon Rush final adjusted time
  const neonRushAdjustedTime = bestLap !== null
    ? bestLap + neonRushPenalty / 1000
    : null;
  const neonRank = getNeonRushRank(neonRushHits);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 65px)',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />

      {/* Start / Finish Overlay */}
      {(phase === 'idle' || phase === 'finished') && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(9, 12, 16, 0.88)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '600px', width: '92%', padding: '24px 20px' }}>
            {/* Title / Brand */}
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '3.2rem',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                color: 'var(--accent-lime)',
                textShadow: '0 0 40px rgba(198,255,77,0.5)',
                marginBottom: '4px',
              }}
            >
              GYRO<span style={{ color: 'var(--text-tertiary)', fontSize: '2.2rem' }}>//</span>PLAY
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                letterSpacing: '0.2em',
                color: 'var(--text-secondary)',
                marginBottom: '26px',
              }}
            >
              2D MOTION-CONTROLLED HYPERCAR RACING
            </div>

            {/* Finish State & Results Screen */}
            {phase === 'finished' && bestLap !== null && (
              <div
                style={{
                  marginBottom: '24px',
                  padding: '24px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-lime)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 0 32px rgba(198,255,77,0.14)',
                }}
              >
                {/* Mode & Rank Banner */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trophy size={18} color="var(--accent-lime)" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {gameMode === 'neonrush' ? '⚡ NEON RUSH RESULTS' : '🏁 CHAMPIONSHIP FINISH'}
                    </span>
                  </div>

                  {gameMode === 'neonrush' && (
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: `${neonRank.color}18`,
                        border: `1px solid ${neonRank.color}`,
                        color: neonRank.color,
                        fontFamily: 'var(--font-display)',
                        fontSize: '1rem',
                        fontWeight: 800,
                        boxShadow: `0 0 12px ${neonRank.color}40`,
                      }}
                    >
                      RANK {neonRank.rank}
                    </div>
                  )}
                </div>

                {/* Score Stats Grid */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {gameMode === 'neonrush' ? 'BASE LAP TIME' : 'BEST LAP'}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-lime)', fontFamily: 'var(--font-mono)' }}>
                      {formatTime(bestLap)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      TOTAL TIME
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatTime(totalRaceTime)}
                    </div>
                  </div>

                  {gameMode === 'neonrush' && (
                    <div>
                      <div style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: '#ff5c5c', marginBottom: '4px' }}>
                        WALL PENALTY
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ff5c5c', fontFamily: 'var(--font-mono)' }}>
                        +{(neonRushPenalty / 1000).toFixed(2)}s
                      </div>
                    </div>
                  )}
                </div>

                {/* Neon Rush Adjusted Total & Rating */}
                {gameMode === 'neonrush' && neonRushAdjustedTime !== null && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      FINAL ADJUSTED TIME ({neonRushHits} boundary {neonRushHits === 1 ? 'hit' : 'hits'}) · <span style={{ color: neonRank.color, fontWeight: 700 }}>{neonRank.label}</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: neonRank.color, fontFamily: 'var(--font-mono)' }}>
                      {formatTime(neonRushAdjustedTime)}
                    </div>
                  </div>
                )}

                {/* Lap Breakdown for Classic Race */}
                {lapRecords.length > 1 && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {lapRecords.map((r) => (
                      <div key={r.lap} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>LAP {r.lap}</div>
                        <div
                          style={{
                            fontSize: '0.9rem',
                            fontFamily: 'var(--font-mono)',
                            color: r.time === bestLap ? 'var(--accent-lime)' : 'var(--text-secondary)',
                            fontWeight: r.time === bestLap ? 700 : 400,
                          }}
                        >
                          {r.time === bestLap && '🟢 '}{formatTime(r.time)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Post-race action buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                  <button
                    onClick={restartRace}
                    className="btn-primary"
                    style={{ flex: 1, padding: '12px 18px', fontSize: '0.88rem' }}
                  >
                    <RotateCcw size={16} /> Play Again
                  </button>
                  <button
                    onClick={() => handleStartRace(gameMode === 'race' ? 'neonrush' : 'race')}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '12px 18px', fontSize: '0.88rem' }}
                  >
                    {gameMode === 'race' ? <Zap size={16} color="#00f0ff" /> : <Flag size={16} color="var(--accent-lime)" />}
                    {gameMode === 'race' ? 'Try Neon Rush' : 'Try Classic Race'}
                  </button>
                </div>
              </div>
            )}

            {/* Mode Selector (When idle) */}
            {phase === 'idle' && (
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginBottom: '22px' }}>
                {/* Classic Race */}
                <button
                  onClick={() => handleStartRace('race')}
                  style={{
                    flex: 1,
                    padding: '18px 20px',
                    backgroundColor: 'var(--surface-elevated)',
                    border: '2px solid var(--border-lime)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--accent-lime)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    letterSpacing: '0.04em',
                    boxShadow: '0 0 20px rgba(198,255,77,0.1)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(198,255,77,0.12)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-elevated)'; }}
                >
                  <Flag size={22} />
                  CLASSIC RACE
                  <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-secondary)', letterSpacing: 'normal' }}>
                    3 Laps · Clean lines & momentum
                  </span>
                </button>

                {/* Neon Rush Signature Mode */}
                <button
                  onClick={() => handleStartRace('neonrush')}
                  style={{
                    flex: 1,
                    padding: '18px 20px',
                    background: 'linear-gradient(135deg, rgba(255,0,128,0.12), rgba(0,240,255,0.12))',
                    border: '2px solid #ff007f',
                    borderRadius: 'var(--radius-md)',
                    color: '#ff007f',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    letterSpacing: '0.04em',
                    boxShadow: '0 0 24px rgba(255,0,128,0.25)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(255,0,128,0.2), rgba(0,240,255,0.2))'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(255,0,128,0.12), rgba(0,240,255,0.12))'; }}
                >
                  <Zap size={22} />
                  ⚡ NEON RUSH
                  <span style={{ fontWeight: 400, fontSize: '0.72rem', color: '#ffb8e0', letterSpacing: 'normal' }}>
                    1 Lap Time-Trial · Avoid Boundaries
                  </span>
                </button>
              </div>
            )}

            {/* Controls Guide */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.06em',
                lineHeight: 1.6,
                backgroundColor: 'rgba(20, 24, 21, 0.65)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>📱 <strong>PHONE:</strong> Tilt left/right to steer · Tilt forward = Gas · Tilt back = Brake · Onscreen Nitro & Drift</div>
              <div style={{ marginTop: '4px', color: 'var(--text-tertiary)' }}>
                ⌨️ <strong>KEYBOARD:</strong> [W/↑] Gas · [S/↓] Brake · [A/D/←/→] Steer · [SHIFT] Boost · [SPACE] Drift · [P] Pause · [R] Restart
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Game Telemetry HUD */}
      {isActiveGame && (
        <TelemetryHUD
          telemetry={telemetry}
          compassRef={compassRef}
          steeringTextRef={steeringTextRef}
          rttLatencyMs={linkStats.rttLatencyMs}
          oneWayLatencyMs={linkStats.oneWayLatencyMs}
          updateHz={linkStats.updateHz}
          latestSeq={linkStats.latestSeq}
          controllerConnected={linkStats.controllerConnected}
          gameMode={gameMode}
          neonRushHits={neonRushHits}
          neonRushPenaltyMs={neonRushPenalty}
          isKeyboardActive={isKeyboardActive}
        />
      )}

      {/* Floating Game Controls (Top Left) */}
      {isActiveGame && (
        <div
          style={{
            position: 'absolute',
            top: '24px',
            left: '24px',
            display: 'flex',
            gap: '10px',
            zIndex: 40,
          }}
        >
          <button
            onClick={onExit}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            title="Exit to Landing"
          >
            <ArrowLeft size={14} /> Exit
          </button>

          <button
            onClick={togglePause}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
          >
            {phase === 'paused' ? <Play size={14} /> : <Pause size={14} />}
            {phase === 'paused' ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={restartRace}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            title="Restart (Shortcut: R)"
          >
            <RotateCcw size={14} /> Restart
          </button>

          <button
            onClick={toggleSound}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      )}

      {/* Disconnect / Stale Safety Notice */}
      {disconnectNotice && isActiveGame && (
        <div
          style={{
            position: 'absolute',
            top: '84px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 92, 92, 0.16)',
            border: '1px solid #ff5c5c',
            borderRadius: 'var(--radius-md)',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 50,
            backdropFilter: 'blur(8px)',
            color: '#ff5c5c',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            boxShadow: '0 4px 24px rgba(255, 92, 92, 0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertTriangle size={16} />
          <span>{disconnectNotice}</span>
          <button
            onClick={togglePause}
            className="btn-primary"
            style={{ padding: '4px 12px', fontSize: '0.74rem', marginLeft: '6px' }}
          >
            Drive with Keyboard
          </button>
        </div>
      )}

      {/* Live Boundary Strike Alert in Neon Rush */}
      {boundaryHitFlash && isActiveGame && gameMode === 'neonrush' && (
        <div
          style={{
            position: 'absolute',
            top: '84px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 0, 128, 0.22)',
            border: '1.5px solid #ff007f',
            borderRadius: 'var(--radius-md)',
            padding: '8px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 48,
            backdropFilter: 'blur(10px)',
            color: '#ff007f',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.88rem',
            fontWeight: 700,
            boxShadow: '0 0 24px rgba(255, 0, 128, 0.5)',
            letterSpacing: '0.04em',
            animation: 'pulse 0.4s ease-in-out',
          }}
        >
          <ShieldAlert size={18} />
          <span>BOUNDARY STRIKE! +1.00s PENALTY</span>
        </div>
      )}

      {/* Keyboard Hint (bottom, racing only) */}
      {phase === 'racing' && (
        <div
          style={{
            position: 'absolute',
            bottom: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '0.68rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          TILT PHONE OR [W/A/S/D] TO DRIVE · [SHIFT] NITRO · [SPACE] DRIFT · [P] PAUSE · [R] RESTART
        </div>
      )}
    </div>
  );
};
