/**
 * GYRO//PLAY — Sensor Processing for React Native
 * Ports the browser sensorProcessing.ts logic to pure JS/TS (no DOM dependencies).
 *
 * react-native-sensors provides:
 *   - DeviceOrientationEvent equivalent via gyroscope subscription (rad/s)
 *   - DeviceMotionEvent equivalent via accelerometer subscription (m/s²)
 *   - Absolute device orientation via magnetometer (degrees)
 *
 * We use the `orientation` sensor (alpha/beta/gamma in degrees) to mirror
 * the browser DeviceOrientationEvent, and accelerometer for tilt-throttle.
 */

export interface CalibrationData {
  offsetX: number;   // roll offset
  offsetY: number;   // pitch offset
  offsetZ: number;   // yaw offset
  sensitivity: number;
  deadzone: number;
  invertSteering: boolean;
}

export interface ProcessedOutput {
  steering: number;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  tiltThrottle: number;
  tiltBrake: number;
}

const SMOOTH_ALPHA = 0.18;
const PRECISION_ALPHA = 0.42;
const SMOOTH_MAX_TILT = 30;
const PRECISION_MAX_TILT = 22;

export type ControlProfile = 'smooth' | 'precision';

export class SensorProcessor {
  private calibration: CalibrationData = {
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    sensitivity: 1.0,
    deadzone: 0.05,
    invertSteering: false,
  };

  private profile: ControlProfile = 'smooth';
  private alphaFilter = SMOOTH_ALPHA;
  private maxTiltDegrees = SMOOTH_MAX_TILT;

  // EMA filter state
  private smoothedSteering = 0;
  private smoothedTiltX = 0;
  private smoothedTiltY = 0;

  setProfile(p: ControlProfile) {
    this.profile = p;
    if (p === 'precision') {
      this.alphaFilter = PRECISION_ALPHA;
      this.maxTiltDegrees = PRECISION_MAX_TILT;
      this.calibration.deadzone = 0.03;
      this.calibration.sensitivity = 1.15;
    } else {
      this.alphaFilter = SMOOTH_ALPHA;
      this.maxTiltDegrees = SMOOTH_MAX_TILT;
      this.calibration.deadzone = 0.06;
      this.calibration.sensitivity = 1.0;
    }
  }

  getProfile(): ControlProfile {
    return this.profile;
  }

  calibrateCurrentPosition(roll: number, pitch: number, yaw: number) {
    this.calibration.offsetX = roll;
    this.calibration.offsetY = pitch;
    this.calibration.offsetZ = yaw;
  }

  getCalibration(): CalibrationData {
    return { ...this.calibration };
  }

  resetFilterState() {
    this.smoothedSteering = 0;
    this.smoothedTiltX = 0;
    this.smoothedTiltY = 0;
  }

  setInvertSteering(invert: boolean) {
    this.calibration.invertSteering = invert;
  }

  static computeVariance(samples: number[]): number {
    if (samples.length === 0) return Infinity;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
  }

  /**
   * Process orientation angles (in degrees) into normalized control values.
   *
   * For portrait mode (phone held upright, steering by tilting left/right):
   *   - gamma / roll drives steering
   *   - beta / pitch drives throttle/brake via tilt-forward/backward
   *
   * react-native-sensors orientation sensor provides azimuth/pitch/roll in radians.
   * We receive them already converted to degrees from the hook.
   *
   * @param roll   - Side tilt in degrees (left negative, right positive): γ
   * @param pitch  - Forward/back tilt in degrees: β
   * @param yaw    - Compass heading in degrees: α
   * @param isLandscape - If the phone is held landscape
   */
  processOrientation(
    roll: number,
    pitch: number,
    yaw: number,
    isLandscape = false,
  ): ProcessedOutput {
    const r = roll || 0;
    const p = pitch || 0;
    const y = yaw || 0;

    // Steering axis: roll in portrait, pitch in landscape
    let steeringAngle = isLandscape ? p : r;

    // Zero-offset correction from calibration
    const zeroCorrected = steeringAngle - this.calibration.offsetX;

    // Normalize to [-1, 1]
    let normalized = zeroCorrected / this.maxTiltDegrees;

    // Deadzone with smooth rescaling
    const dz = this.calibration.deadzone;
    if (Math.abs(normalized) < dz) {
      normalized = 0;
    } else {
      const sign = Math.sign(normalized);
      normalized = sign * ((Math.abs(normalized) - dz) / (1 - dz));
    }

    // Sensitivity & inversion
    normalized *= this.calibration.sensitivity;
    if (this.calibration.invertSteering) normalized = -normalized;

    // Clamp
    const clamped = Math.max(-1.0, Math.min(1.0, normalized));

    // EMA low-pass filter
    this.smoothedSteering = this.smoothedSteering + this.alphaFilter * (clamped - this.smoothedSteering);
    this.smoothedTiltX = this.smoothedTiltX + this.alphaFilter * (r - this.smoothedTiltX);
    this.smoothedTiltY = this.smoothedTiltY + this.alphaFilter * (p - this.smoothedTiltY);

    // Tilt throttle/brake (pitch in portrait: tilting forward = throttle)
    const driveTiltDelta = isLandscape
      ? (r - this.calibration.offsetX)
      : (this.calibration.offsetY - p);

    const driveDeadzone = 6.0;
    const maxDriveTilt = 24.0;
    let tiltThrottle = 0;
    let tiltBrake = 0;

    if (driveTiltDelta > driveDeadzone) {
      tiltThrottle = Math.min(1.0, (driveTiltDelta - driveDeadzone) / (maxDriveTilt - driveDeadzone));
    } else if (driveTiltDelta < -driveDeadzone) {
      tiltBrake = Math.min(1.0, (-driveTiltDelta - driveDeadzone) / (maxDriveTilt - driveDeadzone));
    }

    return {
      steering: parseFloat(this.smoothedSteering.toFixed(3)),
      tiltX: parseFloat(this.smoothedTiltX.toFixed(1)),
      tiltY: parseFloat(this.smoothedTiltY.toFixed(1)),
      tiltZ: parseFloat(y.toFixed(1)),
      tiltThrottle: parseFloat(tiltThrottle.toFixed(2)),
      tiltBrake: parseFloat(tiltBrake.toFixed(2)),
    };
  }
}

export const sensorProcessor = new SensorProcessor();
