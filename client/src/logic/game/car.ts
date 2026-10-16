import type { ParticleSystem } from './particles';

export class Car {
  public x = 320;
  public y = 800;
  public angle = 0; // In radians, 0 = pointing right
  public speed = 0;
  public maxSpeed = 9.8;
  public maxReverseSpeed = -3.4;
  public accel = 0.182;
  public brakeDecel = 0.33;
  public friction = 0.988;
  public turnSpeed = 0.054;

  // Visual Steering
  public currentSteer = 0;
  public isBraking = false;

  // Nitro
  public nitroActive = false;
  public nitroFuel = 100; // 0 to 100
  public nitroMaxBoost = 14.5;

  // Drifting
  public isDrifting = false;
  public driftAngle = 0;

  // Dimensions - Wider, aggressive supercar proportions
  public width = 52;
  public height = 26;

  // Visuals — Championship Racing Red Supercar
  public bodyColor = '#FF2A3A';      // Ferrari Racing Red
  public accentColor = '#FFFFFF';    // Alpine White Racing Insets
  public cockpitColor = 'rgba(255, 60, 75, 0.50)';

  public reset(startX = 320, startY = 800, startAngle = 0) {
    this.x = startX;
    this.y = startY;
    this.angle = startAngle;
    this.speed = 0;
    this.nitroFuel = 100;
    this.isDrifting = false;
    this.nitroActive = false;
    this.currentSteer = 0;
    this.isBraking = false;
  }

  public update(
    inputSteering: number,
    inputThrottle: number,
    inputBrake: number,
    inputNitro: boolean,
    inputHandbrake: boolean,
    isOnGrass: boolean,
    particles: ParticleSystem,
    dtFactor = 1.0
  ) {
    this.currentSteer = inputSteering;
    this.isBraking = inputBrake > 0.05;

    // 1. Nitro logic
    if (inputNitro && this.nitroFuel > 0 && inputThrottle > 0.1) {
      this.nitroActive = true;
      this.nitroFuel = Math.max(0, this.nitroFuel - 0.45 * dtFactor);
    } else {
      this.nitroActive = false;
      // Passive nitro regeneration
      if (!inputNitro && this.nitroFuel < 100) {
        this.nitroFuel = Math.min(100, this.nitroFuel + 0.09 * dtFactor);
      }
    }

    // 2. Acceleration & Braking with momentum
    const topSpeed = this.nitroActive ? this.nitroMaxBoost : this.maxSpeed;
    const currentMaxSpeed = isOnGrass ? topSpeed * 0.42 : topSpeed;

    if (inputThrottle > 0) {
      const boostMult = this.nitroActive ? 1.65 : 1.0;
      this.speed += this.accel * inputThrottle * boostMult * dtFactor;
      if (this.speed > currentMaxSpeed) {
        this.speed = currentMaxSpeed;
      }
    }

    if (inputBrake > 0) {
      if (this.speed > 0) {
        this.speed -= this.brakeDecel * inputBrake * dtFactor;
      } else {
        // Reverse
        this.speed -= this.accel * 0.75 * inputBrake * dtFactor;
        if (this.speed < this.maxReverseSpeed) {
          this.speed = this.maxReverseSpeed;
        }
      }
    }

    // 3. Friction & Rolling Resistance
    const currentFriction = isOnGrass ? Math.pow(0.93, dtFactor) : Math.pow(this.friction, dtFactor);
    this.speed *= currentFriction;
    if (Math.abs(this.speed) < 0.02) {
      this.speed = 0;
    }

    // 4. Steering & Drifting
    const speedFactor = Math.min(1.0, Math.abs(this.speed) / 2.8);
    const direction = this.speed >= 0 ? 1 : -1;

    // Drifting triggered by handbrake or high-speed sharp turns
    const isSharpTurn = Math.abs(inputSteering) > 0.65 && Math.abs(this.speed) > 5.2;
    this.isDrifting = (inputHandbrake || isSharpTurn) && Math.abs(this.speed) > 2.8;

    let effectiveTurnSpeed = this.turnSpeed;
    if (this.isDrifting) {
      effectiveTurnSpeed *= 1.48;
      this.speed *= Math.pow(0.984, dtFactor); // Drift scrub
    }

    this.angle += inputSteering * effectiveTurnSpeed * speedFactor * direction * dtFactor;

    // 5. Restrained particle effects
    if (this.isDrifting) {
      const rearX = this.x - Math.cos(this.angle) * 16;
      const rearY = this.y - Math.sin(this.angle) * 16;
      particles.emitSmoke(rearX, rearY, this.angle);
    }

    if (this.nitroActive) {
      const exhaustX = this.x - Math.cos(this.angle) * 20;
      const exhaustY = this.y - Math.sin(this.angle) * 20;
      particles.emitNitro(exhaustX, exhaustY, this.angle);
    }

    // 6. Update Position
    this.x += Math.cos(this.angle) * this.speed * dtFactor;
    this.y += Math.sin(this.angle) * this.speed * dtFactor;
  }

  /**
   * Resolves barrier collision by reflecting the outward velocity vector
   * and pushing the car safely back onto the track.
   */
  public handleBarrierCollision(normalX: number, normalY: number, penetration: number) {
    // Reposition car inside boundary
    this.x -= normalX * (penetration + 1.5);
    this.y -= normalY * (penetration + 1.5);

    const vx = Math.cos(this.angle) * this.speed;
    const vy = Math.sin(this.angle) * this.speed;
    const vDotN = vx * normalX + vy * normalY;

    if (vDotN > 0) {
      // Rebound away from barrier
      const bounce = 0.32;
      const newVx = vx - (1 + bounce) * vDotN * normalX;
      const newVy = vy - (1 + bounce) * vDotN * normalY;
      this.speed = Math.hypot(newVx, newVy) * 0.70; // Scrub forward momentum
      this.angle = Math.atan2(newVy, newVx);
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    // 1. Dynamic Racing Red Underglow (soft ground reflection)
    ctx.save();
    const glowColor = this.nitroActive ? '#00f0ff' : this.bodyColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = this.nitroActive ? 26 : 16;
    ctx.fillStyle = this.nitroActive ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 42, 58, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, halfW + 6, halfH + 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Soft Dynamic Car Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
    ctx.beginPath();
    ctx.roundRect(-halfW + 4, -halfH + 6, this.width - 2, this.height, 8);
    ctx.fill();

    // 3. Headlight Light Cones (Forward Projector Beams)
    ctx.save();
    const beamGrad = ctx.createRadialGradient(halfW + 6, 0, 5, halfW + 55, 0, 50);
    beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.30)');
    beamGrad.addColorStop(0.4, 'rgba(255, 240, 220, 0.12)');
    beamGrad.addColorStop(1, 'rgba(255, 240, 220, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(halfW - 2, -halfH + 4);
    ctx.lineTo(halfW + 65, -halfH - 12);
    ctx.lineTo(halfW + 65, halfH + 12);
    ctx.lineTo(halfW - 2, halfH - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Wheels with Steer Angle & Brake Calipers
    const steerAngle = this.currentSteer * 0.40; // radians
    // Front Turned Wheels
    this.drawWheel(ctx, halfW - 13, -halfH - 2, steerAngle);
    this.drawWheel(ctx, halfW - 13, halfH + 2, steerAngle);
    // Rear Fixed Wheels
    this.drawWheel(ctx, -halfW + 11, -halfH - 2, 0);
    this.drawWheel(ctx, -halfW + 11, halfH + 2, 0);

    // 5. Front Aerodynamic Carbon Splitter
    ctx.fillStyle = '#0a0d11';
    ctx.beginPath();
    ctx.moveTo(halfW + 4, 0);
    ctx.lineTo(halfW + 1, -halfH - 1);
    ctx.lineTo(halfW - 6, -halfH - 1);
    ctx.lineTo(halfW - 6, halfH + 1);
    ctx.lineTo(halfW + 1, halfH + 1);
    ctx.closePath();
    ctx.fill();

    // 6. Sculpted Supercar Body Chassis (Ferrari/Le Mans Prototype Curves)
    ctx.beginPath();
    ctx.moveTo(halfW + 2, 0);                    // Pointed front nose
    ctx.lineTo(halfW - 4, -halfH + 2);           // Front left fender
    ctx.lineTo(halfW - 12, -halfH);              // Wheel arch front
    ctx.lineTo(-halfW + 16, -halfH);             // Door waist
    ctx.lineTo(-halfW + 10, -halfH - 1);         // Rear muscular haunch
    ctx.lineTo(-halfW + 1, -halfH + 1);          // Rear left corner
    ctx.lineTo(-halfW - 2, -halfH + 6);          // Rear bumper edge
    ctx.lineTo(-halfW - 2, halfH - 6);           // Diffuser center
    ctx.lineTo(-halfW + 1, halfH - 1);           // Rear right corner
    ctx.lineTo(-halfW + 10, halfH + 1);          // Rear muscular haunch
    ctx.lineTo(-halfW + 16, halfH);              // Door waist
    ctx.lineTo(halfW - 12, halfH);               // Wheel arch front
    ctx.lineTo(halfW - 4, halfH - 2);            // Front right fender
    ctx.closePath();

    // Body Gradient: Deep Metallic Crimson Red
    const bodyGrad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    bodyGrad.addColorStop(0, '#D41427');
    bodyGrad.addColorStop(0.45, '#FF2E43');
    bodyGrad.addColorStop(0.55, '#FF3D52');
    bodyGrad.addColorStop(1, '#B30B1C');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Fine chassis seam outline
    ctx.strokeStyle = '#800612';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 7. Center Carbon Racing Stripe & Hood Vents
    ctx.fillStyle = '#11141a';
    ctx.beginPath();
    ctx.moveTo(halfW - 3, -3);
    ctx.lineTo(halfW - 3, 3);
    ctx.lineTo(-halfW + 4, 3);
    ctx.lineTo(-halfW + 4, -3);
    ctx.closePath();
    ctx.fill();

    // Alpine White Pin-Stripes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(halfW - 12, -3.5, 14, 0.8);
    ctx.fillRect(halfW - 12, 2.7, 14, 0.8);

    // 8. Jet-Fighter Cockpit Canopy (Tinted Gloss Glass with Reflection)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(2, 0, 12, 7.5, 0, 0, Math.PI * 2);
    const glassGrad = ctx.createLinearGradient(0, -7, 0, 7);
    glassGrad.addColorStop(0, 'rgba(20, 25, 32, 0.95)');
    glassGrad.addColorStop(0.35, 'rgba(40, 50, 65, 0.9)');
    glassGrad.addColorStop(0.7, 'rgba(15, 18, 24, 0.95)');
    glassGrad.addColorStop(1, 'rgba(10, 12, 16, 0.98)');
    ctx.fillStyle = glassGrad;
    ctx.fill();
    ctx.strokeStyle = '#FF2A3A';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Canopy Sun Glare Reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.40)';
    ctx.beginPath();
    ctx.ellipse(3, -3, 8, 2.2, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 9. Rear Carbon GT Wing with Endplates
    ctx.fillStyle = '#0d1015';
    ctx.beginPath();
    ctx.roundRect(-halfW - 4, -halfH - 1, 4, this.height + 2, 1.5);
    ctx.fill();
    // Wing endplates (red accents)
    ctx.fillStyle = '#FF2A3A';
    ctx.fillRect(-halfW - 5, -halfH - 2, 5, 2);
    ctx.fillRect(-halfW - 5, halfH, 5, 2);

    // 10. Front Angled LED Projector Headlights
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(halfW - 3, -halfH + 3);
    ctx.lineTo(halfW + 1, -halfH + 6);
    ctx.lineTo(halfW - 5, -halfH + 7);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(halfW - 3, halfH - 3);
    ctx.lineTo(halfW + 1, halfH - 6);
    ctx.lineTo(halfW - 5, halfH - 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 11. Full-Width Cyber Taillight Bar (Glows brighter on braking)
    ctx.save();
    const brakeActive = this.isBraking;
    const tailColor = brakeActive ? '#FF1122' : '#FF3344';
    ctx.fillStyle = tailColor;
    ctx.shadowColor = tailColor;
    ctx.shadowBlur = brakeActive ? 18 : 9;
    ctx.fillRect(-halfW - 1, -halfH + 5, 2, this.height - 10);
    ctx.restore();

    // 12. Dual Exhaust Tips & Nitro Flame Emitter Ports
    ctx.fillStyle = '#4a5568';
    ctx.beginPath();
    ctx.arc(-halfW - 1, -4, 2, 0, Math.PI * 2);
    ctx.arc(-halfW - 1, 4, 2, 0, Math.PI * 2);
    ctx.fill();

    if (this.nitroActive) {
      ctx.save();
      ctx.fillStyle = '#00F0FF';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(-halfW - 4, -4, 3, 0, Math.PI * 2);
      ctx.arc(-halfW - 4, 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawWheel(ctx: CanvasRenderingContext2D, wx: number, wy: number, angle: number) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(angle);

    // Tire Rubber
    ctx.fillStyle = '#111418';
    ctx.beginPath();
    ctx.roundRect(-6.5, -3.2, 13, 6.4, 2);
    ctx.fill();

    // Alloy Rim Center
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(-4, -1.8, 8, 3.6);

    // High-performance Red Brake Caliper
    ctx.fillStyle = '#FF2A3A';
    ctx.fillRect(-2, -3.2, 4, 1.4);

    ctx.restore();
  }

  public getSpeedKmh(): number {
    return Math.round(Math.abs(this.speed) * 22);
  }
}
