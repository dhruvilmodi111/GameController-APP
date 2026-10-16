export interface Waypoint {
  x: number;
  y: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
}

export interface TrackCollisionInfo {
  dist: number;
  signedDist: number;
  closestX: number;
  closestY: number;
  normalX: number;
  normalY: number;
  tangentX: number;
  tangentY: number;
  isOnRoad: boolean;
  isOnGrass: boolean;
  isCollidingBarrier: boolean;
  penetration: number;
  progress: number;
}

export class RaceTrack {
  public width = 1600;
  public height = 1000;
  public roadWidth = 210; // Widened almost double (from 114) for spacious high-speed racing
  public barrierLimit = 120; // roadWidth / 2 + 15px perimeter margin

  // Circuit waypoints forming a continuous closed loop
  public waypoints: Waypoint[] = [
    { x: 300, y: 800 },  // Start / Finish straight
    { x: 600, y: 800 },
    { x: 950, y: 800 },
    { x: 1300, y: 700 }, // Turn 1 (Fast Right)
    { x: 1420, y: 450 },
    { x: 1300, y: 220 }, // Turn 2 (Sweeping Left)
    { x: 1000, y: 160 },
    { x: 750, y: 260 },  // Chicane Entry
    { x: 600, y: 180 },  // Chicane Apex
    { x: 380, y: 220 },
    { x: 200, y: 380 },  // Hairpin Left
    { x: 260, y: 580 },
    { x: 200, y: 720 },  // Final Corner
  ];

  public checkpoints: Waypoint[];
  public sampledSpline: TrackPoint[] = [];

  constructor() {
    this.checkpoints = [...this.waypoints];
    this.buildSampledSpline();
  }

  /**
   * Pre-samples the closed quadratic bezier curve into equidistant TrackPoints
   * with tangents and normals for pixel-accurate collision detection.
   */
  private buildSampledSpline() {
    const pts = this.waypoints;
    const len = pts.length;
    const samplesPerSegment = 24;
    const rawPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < len; i++) {
      const pPrev = pts[(i - 1 + len) % len];
      const pCurr = pts[i];
      const pNext = pts[(i + 1) % len];

      const startX = (pPrev.x + pCurr.x) / 2;
      const startY = (pPrev.y + pCurr.y) / 2;
      const endX = (pCurr.x + pNext.x) / 2;
      const endY = (pCurr.y + pNext.y) / 2;

      for (let s = 0; s < samplesPerSegment; s++) {
        const t = s / samplesPerSegment;
        const invT = 1 - t;
        const x = invT * invT * startX + 2 * invT * t * pCurr.x + t * t * endX;
        const y = invT * invT * startY + 2 * invT * t * pCurr.y + t * t * endY;
        rawPoints.push({ x, y });
      }
    }

    const total = rawPoints.length;
    this.sampledSpline = rawPoints.map((pt, idx) => {
      const nextPt = rawPoints[(idx + 1) % total];
      const prevPt = rawPoints[(idx - 1 + total) % total];
      const dx = nextPt.x - prevPt.x;
      const dy = nextPt.y - prevPt.y;
      const len = Math.hypot(dx, dy) || 1;
      const tangentX = dx / len;
      const tangentY = dy / len;
      // Normal points to the right side of the track direction
      const normalX = -tangentY;
      const normalY = tangentX;
      return {
        x: pt.x,
        y: pt.y,
        tangentX,
        tangentY,
        normalX,
        normalY,
      };
    });
  }

  public draw(ctx: CanvasRenderingContext2D, isNeonRush = false, animTime = 0) {
    ctx.save();

    // 1. Infield / Terrain background
    ctx.fillStyle = isNeonRush ? '#070a0f' : '#0a0d13';
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle cyber ground grid
    ctx.strokeStyle = isNeonRush ? 'rgba(0, 240, 255, 0.04)' : 'rgba(255, 42, 58, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // 2. Outer Kerbs / Runoff strips (Championship Red and White)
    const kerbColor1 = isNeonRush ? '#ff007f' : '#FF2A3A';
    const kerbColor2 = isNeonRush ? '#00f0ff' : '#f3f4f6';
    this.drawTrackPath(ctx, this.roadWidth + 24, kerbColor1);
    this.drawTrackPath(ctx, this.roadWidth + 14, kerbColor2);

    // 3. Main Asphalt Roadway
    this.drawTrackPath(ctx, this.roadWidth, isNeonRush ? '#0d131f' : '#141a26');

    // 4. Contrasting Track Boundaries (High-contrast neon barriers)
    this.drawBoundaries(ctx, isNeonRush, animTime);

    // 5. Centerline (dashed white / subtle red)
    ctx.setLineDash([26, 30]);
    ctx.strokeStyle = isNeonRush ? 'rgba(255, 0, 128, 0.45)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    this.drawCenterLine(ctx);
    ctx.setLineDash([]);

    // 6. Start/Finish Line
    this.drawFinishLine(ctx, isNeonRush);

    // 7. Corner Chevron Guides on sharp turns
    this.drawCornerChevrons(ctx, isNeonRush);

    ctx.restore();
  }

  private drawTrackPath(ctx: CanvasRenderingContext2D, lineWidth: number, strokeStyle: string) {
    if (this.waypoints.length < 3) return;

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeStyle;

    this.traceCurve(ctx);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawCenterLine(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    this.traceCurve(ctx);
    ctx.closePath();
    ctx.stroke();
  }

  private traceCurve(ctx: CanvasRenderingContext2D) {
    const pts = this.waypoints;
    const len = pts.length;
    if (len < 3) return;

    ctx.moveTo((pts[0].x + pts[len - 1].x) / 2, (pts[0].y + pts[len - 1].y) / 2);

    for (let i = 0; i < len; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % len];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }
  }

  /**
   * Draws the high-contrast inner and outer barrier rails with glowing neon illumination
   */
  private drawBoundaries(ctx: CanvasRenderingContext2D, isNeonRush: boolean, animTime: number) {
    const halfW = this.roadWidth / 2 + 10;
    const spline = this.sampledSpline;
    if (spline.length < 3) return;

    // Draw outer boundary rail
    ctx.save();
    const pulse = Math.sin(animTime / 300) * 0.2 + 0.8;
    const barrierColor = isNeonRush
      ? `rgba(255, 0, 128, ${pulse})`
      : `rgba(255, 42, 58, ${pulse * 0.3 + 0.7})`;
    const glowColor = isNeonRush ? '#ff007f' : '#FF2A3A';

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isNeonRush ? 16 : 12;
    ctx.strokeStyle = barrierColor;
    ctx.lineWidth = 4;

    // Outer edge (+halfW along normal)
    ctx.beginPath();
    for (let i = 0; i < spline.length; i++) {
      const p = spline[i];
      const ox = p.x + p.normalX * halfW;
      const oy = p.y + p.normalY * halfW;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.closePath();
    ctx.stroke();

    // Inner edge (-halfW along normal)
    ctx.beginPath();
    for (let i = 0; i < spline.length; i++) {
      const p = spline[i];
      const ix = p.x - p.normalX * halfW;
      const iy = p.y - p.normalY * halfW;
      if (i === 0) ctx.moveTo(ix, iy);
      else ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.stroke();

    // Barrier reflector studs at regular intervals
    ctx.shadowBlur = 0;
    ctx.fillStyle = isNeonRush ? '#00f0ff' : '#FF2A3A';
    const step = 8;
    for (let i = 0; i < spline.length; i += step) {
      const p = spline[i];
      // Outer stud
      ctx.fillRect(p.x + p.normalX * halfW - 2, p.y + p.normalY * halfW - 2, 4, 4);
      // Inner stud
      ctx.fillRect(p.x - p.normalX * halfW - 2, p.y - p.normalY * halfW - 2, 4, 4);
    }

    ctx.restore();
  }

  private drawFinishLine(ctx: CanvasRenderingContext2D, isNeonRush: boolean) {
    const startPt = this.waypoints[0];
    const nextPt = this.waypoints[1];
    const angle = Math.atan2(nextPt.y - startPt.y, nextPt.x - startPt.x);
    const perp = angle + Math.PI / 2;

    const halfW = this.roadWidth / 2;
    const x1 = startPt.x + Math.cos(perp) * halfW;
    const y1 = startPt.y + Math.sin(perp) * halfW;
    const x2 = startPt.x - Math.cos(perp) * halfW;
    const y2 = startPt.y - Math.sin(perp) * halfW;

    ctx.save();

    // Checkered banner
    const checks = 12;
    const dx = (x2 - x1) / checks;
    const dy = (y2 - y1) / checks;

    ctx.lineWidth = 16;
    for (let i = 0; i < checks; i++) {
      ctx.beginPath();
      ctx.moveTo(x1 + dx * i, y1 + dy * i);
      ctx.lineTo(x1 + dx * (i + 1), y1 + dy * (i + 1));
      ctx.strokeStyle = i % 2 === 0 ? '#ffffff' : '#0b0d0c';
      ctx.stroke();
    }

    // Glowing gate posts
    const gateGlow = isNeonRush ? '#ff007f' : '#FF2A3A';
    ctx.shadowColor = gateGlow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = gateGlow;
    ctx.beginPath();
    ctx.arc(x1, y1, 10, 0, Math.PI * 2);
    ctx.arc(x2, y2, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawCornerChevrons(ctx: CanvasRenderingContext2D, isNeonRush: boolean) {
    // Placement at apex corners: Turn 1 (idx 4), Chicane (idx 8), Hairpin (idx 10)
    const corners = [this.waypoints[4], this.waypoints[8], this.waypoints[10]];
    const color = isNeonRush ? '#00f0ff' : '#FF2A3A';

    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    corners.forEach((wp) => {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * Fast, pixel-accurate track collision query.
   * Returns distance, normal, tangent, road/grass status, and barrier penetration.
   */
  public getCollisionInfo(px: number, py: number): TrackCollisionInfo {
    let minDistSq = Infinity;
    let closestIndex = 0;
    let closestX = px;
    let closestY = py;

    const spline = this.sampledSpline;
    const len = spline.length;

    for (let i = 0; i < len; i++) {
      const p1 = spline[i];
      const p2 = spline[(i + 1) % len];

      const segDx = p2.x - p1.x;
      const segDy = p2.y - p1.y;
      const l2 = segDx * segDx + segDy * segDy;

      let t = 0;
      if (l2 > 0) {
        t = ((px - p1.x) * segDx + (py - p1.y) * segDy) / l2;
        t = Math.max(0, Math.min(1, t));
      }

      const projX = p1.x + t * segDx;
      const projY = p1.y + t * segDy;
      const dSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);

      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestIndex = i;
        closestX = projX;
        closestY = projY;
      }
    }

    const dist = Math.sqrt(minDistSq);
    const bestPoint = spline[closestIndex];

    // Compute outward vector from track centerline to car
    let toCarX = px - closestX;
    let toCarY = py - closestY;
    const toCarLen = Math.hypot(toCarX, toCarY);

    let normalX = bestPoint.normalX;
    let normalY = bestPoint.normalY;

    if (toCarLen > 0.001) {
      // Directed outward normal
      normalX = toCarX / toCarLen;
      normalY = toCarY / toCarLen;
    }

    const dot = toCarX * bestPoint.normalX + toCarY * bestPoint.normalY;
    const signedDist = dot >= 0 ? dist : -dist;

    const halfRoad = this.roadWidth / 2;
    const isOnRoad = dist <= halfRoad;
    const isOnGrass = dist > halfRoad;
    const isCollidingBarrier = dist >= this.barrierLimit;
    const penetration = Math.max(0, dist - this.barrierLimit);
    const progress = closestIndex / len;

    return {
      dist,
      signedDist,
      closestX,
      closestY,
      normalX,
      normalY,
      tangentX: bestPoint.tangentX,
      tangentY: bestPoint.tangentY,
      isOnRoad,
      isOnGrass,
      isCollidingBarrier,
      penetration,
      progress,
    };
  }

  /** Backward-compatible helper for legacy callers */
  public getDistanceToTrack(px: number, py: number): number {
    return this.getCollisionInfo(px, py).dist;
  }
}
