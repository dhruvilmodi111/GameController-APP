import type { MotionData, CalibrationData } from '@shared/types';

export type ControlProfile = 'smooth' | 'precision';

// Profile presets
const PROFILES: Record<ControlProfile, { alpha: number; maxTilt: number; deadzone: number; sensitivity: number }> = {
  smooth: {
    alpha: 0.18,      // Heavy low-pass filter — very stable, less twitchy
    maxTilt: 30,      // Max steering tilt in degrees
    deadzone: 0.06,
    sensitivity: 1.0,
  },
  precision: {
    alpha: 0.42,      // Lighter filter — more responsive to micro-corrections
    maxTilt: 22,      // Tighter range = higher precision per degree of tilt
    deadzone: 0.03,
    sensitivity: 1.15,
  },
};

export class SensorProcessor {
  private calibration: CalibrationData = {
    offsetX: 0,
    offsetY: 42.0, // Default natural resting pitch angle (approx 42 deg)
    offsetZ: 0,
    sensitivity: 1.0,
    deadzone: 0.05,
    invertSteering: false,
  };

  private profile: ControlProfile = 'smooth';
  private alphaFilter = PROFILES.smooth.alpha;
  private maxTiltDegrees = PROFILES.smooth.maxTilt;

  // EMA filter state
  private smoothedSteering = 0;
  private smoothedTiltX = 0;
  private smoothedTiltY = 0;

  public setProfile(p: ControlProfile) {
    this.profile = p;
    const preset = PROFILES[p];
    this.alphaFilter = preset.alpha;
    this.maxTiltDegrees = preset.maxTilt;
    // Merge profile defaults into calibration without overwriting user offsets
    this.calibration.deadzone = preset.deadzone;
    this.calibration.sensitivity = preset.sensitivity;
  }

  public getProfile(): ControlProfile {
    return this.profile;
  }

  public setCalibration(calibration: Partial<CalibrationData>) {
    this.calibration = { ...this.calibration, ...calibration };
  }

  public getCalibration(): CalibrationData {
    return { ...this.calibration };
  }

  public getAlphaFilter(): number {
    return this.alphaFilter;
  }

  public setAlphaFilter(alpha: number) {
    this.alphaFilter = Math.max(0.05, Math.min(0.8, alpha));
  }

  public getMaxTilt(): number {
    return this.maxTiltDegrees;
  }

  public setMaxTilt(degrees: number) {
    this.maxTiltDegrees = Math.max(12, Math.min(60, degrees));
  }

  public calibrateCurrentPosition(roll: number, pitch: number, yaw: number) {
    this.calibration.offsetX = roll;
    this.calibration.offsetY = (pitch !== 0 && !isNaN(pitch)) ? pitch : 42.0;
    this.calibration.offsetZ = yaw;
  }

  public resetCalibration() {
    this.calibration.offsetX = 0;
    this.calibration.offsetY = 42.0;
    this.calibration.offsetZ = 0;
    // Reset EMA filter state to avoid jump artefact
    this.smoothedSteering = 0;
    this.smoothedTiltX = 0;
    this.smoothedTiltY = 0;
  }

  /**
   * Reset EMA state immediately (call after calibration is applied
   * so the filtered output doesn't drift from the old neutral).
   */
  public resetFilterState() {
    this.smoothedSteering = 0;
    this.smoothedTiltX = 0;
    this.smoothedTiltY = 0;
  }

  /**
   * Computes variance of a number array. Used to detect steady hold
   * during calibration: low variance = phone is still.
   */
  public static computeVariance(samples: number[]): number {
    if (samples.length === 0) return Infinity;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
  }

  /**
   * Processes raw DeviceOrientationEvent angles into normalized MotionData.
   * Handles portrait and landscape-primary / landscape-secondary orientations.
   *
   * gamma (roll):  left/right tilt, range [-90, 90]
   * beta  (pitch): front/back tilt, range [-180, 180]
   * alpha (yaw):   compass direction [0, 360]
   */
  public processOrientation(
    rawRoll: number,   // gamma
    rawPitch: number,  // beta
    rawYaw: number,    // alpha
    orientationType?: string
  ): { steering: number; tiltX: number; tiltY: number; tiltZ: number; tiltThrottle: number; tiltBrake: number } {
    const roll  = rawRoll  || 0;
    const pitch = rawPitch || 0;
    const yaw   = rawYaw   || 0;

    // Detect screen orientation
    const isLandscape =
      orientationType?.includes('landscape') ||
      Math.abs((window.orientation as number) || 0) === 90;
    const isLandscapeSecondary =
      orientationType === 'landscape-secondary' ||
      (window.orientation as number) === -90;

    // In landscape, beta (pitch) drives steering; in portrait, gamma (roll) does.
    let steeringAngle: number;
    if (isLandscape) {
      steeringAngle = isLandscapeSecondary ? -pitch : pitch;
    } else {
      steeringAngle = roll;
    }

    // Zero-offset (calibration)
    const neutralAngle = isLandscape
      ? (isLandscapeSecondary ? -this.calibration.offsetY : this.calibration.offsetY)
      : this.calibration.offsetX;
    const zeroCorrected = steeringAngle - neutralAngle;

    // Normalize to [-1, 1] over the profile's maxTilt range
    let normalized = zeroCorrected / this.maxTiltDegrees;

    // Apply deadzone with smooth rescaling
    if (Math.abs(normalized) < this.calibration.deadzone) {
      normalized = 0;
    } else {
      const sign = Math.sign(normalized);
      normalized = sign * (
        (Math.abs(normalized) - this.calibration.deadzone) /
        (1 - this.calibration.deadzone)
      );
    }

    // Sensitivity & inversion
    normalized *= this.calibration.sensitivity;
    if (this.calibration.invertSteering) normalized = -normalized;

    // Hard clamp to [-1, 1]
    const clamped = Math.max(-1.0, Math.min(1.0, normalized));

    // Exponential Moving Average (low-pass filter)
    this.smoothedSteering = this.smoothedSteering + this.alphaFilter * (clamped - this.smoothedSteering);
    this.smoothedTiltX    = this.smoothedTiltX    + this.alphaFilter * (roll  - this.smoothedTiltX);
    this.smoothedTiltY    = this.smoothedTiltY    + this.alphaFilter * (pitch - this.smoothedTiltY);

    // Forward/Backward Tilt-to-Drive (Acceleration & Braking)
    // In portrait, pitch changes as the phone is tilted forward (away) vs back (toward user).
    // In landscape, roll changes as the top edge is pushed forward vs pulled back.
    let driveTiltDelta: number;
    if (isLandscape) {
      driveTiltDelta = (roll - this.calibration.offsetX);
      if (isLandscapeSecondary) driveTiltDelta = -driveTiltDelta;
    } else {
      // Resting angle is offsetY (e.g. 35-45°). Tilting forward decreases pitch.
      const restingPitch = (this.calibration.offsetY > 10 && this.calibration.offsetY < 80) ? this.calibration.offsetY : 42.0;
      driveTiltDelta = restingPitch - pitch;
    }

    const driveDeadzone = 6.0; // degrees deadband around resting grip
    const maxDriveTilt = 24.0; // degrees for 100% full throttle or full brake
    let tiltThrottle = 0;
    let tiltBrake = 0;

    if (driveTiltDelta > driveDeadzone) {
      tiltThrottle = Math.min(1.0, (driveTiltDelta - driveDeadzone) / (maxDriveTilt - driveDeadzone));
    } else if (driveTiltDelta < -driveDeadzone) {
      tiltBrake = Math.min(1.0, (-driveTiltDelta - driveDeadzone) / (maxDriveTilt - driveDeadzone));
    }

    return {
      steering: Number(this.smoothedSteering.toFixed(3)),
      tiltX:    Number(this.smoothedTiltX.toFixed(1)),
      tiltY:    Number(this.smoothedTiltY.toFixed(1)),
      tiltZ:    Number(yaw.toFixed(1)),
      tiltThrottle: Number(tiltThrottle.toFixed(2)),
      tiltBrake: Number(tiltBrake.toFixed(2)),
    };
  }

  public createMotionPayload(
    steering: number,
    tiltX: number,
    tiltY: number,
    tiltZ: number,
    throttle: number,
    brake: number,
    nitro: boolean,
    handbrake: boolean,
    accel?: { x: number; y: number; z: number },
    seq?: number
  ): MotionData {
    return {
      seq,
      steering,
      tiltX,
      tiltY,
      tiltZ,
      throttle,
      brake,
      nitro,
      handbrake,
      timestamp: performance.now(),
      accel,
    };
  }
}

export const sensorProcessor = new SensorProcessor();
