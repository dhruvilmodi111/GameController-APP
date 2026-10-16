export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];

  public emitSmoke(x: number, y: number, angle: number) {
    const spread = (Math.random() - 0.5) * 0.5;
    const speed = Math.random() * 2 + 1;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: Math.cos(angle + Math.PI + spread) * speed,
      vy: Math.sin(angle + Math.PI + spread) * speed,
      radius: Math.random() * 4 + 3,
      color: 'rgba(200, 220, 255,',
      alpha: 0.6,
      decay: 0.03,
    });
  }

  public emitNitro(x: number, y: number, angle: number) {
    const spread = (Math.random() - 0.5) * 0.3;
    const speed = Math.random() * 5 + 4;
    const isCyan = Math.random() > 0.4;
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle + Math.PI + spread) * speed,
      vy: Math.sin(angle + Math.PI + spread) * speed,
      radius: Math.random() * 5 + 4,
      color: isCyan ? 'rgba(0, 240, 255,' : 'rgba(255, 0, 128,',
      alpha: 0.9,
      decay: 0.05,
    });
  }

  public emitSparks(x: number, y: number, normalAngle: number, isNeonRush = false) {
    const count = Math.floor(Math.random() * 4 + 4);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.4;
      const speed = Math.random() * 4.5 + 2.0;
      const color = isNeonRush
        ? (Math.random() > 0.5 ? 'rgba(255, 0, 128,' : 'rgba(0, 240, 255,')
        : (Math.random() > 0.4 ? 'rgba(255, 42, 58,' : 'rgba(255, 220, 100,');

      this.particles.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(normalAngle + spread) * speed,
        vy: Math.sin(normalAngle + spread) * speed,
        radius: Math.random() * 2.2 + 1.2,
        color,
        alpha: 1.0,
        decay: 0.065,
      });
    }
  }

  public emitConfetti(x: number, y: number) {
    const palette = [
      'rgba(255, 42, 58,',
      'rgba(0, 240, 255,',
      'rgba(255, 255, 255,',
      'rgba(255, 0, 128,',
      'rgba(255, 184, 0,',
    ];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      const color = palette[Math.floor(Math.random() * palette.length)];
      this.particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        radius: Math.random() * 4 + 2,
        color,
        alpha: 1.0,
        decay: 0.015,
      });
    }
  }

  public update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.radius *= 1.02;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color} ${p.alpha})`;
      ctx.fill();
      ctx.restore();
    }
  }

  public clear() {
    this.particles = [];
  }
}
