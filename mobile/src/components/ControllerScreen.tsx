import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { SteeringGauge } from './SteeringGauge';
import { CalibrationModal } from './CalibrationModal';
import { SettingsModal } from './SettingsModal';
import { socketService } from '../socketService';
import { sensorProcessor } from '../sensorProcessing';
import type { UseSensorReturn } from '../useSensor';
import type { GameTelemetry, MotionData } from '../types';

interface ControllerScreenProps {
  roomId: string;
  latency: number;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  sensor: UseSensorReturn;
  onDisconnect: () => void;
}

export const ControllerScreen: React.FC<ControllerScreenProps> = ({
  roomId,
  latency,
  connectionStatus,
  sensor,
  onDisconnect,
}) => {
  // Armed state: when false, neutral commands (0) are sent to keep the car safely stationary
  const [armed, setArmed] = useState(true);

  // Pedals & Buttons
  const [touchThrottle, setTouchThrottle] = useState(0);
  const [touchBrake, setTouchBrake] = useState(0);
  const [nitroActive, setNitroActive] = useState(false);
  const [handbrakeActive, setHandbrakeActive] = useState(false);

  // Modals
  const [showCalibration, setShowCalibration] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Telemetry from desktop game
  const [telemetry, setTelemetry] = useState<GameTelemetry>({
    speedKmh: 0,
    gear: 1,
    rpm: 1000,
    nitroRemaining: 100,
    currentLap: 1,
    totalLaps: 3,
    lapTimeSeconds: 0,
    bestLapTimeSeconds: 0,
    checkpointProgress: 0,
  });

  const seqRef = useRef(1);

  // Listen for telemetry and haptic commands from game
  useEffect(() => {
    const unsubTelemetry = socketService.onTelemetry(data => {
      setTelemetry(data);
    });

    const unsubCommand = socketService.onGameCommand(cmd => {
      if (cmd.action === 'haptic-pulse') {
        try {
          Vibration.vibrate(cmd.payload?.duration || 40);
        } catch { /* ignore */ }
      }
    });

    return () => {
      unsubTelemetry();
      unsubCommand();
    };
  }, []);

  // 60Hz Packet Streaming Loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (!socketService.isConnected()) return;

      const seq = seqRef.current++;

      if (!armed || connectionStatus !== 'connected') {
        // Disarmed safe state: send neutral values so car doesn't run away
        const safePacket: MotionData = {
          seq,
          steering: 0,
          tiltX: 0,
          tiltY: 0,
          tiltZ: 0,
          throttle: 0,
          brake: 0,
          nitro: false,
          handbrake: false,
          timestamp: Date.now(),
        };
        socketService.sendMotion(safePacket);
        return;
      }

      // Combine real hardware gyro tilt + touch pedal assist
      const throttleVal = Math.max(touchThrottle, sensor.output.tiltThrottle);
      const brakeVal = touchThrottle > 0 ? touchBrake : Math.max(touchBrake, sensor.output.tiltBrake);

      const packet: MotionData = {
        seq,
        steering: sensor.output.steering,
        tiltX: sensor.output.tiltX,
        tiltY: sensor.output.tiltY,
        tiltZ: sensor.output.tiltZ,
        throttle: throttleVal,
        brake: brakeVal,
        nitro: nitroActive,
        handbrake: handbrakeActive,
        timestamp: Date.now(),
        accel: sensor.acceleration,
      };

      socketService.sendMotion(packet);
    }, 16); // ~60 Hz

    return () => clearInterval(interval);
  }, [
    armed,
    connectionStatus,
    sensor.output,
    sensor.acceleration,
    touchThrottle,
    touchBrake,
    nitroActive,
    handbrakeActive,
  ]);

  // Quick Zero Center
  const handleQuickCenter = () => {
    sensorProcessor.calibrateCurrentPosition(
      sensor.rawAngles.roll,
      sensor.rawAngles.pitch,
      sensor.rawAngles.yaw,
    );
    sensorProcessor.resetFilterState();
    try {
      Vibration.vibrate(30);
    } catch { /* ignore */ }
  };

  const isConnected = connectionStatus === 'connected';

  // Latency color
  let latencyColor = '#00ff88';
  if (latency > 70) latencyColor = '#eab308';
  if (latency > 140) latencyColor = '#f43f5e';

  return (
    <View style={styles.container}>
      {/* Top Status Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={onDisconnect}>
            <Text style={styles.backBtnText}>◀ LEAVE</Text>
          </TouchableOpacity>
          <View style={styles.roomTag}>
            <Text style={styles.roomTagText}>{roomId}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Latency Pill */}
          <View style={styles.pill}>
            <View style={[styles.pillDot, { backgroundColor: latencyColor }]} />
            <Text style={[styles.pillText, { color: latencyColor }]}>
              {latency > 0 ? `${latency}ms` : '--'}
            </Text>
          </View>

          {/* Connection Status Pill */}
          <View
            style={[
              styles.pill,
              isConnected ? styles.pillConnected : styles.pillReconnecting,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: isConnected ? '#00ff88' : '#eab308' },
              ]}
            >
              {isConnected ? 'ONLINE' : 'RECONNECTING'}
            </Text>
          </View>

          {/* Arm / Disarm Button */}
          <TouchableOpacity
            style={[
              styles.armBtn,
              armed ? styles.armBtnActive : styles.armBtnInactive,
            ]}
            onPress={() => {
              setArmed(!armed);
              try { Vibration.vibrate(20); } catch {}
            }}
          >
            <Text
              style={[
                styles.armBtnText,
                { color: armed ? '#0a0e17' : '#94a3b8' },
              ]}
            >
              {armed ? 'ARMED' : 'DISARMED'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Telemetry Dashboard */}
      <View style={styles.telemetryCard}>
        <View style={styles.telemCol}>
          <Text style={styles.telemLabel}>SPEED</Text>
          <Text style={styles.telemSpeed}>
            {Math.round(telemetry.speedKmh)}
            <Text style={styles.telemUnit}> KM/H</Text>
          </Text>
        </View>

        <View style={styles.telemDivider} />

        <View style={styles.telemCol}>
          <Text style={styles.telemLabel}>LAP</Text>
          <Text style={styles.telemVal}>
            {telemetry.currentLap}
            <Text style={{ color: '#64748b' }}>/{telemetry.totalLaps}</Text>
          </Text>
        </View>

        <View style={styles.telemDivider} />

        <View style={styles.telemCol}>
          <Text style={styles.telemLabel}>TIME</Text>
          <Text style={styles.telemVal}>
            {telemetry.lapTimeSeconds.toFixed(1)}s
          </Text>
        </View>

        <View style={styles.telemDivider} />

        <View style={styles.telemCol}>
          <Text style={styles.telemLabel}>NITRO</Text>
          <View style={styles.nitroBarTrack}>
            <View
              style={[
                styles.nitroBarFill,
                { width: `${Math.max(0, Math.min(100, telemetry.nitroRemaining))}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Steering Visualizer */}
      <TouchableOpacity activeOpacity={0.85} onPress={handleQuickCenter}>
        <SteeringGauge
          steering={sensor.output.steering}
          tiltDegrees={sensor.output.tiltX}
          profile={sensorProcessor.getProfile()}
          deadzone={sensorProcessor.getCalibration().deadzone}
        />
      </TouchableOpacity>

      {/* Driving Controls (Pedals & Buttons) */}
      <View style={styles.controlsRow}>
        {/* Left Side: Brake & Handbrake */}
        <View style={styles.pedalGroup}>
          <TouchableOpacity
            style={[
              styles.pedal,
              styles.brakePedal,
              touchBrake > 0 && styles.pedalActiveBrake,
            ]}
            onPressIn={() => {
              setTouchBrake(1.0);
              try { Vibration.vibrate(15); } catch {}
            }}
            onPressOut={() => setTouchBrake(0)}
            activeOpacity={0.8}
          >
            <Text style={styles.pedalTitle}>BRAKE</Text>
            <Text style={styles.pedalSub}>HOLD / TILT BACK</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              handbrakeActive && styles.actionBtnActive,
            ]}
            onPressIn={() => {
              setHandbrakeActive(true);
              try { Vibration.vibrate(20); } catch {}
            }}
            onPressOut={() => setHandbrakeActive(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>HANDBRAKE</Text>
          </TouchableOpacity>
        </View>

        {/* Right Side: Throttle & Nitro */}
        <View style={styles.pedalGroup}>
          <TouchableOpacity
            style={[
              styles.pedal,
              styles.throttlePedal,
              touchThrottle > 0 && styles.pedalActiveThrottle,
            ]}
            onPressIn={() => {
              setTouchThrottle(1.0);
              try { Vibration.vibrate(15); } catch {}
            }}
            onPressOut={() => setTouchThrottle(0)}
            activeOpacity={0.8}
          >
            <Text style={styles.pedalTitle}>THROTTLE</Text>
            <Text style={styles.pedalSub}>HOLD / TILT FORWARD</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.nitroBtn,
              nitroActive && styles.nitroBtnActive,
            ]}
            onPressIn={() => {
              setNitroActive(true);
              try { Vibration.vibrate(40); } catch {}
            }}
            onPressOut={() => setNitroActive(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.nitroBtnText}>⚡ NITRO BOOST</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Calibration & Setting Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={handleQuickCenter}>
          <Text style={styles.toolbarBtnText}>🎯 ZERO CENTER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => setShowCalibration(true)}
        >
          <Text style={styles.toolbarBtnText}>⚖️ FULL CALIBRATE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarBtn}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.toolbarBtnText}>⚙️ SETTINGS</Text>
        </TouchableOpacity>
      </View>

      {/* Calibration Modal */}
      <CalibrationModal
        visible={showCalibration}
        calibrationState={sensor.calibrationState}
        rawAngles={sensor.rawAngles}
        onStart={sensor.startCalibration}
        onCancel={sensor.cancelCalibration}
        onRecalibrate={sensor.recalibrate}
        onClose={() => setShowCalibration(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#0a0e17',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#121824',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  roomTag: {
    backgroundColor: '#121824',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  roomTagText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#00ff88',
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121824',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 4,
  },
  pillConnected: {
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  pillReconnecting: {
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pillText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  armBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  armBtnActive: {
    backgroundColor: '#00ff88',
  },
  armBtnInactive: {
    backgroundColor: '#334155',
  },
  armBtnText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  telemetryCard: {
    flexDirection: 'row',
    backgroundColor: '#121824',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  telemCol: {
    flex: 1,
    alignItems: 'center',
  },
  telemDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#1e293b',
  },
  telemLabel: {
    fontSize: 8,
    fontFamily: 'monospace',
    color: '#64748b',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  telemSpeed: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: '#ffffff',
  },
  telemUnit: {
    fontSize: 8,
    color: '#00ff88',
    fontWeight: 'normal',
  },
  telemVal: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  nitroBarTrack: {
    width: 44,
    height: 8,
    backgroundColor: '#0a0e17',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
  },
  nitroBarFill: {
    height: '100%',
    backgroundColor: '#06b6d4',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    maxHeight: 210,
    marginVertical: 8,
  },
  pedalGroup: {
    flex: 1,
    gap: 8,
  },
  pedal: {
    flex: 2,
    backgroundColor: '#121824',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brakePedal: {
    borderLeftWidth: 4,
    borderLeftColor: '#f43f5e',
  },
  throttlePedal: {
    borderRightWidth: 4,
    borderRightColor: '#00ff88',
  },
  pedalActiveBrake: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderColor: '#f43f5e',
  },
  pedalActiveThrottle: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderColor: '#00ff88',
  },
  pedalTitle: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  pedalSub: {
    fontSize: 8,
    fontFamily: 'monospace',
    color: '#64748b',
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#121824',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
    borderColor: '#eab308',
  },
  actionBtnText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  nitroBtn: {
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  nitroBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.3)',
    borderColor: '#06b6d4',
  },
  nitroBtnText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#06b6d4',
    letterSpacing: 0.5,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  toolbarBtn: {
    flex: 1,
    backgroundColor: '#121824',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  toolbarBtnText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#94a3b8',
  },
});
