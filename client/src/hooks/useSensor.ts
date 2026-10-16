import { useState, useEffect, useRef, useCallback } from 'react';
import { sensorProcessor, SensorProcessor } from '../logic/sensors/sensorProcessing';

/** What the browser can detect about sensor availability */
export type SensorAvailability =
  | 'checking'          // Initial state
  | 'available'         // DeviceOrientationEvent fires with non-null numbers
  | 'unavailable'       // Device has no motion/gyro hardware
  | 'permission_needed' // iOS requires explicit user gesture requestPermission()
  | 'denied';           // User or system rejected access

export type CalibrationState =
  | 'idle'
  | 'collecting'        // Sampling sensor for 2 seconds
  | 'unstable'          // Too much movement detected during collection
  | 'done';

export interface SensorOutput {
  /** Processed, filtered, clamped steering [-1, 1] */
  steering: number;
  /** Raw smoothed tiltX (roll) in degrees */
  tiltX: number;
  /** Raw smoothed tiltY (pitch) in degrees */
  tiltY: number;
  /** Raw yaw (alpha) in degrees */
  tiltZ: number;
  /** Forward tilt acceleration [0.0, 1.0] */
  tiltThrottle?: number;
  /** Backward tilt braking [0.0, 1.0] */
  tiltBrake?: number;
}

export interface AccelerationData {
  /** Acceleration along X axis (m/s²) */
  x: number;
  /** Acceleration along Y axis (m/s²) */
  y: number;
  /** Acceleration along Z axis (m/s²) */
  z: number;
}

export interface RotationRateData {
  /** Rotation rate around Z axis (deg/s) */
  alpha: number;
  /** Rotation rate around X axis (deg/s) */
  beta: number;
  /** Rotation rate around Y axis (deg/s) */
  gamma: number;
}

export interface UseSensorReturn {
  availability: SensorAvailability;
  calibrationState: CalibrationState;
  output: SensorOutput;
  /** Raw angles at sensor origin, before calibration offsets */
  rawAngles: { roll: number; pitch: number; yaw: number };
  /** Real-time 3D accelerometer data (m/s²) */
  acceleration: AccelerationData;
  /** Real-time gyroscope angular rotation velocity (deg/s) */
  rotationRate: RotationRateData;
  requestPermission: () => Promise<void>;
  startCalibration: () => void;
  cancelCalibration: () => void;
  recalibrate: () => void;
}

const CALIB_DURATION_MS = 2000;       // How long to collect samples
const CALIB_VARIANCE_THRESHOLD = 5.0; // Max allowed variance (degrees²) to accept calibration

export function useSensor(): UseSensorReturn {
  const [availability, setAvailability] = useState<SensorAvailability>('checking');
  const [calibrationState, setCalibrationState] = useState<CalibrationState>('idle');
  const [output, setOutput] = useState<SensorOutput>({
    steering: 0,
    tiltX: 0,
    tiltY: 0,
    tiltZ: 0,
    tiltThrottle: 0,
    tiltBrake: 0,
  });
  const [rawAngles, setRawAngles] = useState({ roll: 0, pitch: 0, yaw: 0 });
  const [acceleration, setAcceleration] = useState<AccelerationData>({ x: 0, y: 0, z: 0 });
  const [rotationRate, setRotationRate] = useState<RotationRateData>({ alpha: 0, beta: 0, gamma: 0 });

  // Refs to avoid stale closures in event listeners
  const calibSamplesRef = useRef<number[]>([]);
  const calibTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawAnglesRef = useRef({ roll: 0, pitch: 0, yaw: 0 });
  const hasReceivedEventsRef = useRef(false);
  const hasReceivedOrientationRef = useRef(false);

  // ─── Core Sensor Processing Handlers ──────────────────────────────────────

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (e.gamma === null && e.beta === null) return;

    hasReceivedOrientationRef.current = true;
    if (!hasReceivedEventsRef.current) {
      hasReceivedEventsRef.current = true;
      setAvailability('available');
    }

    const roll  = typeof e.gamma === 'number' ? e.gamma : 0;
    const pitch = typeof e.beta === 'number' ? e.beta : 0;
    const yaw   = typeof e.alpha === 'number' ? e.alpha : 0;

    rawAnglesRef.current = { roll, pitch, yaw };
    setRawAngles({ roll, pitch, yaw });

    // Collect samples if in calibration mode
    if (calibSamplesRef.current !== null) {
      calibSamplesRef.current.push(roll);
    }

    const orientationType = screen.orientation?.type ?? '';
    const processed = sensorProcessor.processOrientation(roll, pitch, yaw, orientationType);
    setOutput(processed);
  }, []);

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity || e.acceleration;
    if (a && (a.x !== null || a.y !== null || a.z !== null)) {
      const ax = a.x ?? 0;
      const ay = a.y ?? 0;
      const az = a.z ?? 0;

      setAcceleration({
        x: Number(ax.toFixed(2)),
        y: Number(ay.toFixed(2)),
        z: Number(az.toFixed(2)),
      });

      if (!hasReceivedEventsRef.current) {
        hasReceivedEventsRef.current = true;
        setAvailability('available');
      }

      // If DeviceOrientationEvent is blocked/absent on this browser (common on Android Chrome over HTTP),
      // compute precise roll & pitch from the accelerometer gravity vector!
      if (!hasReceivedOrientationRef.current) {
        // Phone held in portrait:
        // Tilting right makes ax > 0 (positive roll)
        // Tilting left makes ax < 0 (negative roll)
        const normYZ = Math.sqrt(ay * ay + az * az);
        const roll = Math.atan2(ax, normYZ > 0.001 ? normYZ : 0.001) * (180 / Math.PI);
        // Tilting forward (down) decreases ay / increases az
        const pitch = Math.atan2(ay, az > 0 ? az : 1.0) * (180 / Math.PI);

        rawAnglesRef.current = { roll, pitch, yaw: 0 };
        setRawAngles({ roll, pitch, yaw: 0 });

        if (calibSamplesRef.current !== null) {
          calibSamplesRef.current.push(roll);
        }

        const orientationType = screen.orientation?.type ?? '';
        const processed = sensorProcessor.processOrientation(roll, pitch, 0, orientationType);
        setOutput(processed);
      }
    }

    if (e.rotationRate) {
      setRotationRate({
        alpha: Number((e.rotationRate.alpha ?? 0).toFixed(1)),
        beta:  Number((e.rotationRate.beta  ?? 0).toFixed(1)),
        gamma: Number((e.rotationRate.gamma ?? 0).toFixed(1)),
      });
    }
  }, []);

  // ─── Direct Hardware Sensor Listeners ────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') {
      setAvailability('unavailable');
      return;
    }

    // Check if iOS 13+ requires explicit requestPermission()
    const needsIOSPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function';

    if (needsIOSPermission) {
      setAvailability('permission_needed');
      return;
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('devicemotion', handleMotion, true);

    // Auto-activate sensors on first user gesture if browser throttles background sensors
    const onFirstGesture = () => {
      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('devicemotion', handleMotion, true);
    };
    window.addEventListener('touchstart', onFirstGesture, { once: true, passive: true });
    window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true });

    // On mobile devices with touch, keep active and don't prematurely lock out
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const fallbackTimer = setTimeout(() => {
      if (!hasReceivedEventsRef.current) {
        if (!isTouchDevice) {
          setAvailability((prev) => (prev === 'checking' ? 'unavailable' : prev));
        } else {
          // On mobile, mark as available so driving logic activates immediately
          setAvailability('available');
        }
      }
    }, 2000);

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener('touchstart', onFirstGesture);
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('devicemotion', handleMotion, true);
    };
  }, [handleOrientation, handleMotion]);

  // ─── iOS & Modern Permission Request Flow ─────────────────────────────────

  const requestPermission = useCallback(async () => {
    let orientationGranted = true;
    let motionGranted = true;

    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        orientationGranted = res === 'granted';
      } catch (err) {
        console.error('[GYRO//PLAY] Orientation permission error:', err);
        orientationGranted = false;
      }
    }

    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as any).requestPermission === 'function'
    ) {
      try {
        const res = await (DeviceMotionEvent as any).requestPermission();
        motionGranted = res === 'granted';
      } catch (err) {
        console.error('[GYRO//PLAY] Motion permission error:', err);
        motionGranted = false;
      }
    }

    if (orientationGranted || motionGranted) {
      setAvailability('available');
      hasReceivedEventsRef.current = true;
      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('devicemotion', handleMotion, true);
    } else {
      setAvailability('denied');
    }
  }, [handleOrientation, handleMotion]);

  // ─── Neutral-Position Calibration ────────────────────────────────────────

  const startCalibration = useCallback(() => {
    calibSamplesRef.current = [];
    setCalibrationState('collecting');

    calibTimerRef.current = setTimeout(() => {
      const samples = calibSamplesRef.current;
      const variance = SensorProcessor.computeVariance(samples);

      if (samples.length < 5 || variance > CALIB_VARIANCE_THRESHOLD) {
        // Device was shaking / moving too much — request retry
        setCalibrationState('unstable');
        calibSamplesRef.current = [];
      } else {
        const meanRoll = samples.reduce((a, b) => a + b, 0) / samples.length;
        const { pitch, yaw } = rawAnglesRef.current;

        // Store offsets in processor
        sensorProcessor.calibrateCurrentPosition(meanRoll, pitch, yaw);
        sensorProcessor.resetFilterState();

        setCalibrationState('done');
        calibSamplesRef.current = [];
      }
    }, CALIB_DURATION_MS);
  }, []);

  const cancelCalibration = useCallback(() => {
    if (calibTimerRef.current) {
      clearTimeout(calibTimerRef.current);
      calibTimerRef.current = null;
    }
    calibSamplesRef.current = [];
    setCalibrationState('idle');
  }, []);

  const recalibrate = useCallback(() => {
    cancelCalibration();
    startCalibration();
  }, [cancelCalibration, startCalibration]);

  useEffect(() => {
    return () => {
      if (calibTimerRef.current) clearTimeout(calibTimerRef.current);
    };
  }, []);

  return {
    availability,
    calibrationState,
    output,
    rawAngles,
    acceleration,
    rotationRate,
    requestPermission,
    startCalibration,
    cancelCalibration,
    recalibrate,
  };
}
