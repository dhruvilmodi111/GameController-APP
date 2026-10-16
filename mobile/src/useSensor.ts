/**
 * GYRO//PLAY — React Native Motion Sensor Engine
 *
 * Direct hardware integration with Android / iOS IMU sensors using react-native-sensors.
 * Supports:
 *   1. Hardware sensor fusion (orientation: pitch, roll, yaw)
 *   2. Gyroscope + Accelerometer complementary filter fallback (60Hz)
 *   3. 2-second stationary calibration with variance validation
 *   4. Deadband filtering and exponential moving average (EMA)
 *   5. Manual touch steering & pedal fallback for emulator testing
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  gyroscope,
  accelerometer,
  orientation,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors';
import { Subscription } from 'rxjs';
import { Vibration } from 'react-native';
import { sensorProcessor, SensorProcessor, ProcessedOutput } from './sensorProcessing';

export type SensorAvailability =
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'denied';

export type CalibrationState = 'idle' | 'collecting' | 'unstable' | 'done';

export interface RawAngles {
  roll: number;   // γ — left/right tilt in degrees
  pitch: number;  // β — forward/back in degrees
  yaw: number;    // α — compass heading in degrees
}

export interface AccelerationData {
  x: number;
  y: number;
  z: number;
}

export interface UseSensorReturn {
  availability: SensorAvailability;
  calibrationState: CalibrationState;
  output: ProcessedOutput;
  rawAngles: RawAngles;
  acceleration: AccelerationData;
  startCalibration: () => void;
  cancelCalibration: () => void;
  recalibrate: () => void;
  setManualSteering: (val: number) => void;
  setManualThrottle: (val: number) => void;
  setManualBrake: (val: number) => void;
}

const CALIB_DURATION_MS = 2000;
const CALIB_VARIANCE_THRESHOLD = 5.0;
const SENSOR_INTERVAL_MS = 16; // ~60 Hz
const GRAVITY = 9.81;
const ALPHA_HP = 0.8;

export function useSensor(): UseSensorReturn {
  const [availability, setAvailability] = useState<SensorAvailability>('checking');
  const [calibrationState, setCalibrationState] = useState<CalibrationState>('idle');
  const [output, setOutput] = useState<ProcessedOutput>({
    steering: 0,
    tiltX: 0,
    tiltY: 0,
    tiltZ: 0,
    tiltThrottle: 0,
    tiltBrake: 0,
  });
  const [rawAngles, setRawAngles] = useState<RawAngles>({ roll: 0, pitch: 0, yaw: 0 });
  const [acceleration, setAcceleration] = useState<AccelerationData>({ x: 0, y: 0, z: 0 });

  // Angle tracking refs
  const anglesRef = useRef<RawAngles>({ roll: 0, pitch: 0, yaw: 0 });
  const lastTimestampRef = useRef<number | null>(null);
  const gravityRef = useRef({ x: 0, y: 0, z: GRAVITY });

  // Manual inputs for desktop testing / fallback
  const manualSteeringRef = useRef<number | null>(null);
  const manualThrottleRef = useRef<number | null>(null);
  const manualBrakeRef = useRef<number | null>(null);

  // Calibration samples
  const calibSamplesRef = useRef<number[]>([]);
  const calibTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscriptions
  const orientationSubRef = useRef<Subscription | null>(null);
  const gyroSubRef = useRef<Subscription | null>(null);
  const accelSubRef = useRef<Subscription | null>(null);

  // ─── Process & Emit Update ────────────────────────────────────────────────
  const processAndSetOutput = useCallback((roll: number, pitch: number, yaw: number) => {
    // If in calibration, accumulate roll samples
    if (calibSamplesRef.current !== null) {
      calibSamplesRef.current.push(roll);
    }

    const processed = sensorProcessor.processOrientation(roll, pitch, yaw, false);

    // Apply manual overrides if user is actively using on-screen touch controls
    if (manualSteeringRef.current !== null) {
      processed.steering = manualSteeringRef.current;
    }
    if (manualThrottleRef.current !== null) {
      processed.tiltThrottle = manualThrottleRef.current;
    }
    if (manualBrakeRef.current !== null) {
      processed.tiltBrake = manualBrakeRef.current;
    }

    setOutput(processed);
  }, []);

  // ─── Sensor Setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    let sensorActive = false;
    let initTimeout: ReturnType<typeof setTimeout>;

    try {
      setUpdateIntervalForType(SensorTypes.orientation, SENSOR_INTERVAL_MS);
      setUpdateIntervalForType(SensorTypes.gyroscope, SENSOR_INTERVAL_MS);
      setUpdateIntervalForType(SensorTypes.accelerometer, SENSOR_INTERVAL_MS);
    } catch {
      // Ignore update interval failures on some platforms
    }

    // 1. Try Hardware Sensor Fusion Orientation first
    try {
      const orientSub = orientation.subscribe({
        next: (data: any) => {
          if (!sensorActive) {
            sensorActive = true;
            setAvailability('available');
          }
          // data contains pitch, roll, yaw (in degrees or rads depending on platform)
          // react-native-sensors orientation angles are in degrees:
          const roll = typeof data.roll === 'number' ? data.roll : 0;
          const pitch = typeof data.pitch === 'number' ? data.pitch : 0;
          const yaw = typeof data.yaw === 'number' ? data.yaw : 0;

          anglesRef.current = { roll, pitch, yaw };
          setRawAngles({ roll, pitch, yaw });
          processAndSetOutput(roll, pitch, yaw);
        },
        error: () => {
          // If orientation sensor not available, fall back to gyro + accel
          subscribeGyroAccel();
        },
      });
      orientationSubRef.current = orientSub;
    } catch {
      subscribeGyroAccel();
    }

    // 2. Gyroscope + Accelerometer Complementary Filter Fallback
    function subscribeGyroAccel() {
      try {
        const gyroSub = gyroscope.subscribe({
          next: ({ x, y, z, timestamp }) => {
            if (!sensorActive) {
              sensorActive = true;
              setAvailability('available');
            }

            const now = timestamp || Date.now();
            const dt = lastTimestampRef.current !== null
              ? Math.min((now - lastTimestampRef.current) / 1000, 0.1)
              : SENSOR_INTERVAL_MS / 1000;
            lastTimestampRef.current = now;

            // Gyroscope yields rad/s → convert to degrees
            const dRoll  = (y * (180 / Math.PI)) * dt;
            const dPitch = (x * (180 / Math.PI)) * dt;
            const dYaw   = (z * (180 / Math.PI)) * dt;

            anglesRef.current = {
              roll:  anglesRef.current.roll  + dRoll,
              pitch: anglesRef.current.pitch + dPitch,
              yaw:   anglesRef.current.yaw   + dYaw,
            };

            const { roll, pitch, yaw } = anglesRef.current;
            setRawAngles({ roll, pitch, yaw });
            processAndSetOutput(roll, pitch, yaw);
          },
          error: () => {
            setAvailability('unavailable');
          },
        });
        gyroSubRef.current = gyroSub;
      } catch {
        setAvailability('unavailable');
      }

      try {
        const accelSub = accelerometer.subscribe({
          next: ({ x, y, z }) => {
            // Low-pass filter to isolate gravity
            gravityRef.current = {
              x: ALPHA_HP * gravityRef.current.x + (1 - ALPHA_HP) * x,
              y: ALPHA_HP * gravityRef.current.y + (1 - ALPHA_HP) * y,
              z: ALPHA_HP * gravityRef.current.z + (1 - ALPHA_HP) * z,
            };

            const g = gravityRef.current;
            const accelRoll  = Math.atan2(g.x, Math.sqrt(g.y * g.y + g.z * g.z)) * (180 / Math.PI);
            const accelPitch = Math.atan2(-g.y, g.z) * (180 / Math.PI);

            // 98% Gyro integration + 2% Gravity correction
            const CF_ALPHA = 0.02;
            anglesRef.current = {
              roll:  (1 - CF_ALPHA) * anglesRef.current.roll  + CF_ALPHA * accelRoll,
              pitch: (1 - CF_ALPHA) * anglesRef.current.pitch + CF_ALPHA * accelPitch,
              yaw:   anglesRef.current.yaw,
            };

            setAcceleration({
              x: parseFloat((x - g.x).toFixed(2)),
              y: parseFloat((y - g.y).toFixed(2)),
              z: parseFloat((z - g.z).toFixed(2)),
            });
          },
          error: () => { /* optional */ },
        });
        accelSubRef.current = accelSub;
      } catch { /* optional */ }
    }

    // Sensor availability timeout
    initTimeout = setTimeout(() => {
      if (!sensorActive) {
        setAvailability('unavailable');
      }
    }, 2500);

    return () => {
      clearTimeout(initTimeout);
      orientationSubRef.current?.unsubscribe();
      gyroSubRef.current?.unsubscribe();
      accelSubRef.current?.unsubscribe();
    };
  }, [processAndSetOutput]);

  // ─── Calibration ─────────────────────────────────────────────────────────
  const startCalibration = useCallback(() => {
    calibSamplesRef.current = [];
    setCalibrationState('collecting');

    try {
      Vibration.vibrate(50);
    } catch { /* ignore */ }

    calibTimerRef.current = setTimeout(() => {
      const samples = calibSamplesRef.current;
      const variance = SensorProcessor.computeVariance(samples);

      if (samples.length < 5 || variance > CALIB_VARIANCE_THRESHOLD) {
        setCalibrationState('unstable');
        calibSamplesRef.current = [];
        try {
          Vibration.vibrate([0, 80, 50, 80]);
        } catch { /* ignore */ }
      } else {
        const meanRoll = samples.reduce((a, b) => a + b, 0) / samples.length;
        const { pitch, yaw } = anglesRef.current;

        sensorProcessor.calibrateCurrentPosition(meanRoll, pitch, yaw);
        sensorProcessor.resetFilterState();

        anglesRef.current = { roll: 0, pitch, yaw };

        setCalibrationState('done');
        calibSamplesRef.current = [];
        try {
          Vibration.vibrate(100);
        } catch { /* ignore */ }
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

  // ─── Manual Controls for Fallback / Testing ──────────────────────────────
  const setManualSteering = useCallback((val: number) => {
    manualSteeringRef.current = val;
    setOutput(prev => ({ ...prev, steering: val }));
  }, []);

  const setManualThrottle = useCallback((val: number) => {
    manualThrottleRef.current = val;
    setOutput(prev => ({ ...prev, tiltThrottle: val }));
  }, []);

  const setManualBrake = useCallback((val: number) => {
    manualBrakeRef.current = val;
    setOutput(prev => ({ ...prev, tiltBrake: val }));
  }, []);

  return {
    availability,
    calibrationState,
    output,
    rawAngles,
    acceleration,
    startCalibration,
    cancelCalibration,
    recalibrate,
    setManualSteering,
    setManualThrottle,
    setManualBrake,
  };
}
