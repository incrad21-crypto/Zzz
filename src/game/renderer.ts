import { createSeededRng } from './rng';
import {
  getHorizontalBounds,
  getInteractableEffectiveX,
  getLightingStage,
  getRobotState,
} from './rules';
import { GameState, Interactable, PartId, PropDef, WorldZone } from './types';
import {
  FOREST_GROUND_Y,
  FOREST_MAX_X,
  getFloorName,
  getHouseFloorY,
  HOUSE_FLOOR_Y,
  HOUSE_PROPS,
  HOUSE_ROOMS,
  WORLD_INTERACTABLES,
} from './world';

export const VIRTUAL_W = 480;
export const VIRTUAL_H = 270;

function safeNum(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

function safeLinearGrad(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): CanvasGradient {
  const sx0 = safeNum(x0, 0);
  const sy0 = safeNum(y0, 0);
  const sx1 = safeNum(x1, sx0 + 1);
  const sy1 = safeNum(y1, sy0);
  return ctx.createLinearGradient(sx0, sy0, sx1, sy1);
}

function safeRadialGrad(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number
): CanvasGradient {
  const sx0 = safeNum(x0, 0);
  const sy0 = safeNum(y0, 0);
  const sr0 = Math.max(0, safeNum(r0, 0));
  const sx1 = safeNum(x1, sx0);
  const sy1 = safeNum(y1, sy0);
  const sr1 = Math.max(sr0 + 1, safeNum(r1, sr0 + 1));
  return ctx.createRadialGradient(sx0, sy0, sr0, sx1, sy1, sr1);
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export class PixelWorldRenderer {
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private scanlineCanvas: HTMLCanvasElement;
  private houseStaticCanvas: HTMLCanvasElement;
  private rainPool: RainDrop[] = [];
  private dustPool: DustMote[] = [];
  private camX = 0;
  private camY = 0;
  private camInitialized = false;
  private lastZone: WorldZone | null = null;

  constructor() {
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = VIRTUAL_W;
    this.lightCanvas.height = VIRTUAL_H;
    const lctx = this.lightCanvas.getContext('2d');
    if (!lctx) throw new Error('2D context unavailable');
    this.lightCtx = lctx;
    this.lightCtx.imageSmoothingEnabled = false;

    this.scanlineCanvas = document.createElement('canvas');
    this.scanlineCanvas.width = VIRTUAL_W;
    this.scanlineCanvas.height = VIRTUAL_H;
    const sctx = this.scanlineCanvas.getContext('2d');
    if (sctx) {
      sctx.imageSmoothingEnabled = false;
      sctx.fillStyle = 'rgba(0, 0, 0, 0.055)';
      for (let y = 0; y < VIRTUAL_H; y += 2) {
        sctx.fillRect(0, y, VIRTUAL_W, 1);
      }
      sctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      sctx.fillRect(0, 0, VIRTUAL_W, 5);
      sctx.fillRect(0, VIRTUAL_H - 5, VIRTUAL_W, 5);
      sctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      for (let x = 0; x < VIRTUAL_W; x += 2) {
        sctx.fillRect(x, 5, 1, 2);
        sctx.fillRect(x + 1, VIRTUAL_H - 7, 1, 2);
      }
    }

    this.houseStaticCanvas = document.createElement('canvas');
    this.houseStaticCanvas.width = 1152;
    this.houseStaticCanvas.height = 620;
    const hctx = this.houseStaticCanvas.getContext('2d');
    if (hctx) {
      hctx.imageSmoothingEnabled = false;
      hctx.save();
      hctx.translate(0, 20);
      this.buildStaticHouseLayer(hctx);
      hctx.restore();
    }

    const rng = createSeededRng(40917);
    for (let i = 0; i < 130; i++) {
      this.rainPool.push({
        x: rng() * VIRTUAL_W,
        y: rng() * VIRTUAL_H,
        len: 7 + Math.floor(rng() * 8),
        speed: 235 + rng() * 145,
      });
    }

    for (let i = 0; i < 36; i++) {
      this.dustPool.push({
        x: rng() * VIRTUAL_W,
        y: rng() * VIRTUAL_H,
        vx: -4 + rng() * 8,
        vy: -3 + rng() * 6,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  private buildStaticHouseLayer(ctx: CanvasRenderingContext2D): void {
    // Pitched exterior shingle roof shell with attic cupola & brick chimney
    ctx.fillStyle = '#181f29';
    ctx.beginPath();
    ctx.moveTo(10, 120);
    ctx.lineTo(148, 12);
    ctx.lineTo(1002, 12);
    ctx.lineTo(1138, 120);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#202936';
    for (let ry = 22; ry < 112; ry += 10) {
      const inset = Math.round(((120 - ry) / 108) * 136);
      ctx.fillRect(14 + inset, ry, 1120 - inset * 2, 1);
    }
    ctx.fillStyle = '#232c38';
    ctx.fillRect(670, -4, 150, 18);
    ctx.fillStyle = '#141a22';
    ctx.fillRect(676, 1, 138, 8);
    ctx.fillStyle = '#2d323b';
    ctx.fillRect(326, -12, 26, 40);
    ctx.fillStyle = '#1b1f26';
    for (let by = -8; by < 22; by += 6) {
      ctx.fillRect(328, by, 22, 1);
    }

    // Outer house frame & cellar stone foundation
    ctx.fillStyle = '#10151c';
    ctx.fillRect(14, 112, 1120, 464);
    ctx.fillStyle = '#212730';
    ctx.fillRect(10, 568, 1128, 18);
    ctx.fillStyle = '#151a21';
    for (let sx = 14; sx < 1130; sx += 16) {
      ctx.fillRect(sx, 570, 14, 6);
      ctx.fillRect(sx + 6, 578, 12, 5);
    }

    for (const room of HOUSE_ROOMS) {
      const floorY = getHouseFloorY(room.floor);
      const topY = floorY - 96;

      ctx.fillStyle = room.wallColor;
      ctx.fillRect(room.x, topY, room.width, 96);

      if (room.floor === 4) {
        ctx.fillStyle = '#262e3a';
        for (let rx = room.x + 20; rx < room.x + room.width - 10; rx += 46) {
          ctx.fillRect(rx, topY + 4, 4, 92);
          ctx.fillRect(rx + 4, topY + 12, 4, 4);
          ctx.fillRect(rx - 4, topY + 12, 4, 4);
        }
        ctx.fillStyle = '#1f2630';
        ctx.fillRect(room.x, topY + 12, room.width, 4);
        if (room.id === 'attic_west') {
          ctx.fillStyle = '#0e131b';
          for (let row = 0; row < 56; row += 4) {
            ctx.fillRect(room.x, topY + row, Math.max(0, 66 - row), 4);
          }
        } else if (room.id === 'attic_east') {
          ctx.fillStyle = '#0e131b';
          for (let row = 0; row < 56; row += 4) {
            const cutW = Math.max(0, 66 - row);
            ctx.fillRect(room.x + room.width - cutW, topY + row, cutW, 4);
          }
        }
      } else if (room.floorMaterial === 'tile') {
        for (let tx = room.x + 6; tx < room.x + room.width - 8; tx += 8) {
          for (let ty = floorY - 48; ty < floorY - 6; ty += 8) {
            ctx.fillStyle = ((tx + ty) / 8) % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.09)';
            ctx.fillRect(tx, ty, 7, 7);
          }
        }
        if (room.id === 'f1_kitchen') {
          ctx.fillStyle = '#333b35';
          ctx.fillRect(room.x + 12, topY + 14, 46, 20);
          ctx.fillStyle = '#212723';
          ctx.fillRect(room.x + 34, topY + 16, 2, 16);
          ctx.fillStyle = '#6f7c74';
          ctx.fillRect(room.x + 31, topY + 24, 2, 3);
          ctx.fillRect(room.x + 37, topY + 24, 2, 3);
          ctx.fillStyle = '#47392c';
          ctx.fillRect(room.x + 124, topY + 26, 28, 3);
          ctx.fillStyle = '#7b8a94';
          ctx.fillRect(room.x + 127, topY + 20, 4, 6);
          ctx.fillStyle = '#995c48';
          ctx.fillRect(room.x + 134, topY + 22, 3, 4);
          ctx.fillStyle = '#6a826e';
          ctx.fillRect(room.x + 141, topY + 21, 4, 5);
        }
      } else if (room.floorMaterial === 'concrete') {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let by = topY + 14; by < floorY - 8; by += 14) {
          ctx.fillRect(room.x + 4, by, room.width - 8, 1);
          const stagger = by % 28 === 0 ? 10 : 0;
          for (let bx = room.x + 12 + stagger; bx < room.x + room.width - 10; bx += 22) {
            ctx.fillRect(bx, by, 1, 14);
          }
        }
        if (room.floor === 0) {
          ctx.fillStyle = '#2f3840';
          ctx.fillRect(room.x + 2, topY + 8, room.width - 4, 3);
          ctx.fillStyle = '#47362b';
          ctx.fillRect(room.x + 2, topY + 12, room.width - 4, 2);
          ctx.fillStyle = '#5c6975';
          for (let px = room.x + 16; px < room.x + room.width - 12; px += 34) {
            ctx.fillRect(px, topY + 7, 2, 5);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        for (let sx = room.x + 10; sx < room.x + room.width - 8; sx += 12) {
          ctx.fillRect(sx, topY + 6, 2, 68);
        }
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(room.x + 3, topY + 5, room.width - 6, 6);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.fillRect(room.x + 3, topY + 6, 4, 68);
      ctx.fillRect(room.x + room.width - 7, topY + 6, 4, 68);

      ctx.fillStyle = room.trimColor;
      ctx.fillRect(room.x, floorY - 22, room.width, 22);
      ctx.fillRect(room.x, topY, room.width, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(room.x, floorY - 22, room.width, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(room.x, floorY - 2, room.width, 2);
      ctx.fillRect(room.x, topY + 5, room.width, 1);

      ctx.fillStyle =
        room.floorMaterial === 'carpet'
          ? '#4a2926'
          : room.floorMaterial === 'tile'
          ? '#2e393d'
          : room.floorMaterial === 'concrete'
          ? '#252a30'
          : '#423326';
      ctx.fillRect(room.x, floorY, room.width, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(room.x, floorY, room.width, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let fx = room.x + 12; fx < room.x + room.width - 8; fx += 18) {
        ctx.fillRect(fx, floorY + 1, 1, 6);
        ctx.fillRect(fx + 5, floorY + 3, 7, 1);
      }
      ctx.fillStyle = '#0e1217';
      ctx.fillRect(room.x, floorY + 8, room.width, 8);

      if (room.id === 'f1_living' || room.id === 'f2_bedroom' || room.id === 'f2_cabinet') {
        const rugW = Math.min(110, room.width - 54);
        const rugX = room.x + Math.round((room.width - rugW) / 2);
        ctx.fillStyle = '#5c2c2b';
        ctx.fillRect(rugX, floorY, rugW, 3);
        ctx.fillStyle = '#8a5d42';
        ctx.fillRect(rugX + 4, floorY + 1, rugW - 8, 1);
      }

      ctx.fillStyle = '#0c1016';
      ctx.fillRect(room.x, topY, 3, 96);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      const crackX = room.x + 24 + ((room.x * 7) % Math.max(24, room.width - 48));
      ctx.fillRect(crackX, topY + 12, 1, 9);
      ctx.fillRect(crackX + 1, topY + 20, 1, 7);
      ctx.fillRect(crackX, topY + 26, 1, 5);
      if (room.floor <= 1) {
        ctx.fillStyle = 'rgba(10, 14, 18, 0.24)';
        ctx.fillRect(room.x + 4, floorY - 30, 14, 8);
        ctx.fillRect(room.x + room.width - 18, floorY - 28, 12, 6);
      }

      if (room.floor === 4 || room.floor === 0) {
        ctx.fillStyle = 'rgba(180, 195, 210, 0.14)';
        ctx.fillRect(room.x + 3, topY + 5, 10, 1);
        ctx.fillRect(room.x + 3, topY + 6, 7, 1);
        ctx.fillRect(room.x + 3, topY + 7, 4, 1);
        ctx.fillRect(room.x + room.width - 11, topY + 5, 9, 1);
        ctx.fillRect(room.x + room.width - 8, topY + 6, 6, 1);
      }
    }
  }

  public resetCamera(): void {
    this.camInitialized = false;
    this.lastZone = null;
  }

  private updateParticles(rawDt: number, rainPaused: boolean): void {
    const dt = Math.min(0.05, Math.max(0, safeNum(rawDt, 0)));
    if (!rainPaused) {
      for (const r of this.rainPool) {
        r.x -= r.speed * 0.24 * dt;
        r.y += r.speed * dt;
        if (r.y > VIRTUAL_H) {
          r.y = -10;
          r.x = Math.random() * (VIRTUAL_W + 70);
        }
        if (r.x < -12) {
          r.x += VIRTUAL_W + 50;
        }
      }
    }
    for (const d of this.dustPool) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < 0) d.x += VIRTUAL_W;
      if (d.x > VIRTUAL_W) d.x -= VIRTUAL_W;
      if (d.y < 0) d.y += VIRTUAL_H;
      if (d.y > VIRTUAL_H) d.y -= VIRTUAL_H;
    }
  }

  private drawRain(ctx: CanvasRenderingContext2D, alpha = 0.4, groundSplashY?: number): void {
    ctx.save();
    try {
      // Layer 1: faint distant misty drizzle
      ctx.strokeStyle = `rgba(145, 178, 210, ${alpha * 0.45})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < this.rainPool.length; i += 2) {
        const r = this.rainPool[i];
        if (!r) continue;
        const rx = Math.round((r.x * 1.13 + 37) % VIRTUAL_W);
        const ry = Math.round((r.y * 0.91 + 19) % VIRTUAL_H);
        const len = Math.max(4, Math.round(r.len * 0.65));
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - Math.round(len * 0.2), ry + len);
      }
      ctx.stroke();

      // Layer 2: foreground crisp rain streaks
      ctx.strokeStyle = `rgba(176, 206, 234, ${alpha})`;
      ctx.beginPath();
      for (const r of this.rainPool) {
        const rx = Math.round(r.x);
        const ry = Math.round(r.y);
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - Math.round(r.len * 0.24), ry + r.len);
      }
      ctx.stroke();

      if (groundSplashY !== undefined) {
        ctx.fillStyle = `rgba(186, 216, 240, ${alpha * 0.72})`;
        for (let i = 0; i < 22; i++) {
          const r = this.rainPool[i];
          if (!r) continue;
          const sx = Math.round((r.x * 1.37) % VIRTUAL_W);
          if (r.y > groundSplashY - 10 && r.y < groundSplashY + 8) {
            ctx.fillRect(sx - 1, groundSplashY, 3, 1);
            ctx.fillRect(sx, groundSplashY - 1, 1, 1);
          }
        }
      }
    } finally {
      ctx.restore();
    }
  }

  private getLightningIntensity(timeSec: number, rainPaused: boolean): number {
    if (rainPaused) return 0;
    const cycle = timeSec % 11.4;
    if (cycle > 10.15 && cycle < 10.27) return 0.72;
    if (cycle > 10.34 && cycle < 10.48) return 0.45;
    return 0;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeSec: number,
    dt: number,
    nearest: Interactable | null,
    rainPausedActive = false,
    options?: { screenShake?: boolean; reduceFlashes?: boolean; visualNoise?: boolean }
  ): void {
    ctx.imageSmoothingEnabled = false;
    this.updateParticles(dt, false);

    if (this.lastZone !== state.player.zone) {
      this.lastZone = state.player.zone;
      this.camInitialized = false;
    }

    if (state.screen === 'title') {
      this.renderTitleScene(ctx, timeSec);
      return;
    }

    const allowShake = options?.screenShake !== false;
    const reduceFlashes = Boolean(options?.reduceFlashes);
    const visualNoise = options?.visualNoise !== false;

    // Camera micro-shake on startled reaction, thunder strike, or finale climax
    const thunderFlash =
      state.player.zone !== 'house' && !reduceFlashes
        ? this.getLightningIntensity(timeSec, rainPausedActive)
        : 0;
    let shakeX = 0;
    let shakeY = 0;
    if (allowShake) {
      if (
        state.finale.active &&
        (state.finale.phase === 'rising' ||
          state.finale.phase === 'approach' ||
          state.finale.phase === 'fade')
      ) {
        const mag = state.finale.phase === 'approach' ? 2.2 : 1.1;
        shakeX = Math.round(Math.sin(timeSec * 47) * mag);
        shakeY = Math.round(Math.cos(timeSec * 53) * mag);
      } else if (state.player.startledTimer > 0) {
        const mag = state.player.startledTimer * 4;
        shakeX = Math.round(Math.sin(timeSec * 62) * mag);
        shakeY = Math.round(Math.cos(timeSec * 49) * mag * 0.6);
      } else if (thunderFlash > 0.6) {
        shakeX = Math.round(Math.sin(timeSec * 43));
      }
    }

    ctx.save();
    try {
      if (shakeX !== 0 || shakeY !== 0) {
        ctx.translate(shakeX, shakeY);
      }

      if (state.player.zone === 'car_prologue') {
        this.renderCarPrologue(ctx, state, timeSec);
      } else if (state.player.zone === 'forest') {
        this.renderForest(ctx, state, timeSec, nearest, rainPausedActive);
      } else {
        this.renderHouse(ctx, state, timeSec, nearest);
      }
    } finally {
      ctx.restore();
    }
    this.drawPostEffects(ctx, state, timeSec, rainPausedActive, reduceFlashes, visualNoise);
  }

  private drawPixelMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Circular stepped pixel halo rings (no overlapping rectangle corners)
    const drawDisc = (r: number, color: string) => {
      ctx.fillStyle = color;
      for (let dy = -r; dy <= r; dy++) {
        const hw = Math.round(Math.sqrt(r * r - dy * dy));
        if (hw > 0) ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
      }
    };
    drawDisc(16, 'rgba(130, 168, 208, 0.06)');
    drawDisc(11, 'rgba(165, 200, 232, 0.11)');

    // Stepped pixel circle disc (radius 7px)
    ctx.fillStyle = '#9cb8d4';
    ctx.fillRect(cx - 3, cy - 7, 6, 14);
    ctx.fillRect(cx - 5, cy - 6, 10, 12);
    ctx.fillRect(cx - 6, cy - 5, 12, 10);
    ctx.fillRect(cx - 7, cy - 3, 14, 6);

    // Bright upper-left rim + subtle pixel craters
    ctx.fillStyle = '#c2daf0';
    ctx.fillRect(cx - 4, cy - 6, 5, 2);
    ctx.fillRect(cx - 6, cy - 4, 2, 5);
    ctx.fillStyle = '#7591ad';
    ctx.fillRect(cx + 1, cy - 2, 3, 2);
    ctx.fillRect(cx - 2, cy + 2, 2, 2);
    ctx.fillRect(cx + 2, cy + 3, 2, 1);
  }

  private drawPixelCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const rx = Math.round(x);
    ctx.fillStyle = '#111a26';
    ctx.fillRect(rx + 6, y, w - 12, 4);
    ctx.fillRect(rx + 2, y + 3, w - 4, 5);
    ctx.fillRect(rx, y + 6, w, 4);
    ctx.fillStyle = '#192638';
    ctx.fillRect(rx + 8, y + 1, Math.floor(w * 0.48), 2);
  }

  private renderTitleScene(ctx: CanvasRenderingContext2D, timeSec: number): void {
    // Deep cold indigo night sky with subtle horizon dither bands
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, VIRTUAL_W, 84);
    ctx.fillStyle = '#09101b';
    ctx.fillRect(0, 84, VIRTUAL_W, 66);
    ctx.fillStyle = '#0d1624';
    ctx.fillRect(0, 150, VIRTUAL_W, 62);
    ctx.fillStyle = 'rgba(20, 32, 48, 0.45)';
    for (let dx = 0; dx < VIRTUAL_W; dx += 4) {
      ctx.fillRect(dx, 149, 2, 1);
      ctx.fillRect(dx + 2, 83, 2, 1);
    }

    // Crisp sky stars peeking between dark cloud bands
    const flash = this.getLightningIntensity(timeSec, false);
    if (flash < 0.35) {
      for (let s = 0; s < 26; s++) {
        const sx = (s * 67 + 19) % VIRTUAL_W;
        const sy = 6 + ((s * 29 + 11) % 68);
        const tw = 0.16 + Math.max(0, Math.sin(timeSec * 1.9 + s * 1.7)) * 0.36;
        ctx.fillStyle = `rgba(182, 212, 242, ${tw})`;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }

    // Crisp pixel moon & drifting stepped clouds
    this.drawPixelMoon(ctx, 368, 42);
    for (let i = 0; i < 6; i++) {
      const cx =
        (((i * 112 - timeSec * 4) % (VIRTUAL_W + 130)) + (VIRTUAL_W + 130)) % (VIRTUAL_W + 130) - 65;
      this.drawPixelCloud(ctx, cx, 22 + (i % 2) * 18, 58 + (i % 3) * 14);
    }

    // Far parallax stepped pines
    const pan = timeSec * 10;
    for (let i = -1; i < 22; i++) {
      const tx = Math.round(
        (((i * 32 - pan * 0.35) % (VIRTUAL_W + 64)) + (VIRTUAL_W + 64)) % (VIRTUAL_W + 64) - 32
      );
      this.drawPine(ctx, tx, 212, 68 + (i % 3) * 14, '#0a111a', '#132030');
    }

    // Distant old house silhouette on right third
    const hx = 318;
    const hy = 114;
    ctx.fillStyle = '#0f1620';
    ctx.fillRect(hx, hy + 30, 124, 68);
    // Horizontal clapboard siding lines & corner trim
    ctx.fillStyle = '#15202e';
    for (let sy = hy + 36; sy < hy + 96; sy += 5) {
      ctx.fillRect(hx + 2, sy, 120, 1);
    }
    ctx.fillStyle = '#1a2534';
    ctx.fillRect(hx, hy + 30, 3, 68);
    ctx.fillRect(hx + 121, hy + 30, 3, 68);

    // Pitched pixel roof & eaves + brick chimney
    ctx.fillStyle = '#0b1018';
    for (let row = 0; row < 32; row += 2) {
      const span = Math.round((row / 32) * 72);
      ctx.fillRect(hx + 62 - span, hy + row, span * 2, 2);
    }
    ctx.fillStyle = '#1a2330';
    ctx.fillRect(hx + 92, hy + 2, 14, 24);
    ctx.fillStyle = '#253142';
    ctx.fillRect(hx + 90, hy + 2, 18, 3);
    // Rising chimney smoke puffs drifting gently across the night sky
    for (let p = 0; p < 5; p++) {
      const age = (timeSec * 0.42 + p * 0.2) % 1;
      const sx = Math.round(hx + 96 - age * 14 + Math.sin(timeSec * 1.8 + p) * 2);
      const sy = Math.round(hy - age * 28);
      const sw = 4 + Math.round(age * 6);
      ctx.fillStyle = `rgba(145, 165, 192, ${(1 - age) * 0.22})`;
      ctx.fillRect(sx, sy, sw, 3);
    }

    // Eerie flickering blue laboratory window + dim warm porch light
    const flicker = Math.sin(timeSec * 7.3) > 0.88 ? 0.35 : 0.92;
    ctx.fillStyle = `rgba(98, 178, 232, ${flicker})`;
    ctx.fillRect(hx + 78, hy + 48, 14, 18);
    ctx.fillStyle = '#0c121a';
    ctx.fillRect(hx + 84, hy + 48, 2, 18);
    ctx.fillRect(hx + 78, hy + 56, 14, 2);

    // Dim weathered oak front door, stone porch step & small warm sconce lantern
    ctx.fillStyle = '#2d2219';
    ctx.fillRect(hx + 22, hy + 68, 16, 26);
    ctx.fillStyle = '#3f3023';
    ctx.fillRect(hx + 24, hy + 70, 12, 24);
    ctx.fillStyle = '#211912';
    ctx.fillRect(hx + 26, hy + 73, 8, 7);
    ctx.fillRect(hx + 26, hy + 83, 8, 9);
    ctx.fillStyle = '#1b2430';
    ctx.fillRect(hx + 18, hy + 94, 24, 4);
    // Tiny flickering porch lantern beside door
    const lanternPulse = 0.78 + Math.sin(timeSec * 6.5) * 0.12;
    ctx.fillStyle = '#2a3340';
    ctx.fillRect(hx + 40, hy + 70, 3, 2);
    ctx.fillStyle = `rgba(235, 178, 96, ${lanternPulse})`;
    ctx.fillRect(hx + 41, hy + 72, 2, 3);
    ctx.fillStyle = `rgba(235, 178, 96, ${0.15 * lanternPulse})`;
    ctx.fillRect(hx + 35, hy + 68, 14, 14);
    ctx.fillStyle = `rgba(235, 178, 96, ${0.06 * lanternPulse})`;
    ctx.fillRect(hx + 28, hy + 64, 28, 28);
    ctx.fillStyle = `rgba(235, 178, 96, ${0.18 * lanternPulse})`;
    ctx.fillRect(hx + 22, hy + 94, 14, 1);

    // Mid stepped pines
    for (let i = -1; i < 15; i++) {
      const tx = Math.round(
        (((i * 48 - pan * 0.7) % (VIRTUAL_W + 80)) + (VIRTUAL_W + 80)) % (VIRTUAL_W + 80) - 40
      );
      if (tx > 290 && tx < 455) continue;
      this.drawPine(ctx, tx, 214, 92 + (i % 2) * 18, '#060b11', '#0e1824', Math.sin(timeSec * 1.3 + i) * 0.8);
    }

    // Distant lightning silhouette flash + jagged pixel bolt
    if (flash > 0) {
      ctx.fillStyle = `rgba(170, 205, 245, ${flash * 0.24})`;
      ctx.fillRect(0, 0, VIRTUAL_W, 210);
      if (flash > 0.55) {
        ctx.fillStyle = 'rgba(220, 240, 255, 0.85)';
        ctx.fillRect(142, 0, 2, 22);
        ctx.fillRect(144, 22, 2, 18);
        ctx.fillRect(141, 40, 2, 16);
        ctx.fillRect(143, 56, 1, 14);
        ctx.fillRect(145, 34, 6, 1);
      }
    }

    // Wet forest road with puddles, specular hazard reflections & low fog ribbons
    ctx.fillStyle = '#0b0f15';
    ctx.fillRect(0, 210, VIRTUAL_W, 60);
    ctx.fillStyle = '#18212e';
    ctx.fillRect(0, 210, VIRTUAL_W, 3);
    ctx.fillStyle = '#222e3d';
    for (let rx = 8; rx < VIRTUAL_W; rx += 22) {
      ctx.fillRect(rx, 219 + (rx % 3), 8, 1);
      ctx.fillRect(rx + 10, 242 + (rx % 2), 6, 1);
    }
    ctx.fillStyle = 'rgba(130, 160, 195, 0.08)';
    for (let f = 0; f < 4; f++) {
      const fx = Math.round(((f * 130 + timeSec * 7) % (VIRTUAL_W + 90)) - 45);
      ctx.fillRect(fx, 198 + (f % 2) * 4, 72, 6);
    }
    ctx.fillStyle = flash > 0 ? '#324861' : '#1b2838';
    ctx.fillRect(60, 224, 52, 3);
    ctx.fillRect(210, 234, 68, 3);
    ctx.fillRect(365, 222, 42, 3);
    // Blue window wet reflection on puddle
    ctx.fillStyle = `rgba(98, 178, 232, ${flicker * 0.22})`;
    ctx.fillRect(390, 223, 10, 1);

    // Distant stalled car on the roadside with blinking amber hazard lights + wet road reflection
    this.drawPixelCar(ctx, 198, 174, false, false, false, true, timeSec, 0);
    if (Math.sin(timeSec * 5.2) > 0.15) {
      ctx.fillStyle = '#ff9d3b';
      ctx.fillRect(197, 197, 3, 2);
      ctx.fillRect(292, 197, 3, 2);
      ctx.fillStyle = 'rgba(255, 157, 59, 0.16)';
      ctx.fillRect(189, 191, 18, 14);
      ctx.fillRect(285, 191, 18, 14);
      // Wet asphalt puddle specular shimmer
      ctx.fillStyle = 'rgba(255, 157, 59, 0.25)';
      ctx.fillRect(216, 235, 12, 1);
      ctx.fillRect(264, 235, 10, 1);
    }

    this.drawRain(ctx, 0.48, 218);
  }

  private renderCarPrologue(ctx: CanvasRenderingContext2D, state: GameState, timeSec: number): void {
    const pr = state.prologue;
    const scroll = pr.distance * 2600;

    // Layered cold night sky
    ctx.fillStyle = '#06090f';
    ctx.fillRect(0, 0, VIRTUAL_W, 120);
    ctx.fillStyle = '#090f18';
    ctx.fillRect(0, 120, VIRTUAL_W, 82);

    // Far forest ridge
    for (let i = -2; i < 24; i++) {
      const x = Math.round((((i * 34 - scroll * 0.25) % (VIRTUAL_W + 72)) + (VIRTUAL_W + 72)) % (VIRTUAL_W + 72) - 36);
      this.drawPine(ctx, x, 200, 68 + (i % 3) * 14, '#091018', '#0e1824');
    }

    // Passing road poles, signs & flickering streetlamps
    for (let i = 0; i < 12; i++) {
      const x = Math.round((((i * 125 - scroll * 0.85) % (VIRTUAL_W + 170)) + (VIRTUAL_W + 170)) % (VIRTUAL_W + 170) - 65);
      ctx.fillStyle = '#151b24';
      ctx.fillRect(x, 124, 3, 76);
      if (i % 3 === 0) {
        ctx.fillRect(x, 124, 14, 3);
        ctx.fillStyle = 'rgba(220, 195, 130, 0.45)';
        ctx.fillRect(x + 9, 127, 5, 3);
        // Lamp light cone
        ctx.fillStyle = 'rgba(215, 195, 145, 0.07)';
        ctx.beginPath();
        ctx.moveTo(x + 11, 130);
        ctx.lineTo(x - 14, 202);
        ctx.lineTo(x + 36, 202);
        ctx.closePath();
        ctx.fill();
      } else if (i % 3 === 1) {
        // Road reflector post
        ctx.fillStyle = '#38414d';
        ctx.fillRect(x + 4, 178, 3, 22);
        ctx.fillStyle = '#b54c44';
        ctx.fillRect(x + 4, 181, 3, 3);
      }
    }

    // Guardrail & wet asphalt road
    ctx.fillStyle = '#1e2530';
    ctx.fillRect(0, 194, VIRTUAL_W, 3);
    ctx.fillStyle = '#11161d';
    ctx.fillRect(0, 199, VIRTUAL_W, 71);
    ctx.fillStyle = '#2f3845';
    for (let i = 0; i < 14; i++) {
      const dx = Math.round((((i * 44 - scroll) % (VIRTUAL_W + 44)) + (VIRTUAL_W + 44)) % (VIRTUAL_W + 44) - 22);
      ctx.fillRect(dx, 226, 20, 2);
    }

    // Car body position & subtle road vibration
    const carX = 84;
    const bounce = pr.speed > 0.05 ? Math.round(Math.sin(timeSec * 24) * 0.8) : 0;
    const carY = 162 + bounce;

    // Headlight beam emitted flush from the headlight bulb (carX + 93..97, carY + 18..23)
    const beamOn = pr.phase === 'driving' || (pr.phase === 'sputtering' && pr.headlightFlicker > 0.3);
    if (beamOn) {
      const alpha = pr.phase === 'sputtering' ? 0.22 : 0.36;
      const beamStartX = carX + 96;
      const bulbTopY = carY + 18;
      const bulbBottomY = carY + 23;
      const grad = safeLinearGrad(ctx, beamStartX, bulbTopY + 2, VIRTUAL_W, carY + 28);
      grad.addColorStop(0, `rgba(245, 230, 170, ${alpha})`);
      grad.addColorStop(0.55, `rgba(235, 220, 165, ${alpha * 0.38})`);
      grad.addColorStop(1, 'rgba(235, 220, 165, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(beamStartX, bulbTopY);
      ctx.lineTo(VIRTUAL_W, carY - 8);
      ctx.lineTo(VIRTUAL_W, carY + 64);
      ctx.lineTo(beamStartX, bulbBottomY);
      ctx.closePath();
      ctx.fill();

      // Tighter inner high-intensity beam core aligned to lens center
      const coreGrad = safeLinearGrad(ctx, beamStartX, bulbTopY + 2, VIRTUAL_W - 60, carY + 26);
      coreGrad.addColorStop(0, `rgba(255, 245, 200, ${alpha * 0.72})`);
      coreGrad.addColorStop(1, 'rgba(255, 245, 200, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.moveTo(beamStartX, bulbTopY + 1);
      ctx.lineTo(VIRTUAL_W - 40, carY + 10);
      ctx.lineTo(VIRTUAL_W - 40, carY + 48);
      ctx.lineTo(beamStartX, bulbBottomY - 1);
      ctx.closePath();
      ctx.fill();
    }

    this.drawPixelCar(ctx, carX, carY, beamOn, false, true, pr.phase === 'sputtering' || pr.phase === 'stalled', timeSec, pr.distance);

    if (beamOn) {
      ctx.fillStyle = pr.phase === 'sputtering' ? 'rgba(255, 242, 184, 0.18)' : 'rgba(255, 242, 184, 0.28)';
      ctx.fillRect(carX + 96, carY + 17, 4, 7);
    }

    // Tire spray droplets behind wheels while moving
    if (pr.speed > 0.15) {
      ctx.fillStyle = 'rgba(150, 185, 215, 0.35)';
      for (let s = 0; s < 4; s++) {
        const sx = carX + 2 - ((Math.floor(timeSec * 40) + s * 7) % 18);
        const sy = 197 - (s % 2) * 2;
        ctx.fillRect(sx, sy, 2, 1);
      }
    }

    // Animated windshield wiper sweeping strictly inside the front windshield glass (x+45..x+64)
    const wiperCycle = pr.phase === 'stalled' ? 0 : Math.sin(timeSec * 5.8);
    ctx.strokeStyle = '#8da0b5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(carX + 62, carY + 13);
    ctx.lineTo(carX + 56 + Math.round(wiperCycle * 6), carY + 5);
    ctx.stroke();

    // Hazard flashers (positioned cleanly below taillight/headlight & above bumper) & warning dashboard blink
    if (pr.phase !== 'driving' && Math.sin(timeSec * 10) > 0) {
      ctx.fillStyle = '#ff4b4b';
      ctx.fillRect(carX + 58, carY + 10, 2, 2);
      ctx.fillStyle = '#ff9d3b';
      ctx.fillRect(carX - 1, carY + 23, 3, 2);
      ctx.fillRect(carX + 94, carY + 23, 3, 2);
    }

    // Foreground silhouette posts rushing past
    ctx.fillStyle = '#040609';
    for (let i = 0; i < 6; i++) {
      const fx = Math.round((((i * 110 - scroll * 1.35) % (VIRTUAL_W + 110)) + (VIRTUAL_W + 110)) % (VIRTUAL_W + 110) - 40);
      ctx.fillRect(fx, 238, 6, 32);
    }

    this.drawRain(ctx, 0.48, 224);
  }

  private renderForest(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeSec: number,
    nearest: Interactable | null,
    rainPausedActive: boolean
  ): void {
    const pxSafe = safeNum(state.player.x, 120);
    const targetCamX = Math.max(0, Math.min(FOREST_MAX_X - VIRTUAL_W, pxSafe - VIRTUAL_W * 0.42));
    if (!Number.isFinite(this.camX)) this.camX = targetCamX;
    if (!this.camInitialized || Math.abs(targetCamX - this.camX) > 220) {
      this.camX = targetCamX;
      this.camY = 0;
      this.camInitialized = true;
    } else {
      this.camX += (targetCamX - this.camX) * 0.14;
      this.camY = 0;
    }
    const cx = Math.round(safeNum(this.camX, 0));

    // Deep night sky & stepped pixel clouds + moon
    ctx.fillStyle = '#070c15';
    ctx.fillRect(0, 0, VIRTUAL_W, 118);
    ctx.fillStyle = '#0b121e';
    ctx.fillRect(0, 118, VIRTUAL_W, 100);

    const moonX = 360 - Math.round(cx * 0.05);
    this.drawPixelMoon(ctx, moonX, 36);
    for (let c = 0; c < 4; c++) {
      const cloudX = (((c * 145 - cx * 0.1 - timeSec * 3) % (VIRTUAL_W + 120)) + (VIRTUAL_W + 120)) % (VIRTUAL_W + 120) - 60;
      this.drawPixelCloud(ctx, cloudX, 20 + (c % 2) * 18, 62 + (c % 2) * 18);
    }

    // Distant parallax pines
    for (let i = 0; i < 42; i++) {
      const wx = i * 76 - Math.round(cx * 0.32);
      if (wx < -60 || wx > VIRTUAL_W + 60) continue;
      this.drawPine(ctx, wx, 212, 76 + (i % 4) * 15, '#0d1520', '#131f2e');
    }

    // Eerie distant silhouette between trees around mid-road
    if (state.player.x > 980 && state.player.x < 1720) {
      const sx = 1350 - Math.round(cx * 0.65);
      if (sx > 20 && sx < VIRTUAL_W - 20) {
        ctx.fillStyle = '#05080d';
        ctx.fillRect(sx, 152, 10, 42);
        ctx.fillRect(sx + 2, 142, 6, 9);
        ctx.fillStyle = 'rgba(115, 195, 255, 0.65)';
        ctx.fillRect(sx + 4, 145, 2, 2);
      }
    }

    ctx.save();
    try {
      ctx.translate(-cx, 0);

      // Mid trees along the road
      for (let i = 0; i < 36; i++) {
        const tx = 48 + i * 70;
        if (tx > 2180) continue;
        this.drawPine(ctx, tx, FOREST_GROUND_Y - 2, 100 + (i % 3) * 18, '#090f17', '#101a26');
      }

      // Streetlamps spaced along the road (kept cleanly outside the house fence at x=2208)
      const lampPositions = [245, 580, 960, 1420, 1820, 2198];
      for (const lx of lampPositions) {
        ctx.fillStyle = '#232b34';
        ctx.fillRect(lx, FOREST_GROUND_Y - 76, 3, 76);
        ctx.fillRect(lx - 5, FOREST_GROUND_Y - 76, 13, 3);
        ctx.fillStyle = '#798569';
        ctx.fillRect(lx - 3, FOREST_GROUND_Y - 73, 9, 4);
        ctx.fillStyle = 'rgba(200, 200, 150, 0.08)';
        ctx.beginPath();
        ctx.moveTo(lx + 1, FOREST_GROUND_Y - 69);
        ctx.lineTo(lx - 26, FOREST_GROUND_Y);
        ctx.lineTo(lx + 28, FOREST_GROUND_Y);
        ctx.closePath();
        ctx.fill();
      }

      // Ground: grassy edge with swaying grass blades + wet asphalt
      ctx.fillStyle = '#121c18';
      ctx.fillRect(0, FOREST_GROUND_Y - 4, FOREST_MAX_X + 120, 5);
      ctx.fillStyle = '#1b2c24';
      for (let gx = 12; gx < 2240; gx += 18) {
        const sway = Math.round(Math.sin(timeSec * 2.2 + gx * 0.08));
        ctx.fillRect(gx + sway, FOREST_GROUND_Y - 7, 1, 3);
        ctx.fillRect(gx + 3, FOREST_GROUND_Y - 6, 1, 2);
        if (gx % 54 === 0) {
          ctx.fillRect(gx + 8 + sway, FOREST_GROUND_Y - 8, 2, 4);
        }
      }
      ctx.fillStyle = '#181f27';
      ctx.fillRect(0, FOREST_GROUND_Y, FOREST_MAX_X + 120, 60);
      // Cobblestone / asphalt pixel detail
      ctx.fillStyle = '#242e39';
      for (let rx = 20; rx < FOREST_MAX_X; rx += 14) {
        ctx.fillRect(rx, FOREST_GROUND_Y + 3, 6, 2);
        ctx.fillRect(rx + 7, FOREST_GROUND_Y + 7, 5, 2);
      }
      // Wet puddles with subtle lamp/sky reflection
      ctx.fillStyle = '#1d2d3d';
      for (let px = 210; px < 2200; px += 220) {
        ctx.fillRect(px, FOREST_GROUND_Y + 5, 38, 3);
        ctx.fillStyle = 'rgba(180, 200, 170, 0.16)';
        ctx.fillRect(px + 6 + Math.round(Math.sin(timeSec * 3 + px) * 2), FOREST_GROUND_Y + 6, 14, 1);
        ctx.fillStyle = '#1d2d3d';
      }

      // Drifting low ground fog ribbons
      ctx.fillStyle = 'rgba(145, 170, 195, 0.06)';
      for (let f = 0; f < 10; f++) {
        const fx = 160 + f * 225 + Math.round(Math.sin(timeSec * 0.6 + f) * 14);
        ctx.fillRect(fx, FOREST_GROUND_Y - 12, 84, 5);
      }

      // 1. Broken Car (x=102)
      this.drawPixelCar(ctx, 102, FOREST_GROUND_Y - 38, false, state.player.hasFlashlight, false, !state.player.hasFlashlight, timeSec, 0);

      // 2. Wooden Road Sign (x=470)
      ctx.fillStyle = '#473a2c';
      ctx.fillRect(468, FOREST_GROUND_Y - 44, 4, 44);
      ctx.fillStyle = '#6e5e4d';
      ctx.fillRect(450, FOREST_GROUND_Y - 42, 40, 16);
      ctx.fillStyle = '#4f4335';
      ctx.fillRect(452, FOREST_GROUND_Y - 40, 36, 12);
      ctx.fillStyle = '#b54a42';
      ctx.fillRect(478, FOREST_GROUND_Y - 37, 7, 5);
      ctx.fillStyle = '#c4baaa';
      ctx.fillRect(456, FOREST_GROUND_Y - 36, 18, 2);
      ctx.fillRect(456, FOREST_GROUND_Y - 32, 12, 2);

      // 3. Abandoned Bus Stop (x=840) & Flickering Phone Booth (x=930)
      ctx.fillStyle = '#28313b';
      ctx.fillRect(808, FOREST_GROUND_Y - 56, 64, 5);
      ctx.fillRect(812, FOREST_GROUND_Y - 51, 4, 51);
      ctx.fillRect(864, FOREST_GROUND_Y - 51, 4, 51);
      ctx.fillStyle = '#182029';
      ctx.fillRect(816, FOREST_GROUND_Y - 51, 48, 38);
      // Torn notice on bus stop wall
      ctx.fillStyle = '#8b8577';
      ctx.fillRect(824, FOREST_GROUND_Y - 42, 10, 12);
      // Wooden bench
      ctx.fillStyle = '#4b3b2d';
      ctx.fillRect(822, FOREST_GROUND_Y - 16, 36, 4);
      ctx.fillRect(825, FOREST_GROUND_Y - 12, 3, 12);
      ctx.fillRect(852, FOREST_GROUND_Y - 12, 3, 12);
      // Phone booth with flickering dead bulb
      ctx.fillStyle = '#2b343e';
      ctx.fillRect(920, FOREST_GROUND_Y - 46, 18, 46);
      ctx.fillStyle = '#3f5061';
      ctx.fillRect(923, FOREST_GROUND_Y - 42, 12, 16);
      ctx.fillStyle = '#11151a';
      ctx.fillRect(927, FOREST_GROUND_Y - 36, 4, 7);
      if (Math.sin(timeSec * 14) > 0.72) {
        ctx.fillStyle = 'rgba(210, 235, 255, 0.55)';
        ctx.fillRect(927, FOREST_GROUND_Y - 41, 4, 2);
      }

      // 4. Footprints clearing (x=1245)
      ctx.fillStyle = '#2c3947';
      for (let f = 0; f < 6; f++) {
        ctx.fillRect(1224 + f * 9, FOREST_GROUND_Y + 2 + (f % 2) * 3, 4, 2);
      }

      // 5. Sparking Electrical Box (x=1590) with flying pixel sparks
      ctx.fillStyle = '#2f3842';
      ctx.fillRect(1578, FOREST_GROUND_Y - 40, 24, 40);
      ctx.fillStyle = '#4b5966';
      ctx.fillRect(1581, FOREST_GROUND_Y - 36, 18, 22);
      ctx.fillStyle = '#d4c9b2';
      ctx.fillRect(1564, FOREST_GROUND_Y - 4, 10, 4);
      if (Math.sin(timeSec * 15) > 0.58) {
        ctx.fillStyle = '#a3dcff';
        const spY = Math.floor((timeSec * 36) % 14);
        ctx.fillRect(1588, FOREST_GROUND_Y - 25, 4, 3);
        ctx.fillRect(1592 + (spY % 5), FOREST_GROUND_Y - 22 + spY, 2, 2);
        ctx.fillRect(1584 - (spY % 4), FOREST_GROUND_Y - 19 + spY, 1, 2);
      }

      // 6. Small wooden bridge (x=1940) with animated creek shimmer
      ctx.fillStyle = '#070b12';
      ctx.fillRect(1888, FOREST_GROUND_Y + 2, 104, 52);
      ctx.fillStyle = '#101d2b';
      ctx.fillRect(1892, FOREST_GROUND_Y + 24, 96, 18);
      ctx.fillStyle = '#27435e';
      const ripple = Math.floor(timeSec * 18) % 24;
      ctx.fillRect(1896 + ripple, FOREST_GROUND_Y + 28, 12, 1);
      ctx.fillRect(1940 - Math.floor(ripple * 0.5), FOREST_GROUND_Y + 34, 14, 1);
      ctx.fillStyle = '#473628';
      ctx.fillRect(1890, FOREST_GROUND_Y - 3, 100, 6);
      ctx.fillRect(1894, FOREST_GROUND_Y - 22, 4, 19);
      ctx.fillRect(1940, FOREST_GROUND_Y - 22, 4, 19);
      ctx.fillRect(1984, FOREST_GROUND_Y - 22, 4, 19);
      ctx.fillRect(1894, FOREST_GROUND_Y - 22, 94, 3);

      // 7. Old House Exterior (x=2260..2460) — stepped pixel shingles, gable window & porch steps
      ctx.fillStyle = '#1c222b';
      ctx.fillRect(2276, FOREST_GROUND_Y - 128, 176, 128);
      ctx.fillStyle = '#242b36';
      for (let sy = FOREST_GROUND_Y - 124; sy < FOREST_GROUND_Y; sy += 6) {
        ctx.fillRect(2278, sy, 172, 1);
      }
      ctx.fillStyle = '#2c3542';
      ctx.fillRect(2276, FOREST_GROUND_Y - 128, 4, 116);
      ctx.fillRect(2448, FOREST_GROUND_Y - 128, 4, 116);
      ctx.fillStyle = '#2d333b';
      ctx.fillRect(2274, FOREST_GROUND_Y - 12, 180, 12);
      ctx.fillStyle = '#1b2026';
      for (let sx = 2278; sx < 2448; sx += 14) {
        ctx.fillRect(sx, FOREST_GROUND_Y - 10, 10, 4);
      }
      for (let row = 0; row < 56; row += 2) {
        const span = Math.round((row / 56) * 102);
        ctx.fillStyle = row % 8 === 0 ? '#181e28' : '#11161d';
        ctx.fillRect(2364 - span, FOREST_GROUND_Y - 184 + row, span * 2, 2);
      }
      ctx.fillStyle = '#27303c';
      ctx.fillRect(2262, FOREST_GROUND_Y - 129, 204, 3);
      ctx.fillStyle = '#141c26';
      ctx.fillRect(2357, FOREST_GROUND_Y - 154, 14, 16);
      ctx.fillStyle = '#3d5870';
      ctx.fillRect(2359, FOREST_GROUND_Y - 152, 10, 12);
      ctx.fillStyle = '#1b222c';
      ctx.fillRect(2363, FOREST_GROUND_Y - 152, 2, 12);
      ctx.fillStyle = '#252b34';
      ctx.fillRect(2402, FOREST_GROUND_Y - 182, 18, 36);
      ctx.fillStyle = '#333b47';
      ctx.fillRect(2400, FOREST_GROUND_Y - 184, 22, 3);
      for (let s = 0; s < 5; s++) {
        const age = (timeSec * 0.45 + s * 0.2) % 1;
        const sx = Math.round(2407 - age * 14 + Math.sin(timeSec * 2 + s) * 2);
        const sy = Math.round(FOREST_GROUND_Y - 188 - age * 30);
        ctx.fillStyle = `rgba(165, 185, 208, ${(1 - age) * 0.25})`;
        ctx.fillRect(sx, sy, 4 + Math.round(age * 6), 3);
      }
      ctx.fillStyle = '#332920';
      ctx.fillRect(2344, FOREST_GROUND_Y - 56, 52, 5);
      ctx.fillRect(2346, FOREST_GROUND_Y - 51, 3, 51);
      ctx.fillRect(2391, FOREST_GROUND_Y - 51, 3, 51);
      ctx.fillStyle = '#3c3024';
      ctx.fillRect(2350, FOREST_GROUND_Y - 6, 38, 6);
      ctx.fillRect(2354, FOREST_GROUND_Y - 3, 30, 3);
      ctx.fillStyle = '#5c4a34';
      ctx.fillRect(2358, FOREST_GROUND_Y - 46, 22, 40);
      ctx.fillStyle = '#2b2219';
      ctx.fillRect(2361, FOREST_GROUND_Y - 42, 7, 14);
      ctx.fillRect(2370, FOREST_GROUND_Y - 42, 7, 14);
      const lanternFlick = Math.sin(timeSec * 12) > 0.85 ? 0.5 : 0.95;
      ctx.fillStyle = `rgba(235, 188, 108, ${lanternFlick})`;
      ctx.fillRect(2367, FOREST_GROUND_Y - 53, 4, 4);
      ctx.fillStyle = `rgba(235, 188, 108, ${0.14 * lanternFlick})`;
      ctx.fillRect(2358, FOREST_GROUND_Y - 54, 22, 16);
      ctx.fillStyle = '#2a241f';
      for (let fx = 2210; fx < 2268; fx += 12) {
        ctx.fillRect(fx, FOREST_GROUND_Y - 18, 3, 18);
      }
      ctx.fillRect(2208, FOREST_GROUND_Y - 13, 62, 2);
      ctx.fillStyle = '#3d5870';
      ctx.fillRect(2302, FOREST_GROUND_Y - 96, 22, 26);
      ctx.fillStyle = '#6c92b0';
      ctx.fillRect(2402, FOREST_GROUND_Y - 96, 22, 26);
      ctx.fillStyle = '#232830';
      ctx.fillRect(2302, FOREST_GROUND_Y - 96, 5, 26);
      ctx.fillRect(2319, FOREST_GROUND_Y - 96, 5, 26);
      ctx.fillRect(2402, FOREST_GROUND_Y - 96, 5, 26);
      ctx.fillRect(2419, FOREST_GROUND_Y - 96, 5, 26);
      ctx.fillStyle = '#1a2028';
      ctx.fillRect(2312, FOREST_GROUND_Y - 96, 2, 26);
      ctx.fillRect(2412, FOREST_GROUND_Y - 96, 2, 26);
      ctx.fillRect(2302, FOREST_GROUND_Y - 84, 22, 2);
      ctx.fillRect(2402, FOREST_GROUND_Y - 84, 22, 2);

      if (nearest) {
        this.drawInteractMarker(ctx, nearest.x, nearest.y - 38, timeSec);
      }

      this.drawPlayer(ctx, state, timeSec);
    } finally {
      ctx.restore();
    }

    this.renderForestLighting(ctx, state, cx, timeSec);

    // Keep soft drizzle visible during the hush event so rain never abruptly pops out
    this.drawRain(ctx, rainPausedActive ? 0.16 : 0.44, FOREST_GROUND_Y);
  }

  private renderHouse(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeSec: number,
    nearest: Interactable | null
  ): void {
    const pxSafe = safeNum(state.player.x, 120);
    const safeFloor = Number.isInteger(state.player.floor)
      ? Math.max(0, Math.min(4, state.player.floor))
      : 1;
    const targetCamX = Math.max(0, Math.min(1148 - VIRTUAL_W, pxSafe - VIRTUAL_W * 0.5));
    const playerFloorY = getHouseFloorY(safeFloor);
    const targetCamY = Math.max(-24, Math.min(610 - VIRTUAL_H, playerFloorY - VIRTUAL_H * 0.65));

    if (!Number.isFinite(this.camX) || !Number.isFinite(this.camY)) {
      this.camX = targetCamX;
      this.camY = targetCamY;
      this.camInitialized = true;
    } else if (!this.camInitialized) {
      this.camX = targetCamX;
      this.camY = targetCamY;
      this.camInitialized = true;
    } else {
      this.camX += (targetCamX - this.camX) * 0.14;
      this.camY += (targetCamY - this.camY) * 0.14;
    }

    const cx = Math.round(safeNum(this.camX, 0));
    const cy = Math.round(safeNum(this.camY, 0));

    // Night exterior backdrop around cutaway house + continuous exterior rain
    ctx.fillStyle = '#0a1019';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    this.drawPixelMoon(ctx, 412, 34);

    for (let i = 0; i < 16; i++) {
      this.drawPine(ctx, i * 86 - Math.round(cx * 0.25), 255, 86 + (i % 3) * 14, '#0f1824', '#162333');
    }
    this.drawRain(ctx, 0.28);

    ctx.save();
    try {
      ctx.translate(-cx, -cy);

      // Blit pre-rendered static architectural shell, walls, textures, floors & rugs
      ctx.drawImage(this.houseStaticCanvas, 0, -20);

      const stage = getLightingStage(state.installedParts.length);

      // Dynamic room elements: secret room shrouds, doorways/locks, animated windows & ceiling lamps
      for (let rIdx = 0; rIdx < HOUSE_ROOMS.length; rIdx++) {
        const room = HOUSE_ROOMS[rIdx];
        if (!room) continue;
        const floorY = getHouseFloorY(room.floor);
        const topY = floorY - 96;
        const nextRoom = HOUSE_ROOMS[rIdx + 1];
        const hasSameFloorNeighbor = Boolean(nextRoom && nextRoom.floor === room.floor);

        if (room.isSecret && !state.discoveredSecrets.includes(room.secretId ?? '')) {
          ctx.fillStyle = 'rgba(4, 6, 10, 0.78)';
          ctx.fillRect(room.x, topY, room.width, 96);
        }

        // Interior room divider & framed doorway archway between adjacent rooms
        if (hasSameFloorNeighbor && nextRoom) {
          const divX = room.x + room.width;
          const isSealedConcrete = room.floor === 0 && nextRoom.id === 'b_electric';
          const isLockedTechDoor =
            room.floor === 3 && nextRoom.id === 'f3_tech' && !state.collectedKeys.includes('tech_key');

          if (isSealedConcrete) {
            ctx.fillStyle = '#242b33';
            ctx.fillRect(divX - 3, topY, 6, 96);
            ctx.fillStyle = '#12161c';
            ctx.fillRect(divX - 1, topY, 2, 96);
          } else if (isLockedTechDoor) {
            ctx.fillStyle = '#131820';
            ctx.fillRect(divX - 3, topY, 6, 44);
            ctx.fillStyle = '#523d2b';
            ctx.fillRect(divX - 3, floorY - 52, 6, 52);
            ctx.fillStyle = '#d4b45e';
            ctx.fillRect(divX - 2, floorY - 28, 3, 3);
            ctx.fillStyle = '#d95353';
            ctx.fillRect(divX - 2, floorY - 34, 2, 2);
          } else {
            ctx.fillStyle = '#141922';
            ctx.fillRect(divX - 3, topY, 6, 44);
            ctx.fillStyle = '#47372a';
            ctx.fillRect(divX - 5, floorY - 53, 10, 4);
            ctx.fillRect(divX - 5, floorY - 49, 2, 49);
            ctx.fillRect(divX + 3, floorY - 49, 2, 49);
            ctx.fillStyle = '#10141c';
            ctx.fillRect(divX - 3, floorY - 49, 6, 49);
            ctx.fillStyle = '#798594';
            ctx.fillRect(divX + 9, floorY - 32, 2, 3);
          }
        }

      // Windows with moonlight + rain + curtains + lightning flash
      if (room.hasWindow && room.windowX) {
        const wx = room.windowX;
        const wy = topY + 19;
        const winFlash = this.getLightningIntensity(timeSec, false);
        ctx.fillStyle = winFlash > 0 ? '#4d7aa3' : '#122132';
        ctx.fillRect(wx - 15, wy, 30, 38);
        // Subtle moonlight shaft sloping down onto floor
        ctx.fillStyle = winFlash > 0 ? 'rgba(160, 205, 245, 0.12)' : 'rgba(110, 155, 200, 0.05)';
        ctx.beginPath();
        ctx.moveTo(wx - 13, wy + 38);
        ctx.lineTo(wx + 13, wy + 38);
        ctx.lineTo(wx + 24, floorY);
        ctx.lineTo(wx - 6, floorY);
        ctx.closePath();
        ctx.fill();
        // Animated rain streaks inside window pane
        ctx.fillStyle = 'rgba(145, 190, 225, 0.36)';
        const rOff = Math.floor((timeSec * 40) % 12);
        ctx.fillRect(wx - 8, wy + 4 + rOff, 1, 6);
        ctx.fillRect(wx + 6, wy + 16 + (rOff % 8), 1, 6);
        // Side curtains & sill
        ctx.fillStyle = '#2c2529';
        ctx.fillRect(wx - 16, wy - 1, 5, 40);
        ctx.fillRect(wx + 11, wy - 1, 5, 40);
        ctx.strokeStyle = '#4c5a6e';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx - 15, wy, 30, 38);
        ctx.fillStyle = '#4c5a6e';
        ctx.fillRect(wx - 1, wy, 2, 38);
        ctx.fillRect(wx - 15, wy + 18, 30, 2);
        ctx.fillRect(wx - 17, wy + 38, 34, 2);
      }

      // Hanging ceiling lamp fixture & warm/crimson light cone
      if (room.lampX) {
        ctx.fillStyle = '#28303b';
        ctx.fillRect(room.lampX - 1, topY + 5, 2, 8);
        const lit =
          stage >= (room.minLampStage ?? 99) ||
          (room.floor === 1 && room.id === 'f1_pantry' && stage >= 1);
        const flickerOff = stage === 1 && Math.sin(timeSec * 19) > 0.65;
        ctx.fillStyle = lit && !flickerOff ? (stage >= 3 ? '#ff9d78' : '#f2dfa8') : '#3c4552';
        ctx.fillRect(room.lampX - 5, topY + 13, 10, 3);

        if (lit && !flickerOff) {
          ctx.fillStyle =
            stage >= 3 ? 'rgba(255, 110, 90, 0.11)' : 'rgba(245, 220, 158, 0.11)';
          ctx.beginPath();
          ctx.moveTo(room.lampX - 4, topY + 16);
          ctx.lineTo(room.lampX - 42, floorY);
          ctx.lineTo(room.lampX + 42, floorY);
          ctx.lineTo(room.lampX + 4, topY + 16);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Staircases connecting floors
    this.drawStaircase(ctx, 715, HOUSE_FLOOR_Y[1], HOUSE_FLOOR_Y[2]);
    this.drawStaircase(ctx, 660, HOUSE_FLOOR_Y[2], HOUSE_FLOOR_Y[3]);
    this.drawStaircase(ctx, 865, HOUSE_FLOOR_Y[0], HOUSE_FLOOR_Y[1]);

    // Architectural secret panels & recessed hiding alcoves drawn behind furniture props
    {
      // Floor 1 under-stairs secret drawer (x=760)
      const f1y = HOUSE_FLOOR_Y[1];
      const stairsOpen = state.discoveredSecrets.includes('secret_under_stairs');
      ctx.fillStyle = '#2b221a';
      ctx.fillRect(748, f1y - 18, 22, 18);
      ctx.fillStyle = stairsOpen ? '#12161d' : '#3d3024';
      ctx.fillRect(750, f1y - 16, 18, 14);
      ctx.fillStyle = '#9b8352';
      ctx.fillRect(757, f1y - 10, 4, 2);
      if (stairsOpen) {
        ctx.fillStyle = '#4a3a2c';
        ctx.fillRect(751, f1y - 9, 18, 5);
      }

      // Floor 2 cabinet loose baseboard plank (x=262)
      const f2y = HOUSE_FLOOR_Y[2];
      const studyOpen = state.discoveredSecrets.includes('secret_study_blueprint');
      ctx.fillStyle = studyOpen ? '#11151b' : '#3a2d21';
      ctx.fillRect(253, f2y - 7, 18, 7);
      ctx.fillStyle = '#52402f';
      ctx.fillRect(253, studyOpen ? f2y - 12 : f2y - 7, 18, 3);

      // Floor 4 attic creaking floorboard (x=300)
      const f4y = HOUSE_FLOOR_Y[4];
      const atticBoardOpen = state.discoveredSecrets.includes('secret_attic_floorboard');
      ctx.fillStyle = atticBoardOpen ? '#0e1218' : '#4a392b';
      ctx.fillRect(289, f4y, 22, 4);
      if (atticBoardOpen) {
        ctx.fillStyle = '#5e4937';
        ctx.fillRect(288, f4y - 4, 18, 3);
      } else {
        ctx.fillStyle = '#241b14';
        ctx.fillRect(291, f4y - 1, 18, 1);
      }
    }

    for (const item of WORLD_INTERACTABLES) {
      if (item.zone === 'house' && item.kind === 'hiding_spot') {
        ctx.fillStyle = 'rgba(4, 7, 12, 0.36)';
        ctx.fillRect(item.x - 11, item.y - 48, 22, 48);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
        ctx.fillRect(item.x - 7, item.y - 46, 5, 46);
        ctx.fillRect(item.x + 2, item.y - 46, 5, 46);
        ctx.fillStyle = 'rgba(110, 165, 215, 0.16)';
        ctx.fillRect(item.x - 10, item.y - 48, 20, 1);
      }
    }

    // Props
    for (const prop of HOUSE_PROPS) {
      this.drawProp(ctx, prop, state, timeSec);
    }

    // Visible pickups resting cleanly on furniture surfaces & searchable container glints
    for (const item of WORLD_INTERACTABLES) {
      if (item.zone !== 'house') continue;
      if (item.requiresSecret && !state.discoveredSecrets.includes(item.requiresSecret)) continue;
      const drawY = item.visualY ?? item.y;

      if (item.kind === 'part' && item.partId && !state.collectedParts.includes(item.partId) && !state.installedParts.includes(item.partId)) {
        this.drawPartSprite(ctx, item.partId, item.x, drawY, timeSec);
      } else if (item.kind === 'note' && item.noteId && !state.collectedNotes.includes(item.noteId)) {
        // Grounded sheet of paper with crisp dark outline, contact shadow & wax corner seal
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(item.x - 5, drawY, 11, 2);
        ctx.fillStyle = '#12161c';
        ctx.fillRect(item.x - 6, drawY - 7, 12, 8);
        ctx.fillStyle = '#e6dec5';
        ctx.fillRect(item.x - 5, drawY - 6, 10, 6);
        ctx.fillStyle = '#786f5e';
        ctx.fillRect(item.x - 3, drawY - 4, 6, 1);
        ctx.fillRect(item.x - 3, drawY - 2, 4, 1);
        ctx.fillStyle = '#a83c3c';
        ctx.fillRect(item.x + 2, drawY - 2, 2, 2);
      } else if (item.kind === 'key' && item.keyId && !state.collectedKeys.includes(item.keyId)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
        ctx.fillRect(item.x - 4, drawY, 9, 2);
        ctx.fillStyle = '#12161c';
        ctx.fillRect(item.x - 5, drawY - 7, 10, 7);
        ctx.fillStyle = '#e3be5d';
        ctx.fillRect(item.x - 4, drawY - 6, 7, 3);
        ctx.fillRect(item.x + 1, drawY - 5, 2, 4);
      } else if (item.kind === 'audio_tape' && item.tapeId && !state.collectedTapes.includes(item.tapeId)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
        ctx.fillRect(item.x - 5, drawY, 11, 2);
        ctx.fillStyle = '#10141a';
        ctx.fillRect(item.x - 6, drawY - 7, 12, 7);
        ctx.fillStyle = '#252c36';
        ctx.fillRect(item.x - 5, drawY - 6, 10, 5);
        ctx.fillStyle = '#d4a65a';
        ctx.fillRect(item.x - 4, drawY - 5, 8, 2);
        ctx.fillStyle = '#dce6f0';
        ctx.fillRect(item.x - 3, drawY - 2, 2, 2);
        ctx.fillRect(item.x + 1, drawY - 2, 2, 2);
      } else if (item.kind === 'container' && !state.lootedContainers.includes(item.id)) {
        if (Math.sin(timeSec * 3.4 + item.x) > 0.35) {
          ctx.fillStyle = item.partId || item.keyId ? 'rgba(124, 212, 255, 0.62)' : 'rgba(124, 224, 155, 0.48)';
          ctx.fillRect(item.x - 1, item.y - 18, 2, 2);
        }
      }

      if (
        state.player.hasFlashlight &&
        state.player.flashlightOn &&
        item.floor === state.player.floor &&
        (item.kind === 'secret_trigger' || item.inspectId)
      ) {
        const dx = (item.x - state.player.x) * state.player.facing;
        if (dx > 12 && dx < 165 && Math.sin(timeSec * 6 + item.x) > 0.2) {
          ctx.fillStyle = 'rgba(255, 240, 188, 0.68)';
          ctx.fillRect(item.x - 1, drawY - 26, 2, 2);
          ctx.fillStyle = 'rgba(255, 240, 188, 0.32)';
          ctx.fillRect(item.x - 2, drawY - 25, 4, 1);
        }
      }
    }

    // Robot Girl & Workbench in 1F Кладовая
    this.drawRobotWorkbench(ctx, state, timeSec);

    // Eerie silhouette on 2F hallway at high stages until approached
    if (
      state.installedParts.length >= 5 &&
      !state.atmospheric.hallwaySilhouetteSeen &&
      (state.player.floor !== 2 || Math.abs(state.player.x - 600) > 155)
    ) {
      ctx.fillStyle = 'rgba(8, 12, 18, 0.92)';
      ctx.fillRect(600, HOUSE_FLOOR_Y[2] - 34, 10, 34);
      ctx.fillRect(602, HOUSE_FLOOR_Y[2] - 42, 6, 8);
      ctx.fillStyle = '#ff4b4b';
      ctx.fillRect(603, HOUSE_FLOOR_Y[2] - 39, 2, 2);
      ctx.fillRect(606, HOUSE_FLOOR_Y[2] - 39, 2, 2);
    }

    // Dynamic stealth Shadow Encounter silhouette differentiated by behavior
    if (state.shadowEncounter.active) {
      const shY = getHouseFloorY(state.shadowEncounter.floor);
      const shX = Math.round(safeNum(state.shadowEncounter.x, 420));
      const behavior = state.shadowEncounter.behavior;
      const isGuide = behavior === 'guide';
      const isStalk = behavior === 'stalk';
      const isLightReact = behavior === 'light_react';
      const exp = Math.max(0, Math.min(1, safeNum(state.shadowEncounter.exposure, 0)));
      const dirToPlayer = state.player.x >= shX ? 1 : -1;
      const shiver = isLightReact && exp > 0.12 ? Math.round(Math.sin(timeSec * 42) * (1 + exp * 1.5)) : 0;
      const jitter = Math.round(Math.sin(timeSec * 28) * (exp > 0.3 ? 1 : 0)) + shiver;
      const baseAlpha = isGuide ? 0.68 : 0.76 + exp * 0.22;

      for (let w = -2; w <= 2; w++) {
        const wy = shY - 3 - Math.abs(Math.round(Math.sin(timeSec * 3.4 + w * 1.4) * 5));
        const wx = shX + w * 4 + Math.round(Math.sin(timeSec * 2.1 + w) * 2);
        ctx.fillStyle = isGuide
          ? `rgba(26, 48, 68, ${0.32 - Math.abs(w) * 0.06})`
          : `rgba(8, 10, 16, ${0.42 - Math.abs(w) * 0.07})`;
        ctx.fillRect(wx, wy, 3, 4);
      }

      const hunchY = isStalk ? 4 : isGuide ? 1 : -2; // 'observe' stands tallest
      const leanX = isStalk ? dirToPlayer * 2 : 0;
      ctx.fillStyle = isGuide ? `rgba(14, 24, 34, ${baseAlpha})` : `rgba(5, 7, 12, ${baseAlpha})`;
      ctx.fillRect(shX - 7 + jitter, shY - 22, 14, 22);
      ctx.fillRect(shX - 6 + jitter + Math.round(leanX * 0.5), shY - 36 + hunchY, 12, 15 - hunchY);
      ctx.fillRect(shX - 4 + jitter + leanX, shY - 40 + hunchY, 8, 5);
      ctx.fillRect(shX - 3 + jitter + leanX, shY - 47 + hunchY, 6, 8);

      // Behavior-specific arms/tendrils
      const wispLift = Math.round(Math.sin(timeSec * 4.2) * 2);
      ctx.fillStyle = isGuide ? 'rgba(40, 82, 112, 0.48)' : isLightReact && exp > 0.2 ? 'rgba(95, 16, 20, 0.68)' : 'rgba(22, 8, 12, 0.55)';
      if (isGuide) {
        const pointDir = (state.shadowEncounter.guideTargetX ?? shX + 30) >= shX ? 1 : -1;
        ctx.fillRect(shX + (pointDir > 0 ? 5 : -14), shY - 31, 9, 2);
        ctx.fillRect(shX + (pointDir > 0 ? 12 : -15), shY - 32, 3, 2);
      } else if (isStalk) {
        ctx.fillRect(shX + (dirToPlayer > 0 ? 4 : -13) + jitter, shY - 30 + wispLift, 9, 2);
        ctx.fillRect(shX - 9 + jitter, shY - 33 - wispLift, 2, 9);
      } else {
        ctx.fillRect(shX - 9 + jitter, shY - 35 + wispLift + hunchY, 2, isLightReact ? 11 : 8);
        ctx.fillRect(shX + 7 + jitter, shY - 34 - wispLift + hunchY, 2, isLightReact ? 11 : 8);
      }

      // Piercing optical slits
      ctx.fillStyle = isGuide
        ? 'rgba(130, 215, 255, 0.92)'
        : isLightReact && exp > 0.15
        ? '#ff2222'
        : exp > 0.25
        ? '#ff3a3a'
        : 'rgba(255, 70, 70, 0.82)';
      ctx.fillRect(shX - 2 + jitter + leanX, shY - 44 + hunchY, 2, 2);
      ctx.fillRect(shX + 1 + jitter + leanX, shY - 44 + hunchY, 2, 2);
      if (Math.sin(timeSec * 19) > 0.45) {
        ctx.fillStyle = isGuide ? 'rgba(110, 195, 240, 0.34)' : 'rgba(210, 56, 66, 0.3)';
        ctx.fillRect(shX - 9 + jitter, shY - 28, 18, 1);
        ctx.fillRect(shX - 6 + jitter, shY - 14, 12, 1);
      }
    }

    if (nearest) {
      this.drawInteractMarker(ctx, getInteractableEffectiveX(state, nearest), nearest.y - 42, timeSec);
    }

    this.drawPlayer(ctx, state, timeSec);
    } finally {
      ctx.restore();
    }

    this.renderHouseLighting(ctx, state, cx, cy, timeSec);
  }

  private drawStaircase(ctx: CanvasRenderingContext2D, x: number, bottomY: number, topY: number): void {
    const steps = 12;
    const dx = 3;
    const dy = (bottomY - topY) / steps;
    for (let i = 0; i < steps; i++) {
      const sx = x - 18 + i * dx;
      const sy = bottomY - (i + 1) * dy;
      ctx.fillStyle = '#3b2f24';
      ctx.fillRect(Math.round(sx), Math.round(sy), 14, Math.ceil(dy) + 1);
      ctx.fillStyle = '#524234';
      ctx.fillRect(Math.round(sx), Math.round(sy), 14, 2);
    }
    // Balusters & handrail
    ctx.strokeStyle = '#5a4939';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 16, bottomY - 19);
    ctx.lineTo(x + 18, topY - 19);
    ctx.stroke();
  }

  private drawProp(ctx: CanvasRenderingContext2D, prop: PropDef, state: GameState, timeSec: number): void {
    const y = getHouseFloorY(prop.floor);
    const x = prop.x;

    // Grounded contact shadow beneath heavy floor-standing furniture
    const heavyShadowWidths: Partial<Record<PropDef['type'], number>> = {
      sofa: 50,
      fridge: 26,
      cabinet: 28,
      archive_cabinets: 28,
      desk: 38,
      wardrobe: 32,
      grandfather_clock: 20,
      bathtub: 44,
      boxes: 32,
      workbench_tools: prop.floor === 3 ? 68 : 36,
      boiler: 34,
      radio_station: 30,
      monitors: 36,
      bed: 52,
      side_table: 18,
      storage_rack: 26,
      kitchen_counter: 26,
      pipe_valve: 16,
    };
    const shadowW = heavyShadowWidths[prop.type];
    if (shadowW) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.fillRect(x - Math.round(shadowW / 2), y - 1, shadowW, 2);
    }

    switch (prop.type) {
      case 'exit_door': {
        // Exterior oak front door with transom window & moonlight threshold
        ctx.fillStyle = '#2d2219';
        ctx.fillRect(x - 13, y - 56, 26, 56);
        ctx.fillStyle = '#473628';
        ctx.fillRect(x - 11, y - 54, 22, 54);
        ctx.fillStyle = '#182838';
        ctx.fillRect(x - 7, y - 51, 14, 7);
        ctx.fillStyle = 'rgba(155, 200, 238, 0.25)';
        ctx.fillRect(x - 6, y - 50, 12, 2);
        ctx.fillStyle = '#36291e';
        ctx.fillRect(x - 8, y - 40, 16, 16);
        ctx.fillRect(x - 8, y - 21, 16, 17);
        ctx.fillStyle = '#d4b45e';
        ctx.fillRect(x + 7, y - 27, 2, 4);
        ctx.fillStyle = 'rgba(135, 180, 220, 0.22)';
        ctx.fillRect(x - 10, y - 1, 20, 1);
        break;
      }
      case 'cellar_door': {
        const hasKey = state.collectedKeys.includes('basement_key');
        ctx.fillStyle = '#2a2018';
        ctx.fillRect(x - 13, y - 54, 26, 54);
        if (hasKey) {
          ctx.fillStyle = '#0c0f15';
          ctx.fillRect(x - 10, y - 51, 20, 51);
          // Visible descending cellar step silhouette
          ctx.fillStyle = '#2e241b';
          ctx.fillRect(x - 9, y - 10, 18, 3);
          ctx.fillRect(x - 9, y - 5, 18, 3);
          ctx.fillStyle = '#4f3d2e';
          ctx.fillRect(x - 11, y - 51, 5, 51);
        } else {
          ctx.fillStyle = '#463527';
          ctx.fillRect(x - 10, y - 51, 20, 51);
          ctx.fillStyle = '#222830';
          ctx.fillRect(x - 10, y - 41, 14, 2);
          ctx.fillRect(x - 10, y - 16, 14, 2);
          // Heavy brass padlock indicator
          ctx.fillStyle = '#d4af54';
          ctx.fillRect(x + 5, y - 28, 4, 5);
          ctx.fillStyle = '#d95353';
          ctx.fillRect(x + 6, y - 32, 2, 2);
        }
        break;
      }
      case 'side_table':
        ctx.fillStyle = '#382a1e';
        ctx.fillRect(x - 8, y - 16, 3, 16);
        ctx.fillRect(x + 5, y - 16, 3, 16);
        ctx.fillStyle = '#4b392a';
        ctx.fillRect(x - 7, y - 7, 14, 2);
        ctx.fillStyle = '#5e4936';
        ctx.fillRect(x - 10, y - 18, 20, 3);
        ctx.fillStyle = '#755c46';
        ctx.fillRect(x - 9, y - 18, 18, 1);
        break;
      case 'kitchen_counter':
        ctx.fillStyle = '#3b4245';
        ctx.fillRect(x - 13, y - 20, 26, 20);
        ctx.fillStyle = '#292e30';
        ctx.fillRect(x - 11, y - 17, 22, 5);
        ctx.fillRect(x - 11, y - 10, 10, 8);
        ctx.fillRect(x + 1, y - 10, 10, 8);
        ctx.fillStyle = '#9aa6ad';
        ctx.fillRect(x - 2, y - 15, 4, 1);
        ctx.fillStyle = '#6c563f';
        ctx.fillRect(x - 14, y - 22, 28, 3);
        ctx.fillStyle = '#876d52';
        ctx.fillRect(x - 13, y - 22, 26, 1);
        break;
      case 'storage_rack':
        // Industrial basement steel shelf rack + stacked boxes (f0_hide_nook behind)
        ctx.fillStyle = '#2b333b';
        ctx.fillRect(x - 13, y - 54, 2, 54);
        ctx.fillRect(x + 11, y - 54, 2, 54);
        ctx.fillStyle = '#404b57';
        for (const sy of [y - 50, y - 35, y - 20, y - 6]) {
          ctx.fillRect(x - 13, sy, 26, 2);
        }
        ctx.fillStyle = '#594838';
        ctx.fillRect(x - 10, y - 49, 10, 12);
        ctx.fillStyle = '#384b59';
        ctx.fillRect(x + 2, y - 47, 7, 10);
        ctx.fillStyle = '#4c3e30';
        ctx.fillRect(x - 9, y - 33, 17, 11);
        ctx.fillStyle = '#616e7a';
        ctx.fillRect(x - 6, y - 18, 8, 10);
        break;
      case 'floor_hatch':
        ctx.fillStyle = '#473628';
        ctx.fillRect(x - 16, y - 3, 32, 6);
        ctx.fillStyle = '#0e1319';
        ctx.fillRect(x - 12, y - 1, 24, 5);
        ctx.fillStyle = '#634c38';
        ctx.fillRect(x - 10, y + 1, 20, 2);
        ctx.fillStyle = '#b5944e';
        ctx.fillRect(x + 8, y - 2, 3, 2);
        break;
      case 'pipe_valve':
        // Horizontal junction pipe to p_pipes + cast-iron valve pedestal box (top at y-22)
        ctx.fillStyle = '#53616e';
        ctx.fillRect(x - 14, y - 15, 10, 4);
        ctx.fillStyle = '#38434f';
        ctx.fillRect(x - 9, y - 22, 18, 22);
        ctx.fillStyle = '#5f7082';
        ctx.fillRect(x - 10, y - 22, 20, 3);
        ctx.fillStyle = '#b8944f';
        ctx.fillRect(x + 3, y - 18, 4, 4);
        ctx.fillStyle = '#181e24';
        ctx.fillRect(x + 4, y - 17, 2, 2);
        ctx.fillStyle = '#c24646';
        ctx.fillRect(x - 5, y - 15, 7, 7);
        ctx.fillStyle = '#252d36';
        ctx.fillRect(x - 4, y - 14, 5, 1);
        ctx.fillRect(x - 2, y - 16, 1, 5);
        ctx.fillStyle = '#14191f';
        ctx.fillRect(x - 2, y - 12, 2, 2);
        break;
      case 'coat_rack':
        ctx.fillStyle = '#47392d';
        ctx.fillRect(x - 1, y - 46, 3, 46);
        ctx.fillRect(x - 7, y - 2, 15, 2);
        ctx.fillStyle = '#332924';
        ctx.fillRect(x - 5, y - 50, 10, 2);
        ctx.fillRect(x - 3, y - 53, 6, 3);
        ctx.fillStyle = '#252f3d';
        ctx.fillRect(x - 6, y - 40, 12, 24);
        ctx.fillStyle = '#1b222e';
        ctx.fillRect(x - 2, y - 40, 2, 24);
        break;
      case 'mirror': {
        const isBathSecret = prop.floor === 2 && state.discoveredSecrets.includes('secret_bathroom_mirror');
        const shift = isBathSecret ? -14 : 0;
        if (prop.floor === 2 && isBathSecret) {
          // Recessed tiled medicine cavity revealed once mirror slides open
          ctx.fillStyle = '#0e141a';
          ctx.fillRect(x - 7, y - 48, 15, 26);
          ctx.fillStyle = '#2a3d47';
          ctx.fillRect(x - 6, y - 28, 13, 2);
          ctx.fillRect(x - 6, y - 38, 13, 1);
        }
        ctx.fillStyle = '#5c4b39';
        ctx.fillRect(x - 10 + shift, y - 50, 20, 30);
        ctx.fillStyle = '#314452';
        ctx.fillRect(x - 8 + shift, y - 48, 16, 26);
        ctx.fillStyle = 'rgba(205,235,255,0.22)';
        ctx.fillRect(x - 6 + shift, y - 46, 2, 18);
        ctx.fillRect(x - 3 + shift, y - 44, 1, 10);
        if (state.installedParts.length >= 4 && Math.sin(timeSec * 2.2) > 0.45) {
          ctx.fillStyle = 'rgba(12, 16, 22, 0.75)';
          ctx.fillRect(x + 1 + shift, y - 40, 5, 16);
          ctx.fillStyle = 'rgba(220, 82, 82, 0.7)';
          ctx.fillRect(x + 3 + shift, y - 37, 1, 1);
        }
        break;
      }
      case 'phone':
        ctx.fillStyle = '#473a2f';
        ctx.fillRect(x - 9, y - 22, 18, 22);
        ctx.fillStyle = '#322921';
        ctx.fillRect(x - 7, y - 19, 14, 15);
        ctx.fillStyle = '#181c22';
        ctx.fillRect(x - 6, y - 28, 12, 6);
        if (!state.phoneListened && Math.sin(timeSec * 5.2) > 0) {
          ctx.fillStyle = '#ff4b4b';
          ctx.fillRect(x + 2, y - 26, 2, 2);
        } else if (state.phoneListened) {
          ctx.fillStyle = '#5bd98b';
          ctx.fillRect(x + 2, y - 26, 2, 2);
        }
        break;
      case 'key_shelf':
        ctx.fillStyle = '#544333';
        ctx.fillRect(x - 10, y - 35, 20, 4);
        ctx.fillStyle = '#3b2e22';
        ctx.fillRect(x - 8, y - 31, 2, 4);
        ctx.fillRect(x + 6, y - 31, 2, 4);
        break;
      case 'sofa':
        ctx.fillStyle = '#472c2a';
        ctx.fillRect(x - 24, y - 16, 48, 16);
        ctx.fillStyle = '#5e3c39';
        ctx.fillRect(x - 22, y - 24, 44, 10);
        ctx.fillStyle = '#734d49';
        ctx.fillRect(x - 18, y - 17, 15, 6);
        ctx.fillRect(x + 2, y - 17, 15, 6);
        ctx.fillStyle = '#4d312f';
        ctx.fillRect(x - 25, y - 19, 5, 19);
        ctx.fillRect(x + 20, y - 19, 5, 19);
        break;
      case 'fireplace': {
        // Brick chimney breast extending up to ceiling + subtle brick mortar courses
        ctx.fillStyle = '#2d2f36';
        ctx.fillRect(x - 14, y - 92, 28, 50);
        ctx.fillStyle = '#22242a';
        for (let by = y - 88; by < y - 46; by += 7) {
          ctx.fillRect(x - 13, by, 26, 1);
        }
        ctx.fillStyle = '#393b44';
        ctx.fillRect(x - 18, y - 44, 36, 44);
        ctx.fillStyle = '#575863';
        ctx.fillRect(x - 22, y - 46, 44, 4);
        // Candle far left & mantel clock far right so center mantel stays open for note_13
        ctx.fillStyle = '#8c7e65';
        ctx.fillRect(x - 17, y - 52, 3, 6);
        ctx.fillStyle = Math.sin(timeSec * 9.5) > 0 ? '#f6d27a' : '#e08944';
        ctx.fillRect(x - 16, y - 55, 1, 3);
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(x + 10, y - 53, 8, 7);
        ctx.fillStyle = '#c4b898';
        ctx.fillRect(x + 12, y - 51, 4, 4);
        ctx.fillStyle = '#101115';
        ctx.fillRect(x - 10, y - 22, 20, 22);
        // Charred logs & layered animated hearth firelight
        ctx.fillStyle = '#2b211c';
        ctx.fillRect(x - 7, y - 3, 14, 3);
        const fireActive = state.installedParts.length >= 1;
        const flickerA = Math.round(Math.sin(timeSec * 11) * 1.5);
        const flickerB = Math.round(Math.cos(timeSec * 15) * 1.5);
        const emberAlpha = fireActive
          ? 0.65 + Math.abs(Math.sin(timeSec * 5.1)) * 0.25
          : 0.28 + Math.abs(Math.sin(timeSec * 3.1)) * 0.25;
        ctx.fillStyle = `rgba(225, 78, 38, ${emberAlpha})`;
        ctx.fillRect(x - 6, y - 4, 12, 2);
        if (fireActive) {
          ctx.fillStyle = 'rgba(242, 118, 42, 0.88)';
          ctx.fillRect(x - 5 + flickerA, y - 10, 4, 6);
          ctx.fillRect(x + 1 + flickerB, y - 9, 4, 5);
          ctx.fillRect(x - 2 - flickerA, y - 13, 4, 9);
          ctx.fillStyle = 'rgba(255, 220, 125, 0.92)';
          ctx.fillRect(x - 2 + flickerB, y - 8, 3, 5);
          const sparkY = Math.floor((timeSec * 20) % 14);
          ctx.fillStyle = 'rgba(255, 195, 95, 0.65)';
          ctx.fillRect(x + (sparkY % 3) - 1, y - 7 - sparkY, 1, 1);
        }
        break;
      }
      case 'tv':
        ctx.fillStyle = '#3b3229';
        ctx.fillRect(x - 12, y - 30, 24, 30);
        ctx.fillStyle = '#26201a';
        ctx.fillRect(x - 10, y - 12, 20, 10);
        ctx.fillStyle = '#687582';
        ctx.fillRect(x - 4, y - 35, 1, 5);
        ctx.fillRect(x + 3, y - 35, 1, 5);
        if (state.atmospheric.tvStaticTriggered) {
          ctx.fillStyle = '#2d3b47';
          ctx.fillRect(x - 9, y - 27, 18, 13);
          const tvSeed = Math.floor(timeSec * 24);
          ctx.fillStyle = '#a4bfd4';
          for (let sy = 0; sy < 12; sy += 3) {
            const sx = (tvSeed * 7 + sy * 13) % 10;
            ctx.fillRect(x - 8 + sx, y - 26 + sy, 6, 1);
          }
        } else {
          ctx.fillStyle = '#161c22';
          ctx.fillRect(x - 9, y - 27, 18, 13);
        }
        break;
      case 'bookshelf':
        ctx.fillStyle = '#423426';
        ctx.fillRect(x - 15, y - 52, 30, 52);
        ctx.fillStyle = '#2b2117';
        ctx.fillRect(x - 13, y - 49, 26, 44);
        ctx.fillStyle = '#5c4a38';
        ctx.fillRect(x - 13, y - 37, 26, 2);
        ctx.fillRect(x - 13, y - 23, 26, 2);
        ctx.fillStyle = '#753e38';
        ctx.fillRect(x - 11, y - 47, 4, 10);
        ctx.fillStyle = '#426155';
        ctx.fillRect(x - 5, y - 47, 4, 10);
        ctx.fillStyle = '#5d6b82';
        ctx.fillRect(x + 1, y - 47, 4, 10);
        ctx.fillStyle = '#807052';
        ctx.fillRect(x - 9, y - 33, 5, 9);
        ctx.fillStyle = '#4d5d73';
        ctx.fillRect(x - 1, y - 33, 4, 9);
        break;
      case 'photos':
        ctx.fillStyle = state.atmospheric.portraitChanged ? '#4a2020' : '#524436';
        ctx.fillRect(x - 10, y - 47, 20, 15);
        ctx.fillStyle = state.atmospheric.portraitChanged ? '#160909' : '#7a7263';
        ctx.fillRect(x - 8, y - 45, 16, 11);
        if (state.atmospheric.portraitChanged) {
          ctx.fillStyle = '#4a1b1b';
          ctx.fillRect(x - 5, y - 38, 10, 2);
          ctx.fillStyle = '#ff5252';
          ctx.fillRect(x - 1, y - 42, 2, 2);
        } else {
          ctx.fillStyle = '#332b24';
          ctx.fillRect(x - 5, y - 42, 3, 7);
          ctx.fillRect(x + 2, y - 41, 3, 6);
        }
        break;
      case 'fridge':
        ctx.fillStyle = '#6f7c82';
        ctx.fillRect(x - 12, y - 52, 24, 52);
        ctx.fillStyle = '#8a989e';
        ctx.fillRect(x - 11, y - 51, 22, 2);
        ctx.fillStyle = '#4f5a5f';
        ctx.fillRect(x - 12, y - 32, 24, 2);
        ctx.fillStyle = '#b4c2c7';
        ctx.fillRect(x + 7, y - 44, 2, 8);
        ctx.fillRect(x + 7, y - 25, 2, 10);
        break;
      case 'kitchen_table':
        ctx.fillStyle = '#3b2e22';
        ctx.fillRect(x - 24, y - 22, 3, 22);
        ctx.fillRect(x - 24, y - 12, 8, 2);
        ctx.fillRect(x + 21, y - 22, 3, 22);
        ctx.fillRect(x + 16, y - 12, 8, 2);
        ctx.fillStyle = '#594534';
        ctx.fillRect(x - 18, y - 19, 36, 3);
        ctx.fillRect(x - 14, y - 16, 3, 16);
        ctx.fillRect(x + 11, y - 16, 3, 16);
        ctx.fillStyle = '#738896';
        ctx.fillRect(x + 9, y - 23, 4, 4);
        break;
      case 'sink': {
        const wideBath = prop.floor === 2;
        const tapOffset = wideBath ? -4 : 0;
        ctx.fillStyle = '#485054';
        ctx.fillRect(x - (wideBath ? 14 : 12), y - 22, wideBath ? 28 : 24, 22);
        ctx.fillStyle = '#626d73';
        ctx.fillRect(x - (wideBath ? 14 : 12), y - 24, wideBath ? 28 : 24, 2);
        ctx.fillStyle = '#b4c2c7';
        ctx.fillRect(x - 9 + tapOffset, y - 24, 15, 1);
        ctx.fillStyle = '#8b9ca6';
        ctx.fillRect(x - 2 + tapOffset, y - 31, 4, 7);
        ctx.fillRect(x - 2 + tapOffset, y - 31, 6, 2);
        const drip = (timeSec * 14) % 9;
        if (drip < 6) {
          ctx.fillStyle = '#80c2eb';
          ctx.fillRect(x + 3 + tapOffset, y - 29 + Math.floor(drip), 1, 2);
        }
        break;
      }
      case 'cabinet':
      case 'archive_cabinets': {
        const isPowerLocker = prop.id === 'p_arch0';
        const isWorkshopDrawer = prop.id === 'p_cab3' && state.discoveredSecrets.includes('secret_workshop_drawer');
        const opened = (prop.containerId ? state.openedContainers.includes(prop.containerId) : false) || isWorkshopDrawer;
        ctx.fillStyle = isPowerLocker ? '#28323d' : '#39414a';
        ctx.fillRect(x - 13, y - 40, 26, 40);
        ctx.fillStyle = isPowerLocker ? '#435568' : '#4e5966';
        ctx.fillRect(x - 13, y - 40, 26, 2);
        if (isPowerLocker) {
          // Emergency illuminated glass locker holding power_core
          ctx.fillStyle = '#101922';
          ctx.fillRect(x - 10, y - 35, 20, 14);
          ctx.fillStyle = '#d49a4c';
          ctx.fillRect(x - 11, y - 37, 22, 1);
          ctx.fillStyle = '#252b32';
          ctx.fillRect(x - 11, y - 16, 22, 2);
          ctx.fillStyle = '#8a99a8';
          ctx.fillRect(x - 3, y - 10, 6, 2);
        } else {
          ctx.fillStyle = '#252b32';
          ctx.fillRect(x - 11, y - 27, 22, 2);
          ctx.fillRect(x - 11, y - 14, 22, 2);
          ctx.fillStyle = '#8a99a8';
          ctx.fillRect(x - 3, y - 34, 6, 2);
          ctx.fillRect(x - 3, y - 21, 6, 2);
          ctx.fillRect(x - 3, y - 8, 6, 2);
          if (opened) {
            ctx.fillStyle = '#12161c';
            ctx.fillRect(x - 10, y - 25, 20, 9);
            ctx.fillStyle = '#54606e';
            ctx.fillRect(x - 10, y - 19, 20, 4);
          }
        }
        break;
      }
      case 'safe': {
        ctx.fillStyle = '#2c343d';
        ctx.fillRect(x - 11, y - 34, 22, 22);
        ctx.fillStyle = '#404b57';
        ctx.fillRect(x - 9, y - 32, 18, 18);
        if (state.safeUnlocked) {
          ctx.fillStyle = '#0e1318';
          ctx.fillRect(x - 7, y - 30, 14, 14);
          ctx.fillStyle = '#566473';
          ctx.fillRect(x + 9, y - 32, 6, 18);
          ctx.fillStyle = '#5bd98b';
          ctx.fillRect(x - 7, y - 33, 3, 2);
        } else {
          ctx.fillStyle = '#192028';
          ctx.fillRect(x - 5, y - 28, 7, 7);
          ctx.fillStyle = '#d4aa4c';
          ctx.fillRect(x + 4, y - 25, 3, 3);
          ctx.fillStyle = '#d95757';
          ctx.fillRect(x - 7, y - 33, 3, 2);
        }
        break;
      }
      case 'painting': {
        const tilted = state.discoveredSecrets.includes('secret_painting') ? 6 : 0;
        ctx.fillStyle = '#11151b';
        ctx.fillRect(x - 9, y - 47, 18, 14);
        if (tilted !== 0) {
          ctx.fillStyle = '#314f66';
          ctx.fillRect(x - 6, y - 45, 12, 10);
          ctx.fillStyle = '#74b9e8';
          ctx.fillRect(x - 4, y - 42, 7, 1);
          ctx.fillRect(x - 4, y - 39, 5, 1);
        }
        ctx.fillStyle = '#5c4934';
        ctx.fillRect(x - 11 - tilted, y - 48, 22, 17);
        ctx.fillStyle = '#2e4038';
        ctx.fillRect(x - 9 - tilted, y - 46, 18, 13);
        ctx.fillStyle = '#5a7365';
        ctx.fillRect(x - 7 - tilted, y - 42, 12, 4);
        break;
      }
      case 'bed':
        ctx.fillStyle = '#4d3d2f';
        ctx.fillRect(x - 25, y - 16, 50, 16);
        ctx.fillRect(x - 25, y - 28, 4, 14);
        ctx.fillRect(x + 21, y - 22, 4, 8);
        ctx.fillStyle = '#586475';
        ctx.fillRect(x - 21, y - 20, 42, 8);
        ctx.fillStyle = '#424c59';
        ctx.fillRect(x - 6, y - 20, 27, 6);
        ctx.fillStyle = '#9aa4b0';
        ctx.fillRect(x - 21, y - 23, 11, 4);
        break;
      case 'desk':
        ctx.fillStyle = '#4c3b2c';
        ctx.fillRect(x - 19, y - 20, 38, 4);
        ctx.fillRect(x - 17, y - 16, 4, 16);
        ctx.fillRect(x + 13, y - 16, 4, 16);
        ctx.fillStyle = '#36291e';
        ctx.fillRect(x + 4, y - 16, 10, 10);
        ctx.fillStyle = 'rgba(245, 208, 125, 0.14)';
        ctx.beginPath();
        ctx.moveTo(x + 7, y - 27);
        ctx.lineTo(x - 2, y - 20);
        ctx.lineTo(x + 18, y - 20);
        ctx.lineTo(x + 13, y - 27);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#687482';
        ctx.fillRect(x + 10, y - 28, 2, 8);
        ctx.fillStyle = '#8a744c';
        ctx.fillRect(x + 6, y - 31, 8, 4);
        ctx.fillStyle = '#f5d484';
        ctx.fillRect(x + 8, y - 27, 4, 1);
        ctx.fillStyle = '#20262e';
        ctx.fillRect(x - 10, y - 23, 3, 3);
        break;
      case 'wardrobe': {
        const shifted = state.discoveredSecrets.includes('secret_wardrobe') ? -14 : 0;
        if (shifted !== 0) {
          ctx.fillStyle = '#0c1016';
          ctx.fillRect(x + 5, y - 52, 21, 52);
          ctx.fillStyle = '#2f2720';
          ctx.fillRect(x + 6, y - 20, 19, 2);
        }
        ctx.fillStyle = '#403226';
        ctx.fillRect(x - 15 + shifted, y - 56, 30, 56);
        ctx.fillStyle = '#544233';
        ctx.fillRect(x - 16 + shifted, y - 58, 32, 3);
        ctx.fillStyle = '#2c2117';
        ctx.fillRect(x - 1 + shifted, y - 54, 2, 52);
        ctx.fillStyle = '#a38952';
        ctx.fillRect(x - 3 + shifted, y - 32, 1, 3);
        ctx.fillRect(x + 2 + shifted, y - 32, 1, 3);
        break;
      }
      case 'grandfather_clock': {
        ctx.fillStyle = '#423325';
        ctx.fillRect(x - 9, y - 62, 18, 62);
        ctx.fillStyle = '#594432';
        ctx.fillRect(x - 11, y - 64, 22, 3);
        ctx.fillStyle = state.clockSolved ? '#c4b898' : '#9e947e';
        ctx.fillRect(x - 5, y - 55, 10, 9);
        ctx.fillStyle = '#1f1812';
        ctx.fillRect(x - 1, y - 51, 3, 1);
        ctx.fillRect(x - 1, y - 53, 1, 3);
        ctx.fillStyle = '#211912';
        ctx.fillRect(x - 4, y - 41, 8, 29);
        const pendOffset = Math.round(Math.sin(timeSec * 2.4) * 2);
        ctx.fillStyle = '#c4a45c';
        ctx.fillRect(x - 1 + pendOffset, y - 39, 1, 18);
        ctx.fillRect(x - 2 + pendOffset, y - 21, 3, 3);
        if (!state.clockSolved && Math.sin(timeSec * 3) > 0.2) {
          ctx.fillStyle = '#e0b858';
          ctx.fillRect(x + 5, y - 32, 2, 3);
        }
        break;
      }
      case 'bathtub':
        ctx.fillStyle = '#748085';
        ctx.fillRect(x - 21, y - 16, 42, 14);
        ctx.fillStyle = '#8b999e';
        ctx.fillRect(x - 22, y - 18, 44, 3);
        ctx.fillStyle = '#4b5459';
        ctx.fillRect(x - 18, y - 2, 4, 2);
        ctx.fillRect(x + 14, y - 2, 4, 2);
        ctx.fillRect(x - 18, y - 28, 2, 10);
        ctx.fillRect(x - 18, y - 28, 5, 2);
        break;
      case 'boxes': {
        const opened = prop.containerId ? state.openedContainers.includes(prop.containerId) : false;
        const isTrunk = prop.id === 'p_boxes4' || prop.id === 'p_boxes4b';
        if (isTrunk) {
          ctx.fillStyle = '#473628';
          ctx.fillRect(x - 16, y - 17, 32, 17);
          ctx.fillStyle = '#272c33';
          ctx.fillRect(x - 12, y - 17, 2, 17);
          ctx.fillRect(x + 10, y - 17, 2, 17);
          ctx.fillStyle = '#b5944e';
          ctx.fillRect(x - 2, y - 14, 4, 3);
          if (opened) {
            ctx.fillStyle = '#14171d';
            ctx.fillRect(x - 14, y - 17, 28, 4);
            ctx.fillStyle = '#5c4634';
            ctx.fillRect(x - 15, y - 22, 30, 4);
          } else {
            ctx.fillStyle = '#5c4634';
            ctx.fillRect(x - 16, y - 20, 32, 3);
          }
        } else {
          ctx.fillStyle = '#524233';
          ctx.fillRect(x - 15, y - 16, 16, 16);
          ctx.fillStyle = '#403427';
          ctx.fillRect(x + 2, y - 25, 14, 25);
          ctx.fillStyle = '#2c2219';
          ctx.fillRect(x + 4, y - 15, 10, 2);
          if (opened) {
            ctx.fillStyle = '#14171d';
            ctx.fillRect(x - 13, y - 15, 12, 4);
            ctx.fillStyle = '#6b5642';
            ctx.fillRect(x - 17, y - 20, 12, 3);
          } else {
            ctx.fillStyle = '#705a46';
            ctx.fillRect(x - 15, y - 17, 16, 2);
          }
        }
        break;
      }
      case 'workbench_tools': {
        const opened = prop.containerId ? state.openedContainers.includes(prop.containerId) : false;
        const isWideWorkshop = prop.floor === 3;
        if (isWideWorkshop) {
          // Wide 70px craftsman bench supporting both left_leg (x-20) and note_19 (x+20)
          ctx.fillStyle = '#47392b';
          ctx.fillRect(x - 34, y - 22, 68, 4);
          ctx.fillStyle = '#63503d';
          ctx.fillRect(x - 34, y - 22, 68, 1);
          ctx.fillStyle = '#332a21';
          ctx.fillRect(x - 31, y - 18, 4, 18);
          ctx.fillRect(x + 27, y - 18, 4, 18);
          ctx.fillStyle = '#283038';
          ctx.fillRect(x - 24, y - 18, 48, 8);
          ctx.fillStyle = '#7a8794';
          ctx.fillRect(x - 14, y - 15, 6, 2);
          ctx.fillRect(x + 8, y - 15, 6, 2);
          // Center bench vise
          ctx.fillStyle = '#5e6b78';
          ctx.fillRect(x - 2, y - 26, 5, 4);
          // Pegboard centered on back wall
          ctx.fillStyle = '#38404a';
          ctx.fillRect(x - 18, y - 46, 36, 17);
          ctx.fillStyle = '#8896a6';
          ctx.fillRect(x - 12, y - 43, 2, 9);
          ctx.fillRect(x - 4, y - 44, 3, 11);
          ctx.fillRect(x + 5, y - 42, 2, 8);
          ctx.fillRect(x + 11, y - 43, 2, 9);
        } else {
          ctx.fillStyle = '#3d434a';
          ctx.fillRect(x - 17, y - 22, 34, 22);
          ctx.fillStyle = '#4c545e';
          ctx.fillRect(x - 14, y - 44, 28, 16);
          ctx.fillStyle = '#8896a6';
          ctx.fillRect(x - 10, y - 41, 2, 8);
          ctx.fillRect(x - 4, y - 42, 3, 10);
          ctx.fillRect(x + 4, y - 40, 2, 7);
          if (opened) {
            ctx.fillStyle = '#181c22';
            ctx.fillRect(x - 12, y - 16, 24, 5);
          }
        }
        break;
      }
      case 'monitors': {
        ctx.fillStyle = '#323942';
        ctx.fillRect(x - 17, y - 24, 34, 24);
        const on = state.terminalSolved || state.installedParts.length >= 3;
        ctx.fillStyle = state.terminalSolved ? '#123d2b' : on ? '#19453f' : '#162421';
        ctx.fillRect(x - 13, y - 39, 12, 12);
        ctx.fillRect(x + 2, y - 39, 12, 12);
        if (on) {
          const traceX = Math.floor(timeSec * 16) % 10;
          ctx.fillStyle = state.terminalSolved ? '#6ef0aa' : '#68f0d8';
          ctx.fillRect(x - 12, y - 33, 10, 1);
          ctx.fillRect(x - 12 + traceX, y - 36, 2, 5);
          ctx.fillRect(x + 3, y - 33, 10, 1);
          ctx.fillRect(x + 3 + ((traceX + 4) % 10), y - 35, 2, 4);
        } else if (Math.sin(timeSec * 4) > 0) {
          ctx.fillStyle = '#4cb888';
          ctx.fillRect(x - 11, y - 30, 3, 2);
        }
        break;
      }
      case 'hatch_frame': {
        const hatchOpen = state.collectedKeys.includes('attic_crowbar');
        ctx.fillStyle = '#4f3e2d';
        ctx.fillRect(x - 16, y - 95, 32, 6);
        if (hatchOpen) {
          ctx.fillStyle = '#090d12';
          ctx.fillRect(x - 12, y - 95, 24, 5);
          // Hinged trapdoor swung down + folding wooden ladder rails
          ctx.fillStyle = '#5c4734';
          ctx.fillRect(x - 15, y - 90, 6, 18);
          ctx.fillStyle = '#6b533c';
          ctx.fillRect(x - 6, y - 89, 2, 85);
          ctx.fillRect(x + 4, y - 89, 2, 85);
          for (let ry = y - 80; ry < y - 6; ry += 11) {
            ctx.fillRect(x - 4, ry, 8, 2);
          }
        }
        break;
      }
      case 'mannequin': {
        // Feminine dressmaker mannequin on tripod stand; shifts +42px safely inside attic_west
        const mx = state.atmospheric.mannequinMoved ? x + 42 : x;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(mx - 7, y - 2, 14, 2);
        ctx.fillStyle = '#42372c';
        ctx.fillRect(mx - 1, y - 16, 2, 16);
        ctx.fillRect(mx - 5, y - 2, 10, 2);
        // Flared hips, narrow waist & sculpted bust form
        ctx.fillStyle = '#7e6e5c';
        ctx.fillRect(mx - 6, y - 24, 12, 8);
        ctx.fillRect(mx - 4, y - 30, 8, 6);
        ctx.fillRect(mx - 6, y - 39, 12, 9);
        ctx.fillStyle = '#9e8d78';
        ctx.fillRect(mx - 5, y - 37, 4, 4);
        ctx.fillRect(mx + 1, y - 37, 4, 4);
        // Charcoal schematic line & collared neck + oval head
        ctx.fillStyle = '#3c3127';
        ctx.fillRect(mx - 1, y - 40, 2, 24);
        ctx.fillRect(mx - 4, y - 33, 8, 1);
        ctx.fillStyle = '#4f4236';
        ctx.fillRect(mx - 2, y - 43, 4, 3);
        ctx.fillStyle = '#91816e';
        ctx.fillRect(mx - 3, y - 50, 6, 7);
        break;
      }
      case 'toys':
        ctx.fillStyle = '#78403e';
        ctx.fillRect(x - 8, y - 10, 6, 10);
        ctx.fillStyle = '#4d6582';
        ctx.fillRect(x + 2, y - 7, 7, 7);
        break;
      case 'radio_station':
        ctx.fillStyle = '#343c45';
        ctx.fillRect(x - 14, y - 28, 28, 28);
        ctx.fillStyle = '#21272e';
        ctx.fillRect(x - 11, y - 24, 22, 12);
        ctx.fillStyle = '#5e7687';
        ctx.fillRect(x - 10, y - 35, 20, 7);
        ctx.fillStyle = '#18242c';
        ctx.fillRect(x - 7, y - 33, 14, 3);
        ctx.fillStyle = '#8b99a8';
        ctx.fillRect(x + 9, y - 54, 1, 19);
        if (state.installedParts.length >= 2 && Math.sin(timeSec * 6) > 0) {
          ctx.fillStyle = '#7cd4ff';
          ctx.fillRect(x - 6, y - 32, 3, 1);
          ctx.fillStyle = '#e09a4c';
          ctx.fillRect(x + 4, y - 21, 2, 2);
        }
        break;
      case 'boiler': {
        ctx.fillStyle = '#3f3836';
        ctx.fillRect(x - 16, y - 56, 32, 56);
        ctx.fillStyle = '#574e4b';
        ctx.fillRect(x - 14, y - 54, 28, 4);
        ctx.fillStyle = '#252120';
        ctx.fillRect(x - 10, y - 39, 20, 16);
        const glow = state.installedParts.length >= 2 ? '#e85d38' : '#9e4432';
        ctx.fillStyle = glow;
        ctx.fillRect(x - 6, y - 34, 12, 7);
        ctx.fillStyle = '#8a99a8';
        ctx.fillRect(x + 5, y - 48, 6, 6);
        ctx.fillStyle = '#14181d';
        ctx.fillRect(x + 6, y - 47, 4, 4);
        // Steam wisps shifted left so note_11 at center top reads cleanly
        ctx.fillStyle = 'rgba(180, 195, 210, 0.24)';
        const stOff = Math.floor(timeSec * 14) % 18;
        ctx.fillRect(x - 12, y - 59 - stOff, 3, 3);
        ctx.fillRect(x - 14, y - 66 - (stOff >> 1), 2, 2);
        break;
      }
      case 'pipes': {
        ctx.fillStyle = '#414c54';
        ctx.fillRect(x - 16, y - 78, 32, 4);
        ctx.fillRect(x - 4, y - 78, 4, 78);
        const dropPhase = (timeSec * 45) % 74;
        ctx.fillStyle = '#6da6cf';
        if (dropPhase < 70) {
          ctx.fillRect(x - 3, y - 74 + Math.floor(dropPhase), 2, 3);
        } else {
          ctx.fillRect(x - 5, y - 1, 6, 1);
        }
        break;
      }
      case 'breaker_panel':
        ctx.fillStyle = '#353e48';
        ctx.fillRect(x - 10, y - 44, 20, 26);
        ctx.fillStyle = '#1b2026';
        ctx.fillRect(x - 7, y - 40, 14, 16);
        ctx.fillStyle = state.breakerFixed ? '#5bd98b' : '#d64545';
        ctx.fillRect(x - 2, y - 36, 4, 4);
        break;
      case 'vent_grate':
        ctx.fillStyle = '#293038';
        ctx.fillRect(x - 11, y - 24, 22, 18);
        ctx.fillStyle = '#0d1014';
        ctx.fillRect(x - 8, y - 21, 16, 3);
        ctx.fillRect(x - 8, y - 15, 16, 3);
        if (!state.breakerFixed && Math.sin(timeSec * 19) > 0.72) {
          ctx.fillStyle = '#7cd4ff';
          ctx.fillRect(x - 6, y - 19, 4, 1);
          ctx.fillRect(x + 2, y - 14, 3, 2);
        }
        break;
    }
  }

  private drawPartSprite(
    ctx: CanvasRenderingContext2D,
    partId: PartId,
    x: number,
    y: number,
    timeSec: number
  ): void {
    const px = Math.round(safeNum(x, 0));
    const py = Math.round(safeNum(y, 0));
    const glint = Math.sin(timeSec * 4) > 0.45;
    // Grounded contact shadow on surface — no dark square backing box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.fillRect(px - 6, py - 1, 12, 2);

    switch (partId) {
      case 'left_arm':
      case 'right_arm':
        // Slender feminine robotic arm resting horizontally: shoulder cap, forearm, elbow actuator, fingers
        ctx.fillStyle = '#4e5d6e';
        ctx.fillRect(px - 8, py - 6, 3, 3);
        ctx.fillStyle = '#dfe7f0';
        ctx.fillRect(px - 6, py - 6, 5, 3);
        ctx.fillStyle = '#536273';
        ctx.fillRect(px - 1, py - 6, 2, 3);
        ctx.fillStyle = '#d89b4e';
        ctx.fillRect(px - 1, py - 5, 1, 1);
        ctx.fillStyle = '#eff5fb';
        ctx.fillRect(px + 1, py - 6, 5, 2);
        ctx.fillStyle = '#bccad8';
        ctx.fillRect(px + 6, py - 6, 2, 3);
        ctx.fillRect(px + 8, py - 7, 2, 1);
        ctx.fillRect(px + 8, py - 5, 2, 1);
        ctx.fillRect(px + 8, py - 3, 1, 1);
        break;
      case 'left_leg':
      case 'right_leg':
        // Sculpted feminine cybernetic leg resting cleanly on surface: thigh, knee actuator, calf & foot
        ctx.fillStyle = '#485563';
        ctx.fillRect(px - 7, py - 8, 2, 3);
        ctx.fillStyle = '#e5edf5';
        ctx.fillRect(px - 6, py - 9, 4, 4);
        ctx.fillStyle = '#536273';
        ctx.fillRect(px - 2, py - 7, 3, 3);
        ctx.fillStyle = glint ? '#7ce2ff' : '#4faed4';
        ctx.fillRect(px - 1, py - 6, 1, 1);
        ctx.fillStyle = '#cfdbe8';
        ctx.fillRect(px + 1, py - 6, 4, 4);
        ctx.fillStyle = '#eff5fb';
        ctx.fillRect(px + 4, py - 4, 3, 3);
        ctx.fillStyle = '#8b99a8';
        ctx.fillRect(px + 6, py - 2, 2, 1);
        break;
      case 'chest_panel':
        // Contoured female porcelain-titanium cuirass with bust shaping, waist taper & core aperture
        ctx.fillStyle = '#d4dee8';
        ctx.fillRect(px - 6, py - 9, 12, 4);
        ctx.fillStyle = '#eef4fa';
        ctx.fillRect(px - 5, py - 10, 10, 2);
        ctx.fillRect(px - 5, py - 5, 10, 2);
        ctx.fillRect(px - 4, py - 3, 8, 2);
        ctx.fillStyle = '#9aa9b8';
        ctx.fillRect(px - 5, py - 8, 4, 2);
        ctx.fillRect(px + 1, py - 8, 4, 2);
        ctx.fillStyle = '#14202b';
        ctx.fillRect(px - 2, py - 6, 4, 3);
        ctx.fillStyle = glint ? '#8be8ff' : '#50bce0';
        ctx.fillRect(px - 1, py - 5, 2, 2);
        break;
      case 'head':
        // Rounded feminine cranium shell with layered ash-blonde hair locks
        ctx.fillStyle = '#cfb87c';
        ctx.fillRect(px - 6, py - 9, 12, 8);
        ctx.fillStyle = '#e5d49a';
        ctx.fillRect(px - 5, py - 11, 10, 5);
        ctx.fillRect(px - 6, py - 6, 2, 5);
        ctx.fillRect(px + 4, py - 6, 2, 5);
        ctx.fillStyle = '#f5eac1';
        ctx.fillRect(px - 4, py - 11, 8, 2);
        ctx.fillStyle = '#9aa9b8';
        ctx.fillRect(px - 3, py - 7, 6, 5);
        ctx.fillStyle = '#141c24';
        ctx.fillRect(px - 2, py - 5, 2, 1);
        ctx.fillRect(px + 1, py - 5, 2, 1);
        break;
      case 'face_panel':
        // Delicate oval porcelain female face mask with arched brows & rose lips
        ctx.fillStyle = '#dce5ef';
        ctx.fillRect(px - 4, py - 10, 8, 7);
        ctx.fillStyle = '#f4f7fb';
        ctx.fillRect(px - 3, py - 11, 6, 9);
        ctx.fillRect(px - 2, py - 2, 4, 1);
        ctx.fillStyle = '#1b222c';
        ctx.fillRect(px - 3, py - 7, 2, 1);
        ctx.fillRect(px + 1, py - 7, 2, 1);
        ctx.fillStyle = '#b0646c';
        ctx.fillRect(px - 1, py - 4, 2, 1);
        break;
      case 'power_core':
        // Heart-like plasma core chamber with copper coils & dual pulse
        ctx.fillStyle = '#4e5b69';
        ctx.fillRect(px - 5, py - 9, 10, 7);
        ctx.fillStyle = '#6f7e8f';
        ctx.fillRect(px - 4, py - 10, 8, 1);
        ctx.fillStyle = '#d99e4c';
        ctx.fillRect(px - 4, py - 11, 2, 2);
        ctx.fillRect(px + 2, py - 11, 2, 2);
        ctx.fillStyle = '#0e1822';
        ctx.fillRect(px - 3, py - 8, 6, 5);
        ctx.fillStyle = Math.sin(timeSec * 8) > 0 ? '#78e6ff' : '#40b5de';
        ctx.fillRect(px - 2, py - 7, 4, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 1, py - 6, 1, 1);
        break;
    }
  }

  private drawRobotWorkbench(ctx: CanvasRenderingContext2D, state: GameState, timeSec: number): void {
    const x = 1020;
    const y = HOUSE_FLOOR_Y[1];
    const installed = state.installedParts;
    const robotState = getRobotState(installed.length, state.finale.active, state.finale.phase);
    const isStanding =
      installed.length >= 8 &&
      (!state.finale.active || state.finale.phase !== 'rising' || state.finale.timer > 1.1);

    // Wall cable conduits & overhead surgical dome light fixture
    ctx.fillStyle = '#283038';
    ctx.fillRect(x - 30, y - 91, 2, 72);
    ctx.fillRect(x + 28, y - 91, 2, 72);
    ctx.fillStyle = '#323c47';
    ctx.fillRect(x - 1, y - 91, 2, 10);
    ctx.fillStyle = '#4c5a69';
    ctx.fillRect(x - 10, y - 81, 20, 4);
    ctx.fillStyle = installed.length >= 5 ? '#ff7070' : installed.length >= 1 ? '#8fd8ff' : '#3d4854';
    ctx.fillRect(x - 7, y - 77, 14, 2);

    // Wall diagnostic CRT telemetry monitor above the workbench (live ECG pulse)
    ctx.fillStyle = '#2c343d';
    ctx.fillRect(x + 20, y - 62, 22, 17);
    ctx.fillStyle = '#0e171e';
    ctx.fillRect(x + 22, y - 60, 18, 12);
    const waveSpeed = installed.length >= 5 ? 24 : 14;
    const waveX = Math.floor(timeSec * waveSpeed) % 14;
    ctx.fillStyle = installed.length >= 5 ? '#ff5959' : '#58d4ff';
    ctx.fillRect(x + 23, y - 54, 15, 1);
    ctx.fillRect(x + 23 + waveX, y - 58, 2, 7);
    ctx.fillRect(x + 23 + ((waveX + 12) % 14), y - 55, 2, 3);

    // Coiled floor cable conduits & bench legs
    ctx.fillStyle = '#1d242b';
    ctx.fillRect(x - 12, y - 14, 2, 12);
    ctx.fillRect(x + 10, y - 14, 2, 12);
    ctx.fillRect(x - 14, y - 2, 28, 2);

    // Heavy metal workbench recessed cleanly behind Echo-4 when she stands in front
    ctx.fillStyle = isStanding ? '#2a313a' : '#3b434d';
    ctx.fillRect(x - 36, y - 19, 72, 5);
    ctx.fillStyle = isStanding ? '#424d59' : '#5c6978';
    ctx.fillRect(x - 36, y - 19, 72, 1);
    ctx.fillStyle = isStanding ? '#1f252c' : '#282e36';
    ctx.fillRect(x - 32, y - 14, 5, 14);
    ctx.fillRect(x + 27, y - 14, 5, 14);
    ctx.fillStyle = '#25394d';
    ctx.fillRect(x - 16, y - 14, 2, 8);
    ctx.fillStyle = '#5c262b';
    ctx.fillRect(x - 4, y - 14, 1, 10);
    ctx.fillStyle = '#3a4a59';
    ctx.fillRect(x + 14, y - 14, 2, 7);

    // Surgical worklight cone above the workbench
    const coneAlpha = Math.min(0.16, 0.05 + installed.length * 0.015);
    ctx.fillStyle =
      installed.length >= 5
        ? `rgba(255, 85, 85, ${coneAlpha})`
        : `rgba(120, 200, 255, ${coneAlpha})`;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 75);
    ctx.lineTo(x - 38, y - 19);
    ctx.lineTo(x + 38, y - 19);
    ctx.lineTo(x + 8, y - 75);
    ctx.closePath();
    ctx.fill();

    const eyeColor =
      robotState === 'red_mode'
        ? '#ff2a2a'
        : robotState === 'almost' && Math.sin(timeSec * 8) > 0.78
        ? '#c75bff'
        : '#5cd4ff';

    if (!isStanding) {
      // Lying feminine android silhouette on surgical cradle
      const rx = x - 14;
      const ry = y - 28;

      // Metal cradle & padded velvet headrest
      ctx.fillStyle = '#2b333d';
      ctx.fillRect(rx - 5, ry + 7, 38, 2);
      ctx.fillStyle = '#36404a';
      ctx.fillRect(rx + 21, ry + 2, 13, 7);

      // Curved feminine pelvis & slim waist hinge
      ctx.fillStyle = '#738291';
      ctx.fillRect(rx - 3, ry + 1, 5, 8);
      ctx.fillStyle = '#3a4552';
      ctx.fillRect(rx + 2, ry + 2, 3, 6); // narrow waist
      ctx.fillStyle = '#242d36';
      ctx.fillRect(rx - 4, ry + 2, 2, 2);
      ctx.fillRect(rx - 4, ry + 6, 2, 2);

      // Torso frame / contoured female cuirass or exposed skeletal ribs + glowing chest core
      const chestRise = installed.length >= 4 && Math.sin(timeSec * 2.2) > 0.3 ? -1 : 0;
      if (!installed.includes('chest_panel')) {
        ctx.fillStyle = '#3f4954';
        ctx.fillRect(rx + 5, ry + chestRise, 14, 9);
        ctx.fillStyle = '#1b2229';
        ctx.fillRect(rx + 6, ry + 1 + chestRise, 12, 7);
        ctx.fillStyle = '#808fa0';
        ctx.fillRect(rx + 7, ry + 1 + chestRise, 2, 7);
        ctx.fillRect(rx + 11, ry + 1 + chestRise, 2, 7);
        ctx.fillRect(rx + 15, ry + 1 + chestRise, 2, 7);
        ctx.fillStyle = '#3f769c';
        ctx.fillRect(rx + 6, ry + 4 + chestRise, 12, 1);
      } else {
        // Porcelain sculpted female bust & collarbone armor
        ctx.fillStyle = '#dfe6ee';
        ctx.fillRect(rx + 5, ry + 1 + chestRise, 14, 7);
        ctx.fillStyle = '#f2f6fa';
        ctx.fillRect(rx + 10, ry - 1 + chestRise, 6, 3);
        ctx.fillRect(rx + 10, ry + 7 + chestRise, 6, 2);
        ctx.fillStyle = '#8b99a8';
        ctx.fillRect(rx + 16, ry + 2 + chestRise, 2, 5);
      }

      if (installed.includes('power_core')) {
        const isRed = installed.length >= 6;
        ctx.fillStyle = isRed ? 'rgba(255, 80, 80, 0.3)' : 'rgba(92, 212, 255, 0.28)';
        ctx.fillRect(rx + 8, ry + 1 + chestRise, 8, 7);
        ctx.fillStyle = isRed ? '#ff6464' : '#6be0ff';
        ctx.fillRect(rx + 10, ry + 3 + chestRise, 4, 3);
      }

      // Shapely tapered feminine legs with knee joints & arched feet
      if (installed.includes('left_leg')) {
        ctx.fillStyle = '#d3dce6';
        ctx.fillRect(rx - 12, ry, 9, 4);
        ctx.fillStyle = '#758291';
        ctx.fillRect(rx - 14, ry + 1, 2, 3);
        ctx.fillStyle = '#c4ced9';
        ctx.fillRect(rx - 20, ry + 1, 6, 3);
        ctx.fillStyle = '#e8eff7';
        ctx.fillRect(rx - 22, ry - 1, 2, 4);
      }
      if (installed.includes('right_leg')) {
        ctx.fillStyle = '#aab6c4';
        ctx.fillRect(rx - 12, ry + 5, 9, 4);
        ctx.fillStyle = '#657180';
        ctx.fillRect(rx - 14, ry + 5, 2, 3);
        ctx.fillStyle = '#9aa6b4';
        ctx.fillRect(rx - 20, ry + 5, 6, 3);
        ctx.fillStyle = '#cfd9e3';
        ctx.fillRect(rx - 22, ry + 5, 2, 4);
      }

      // Slender arms with wrist joints & delicate twitching fingers
      const handTwitch = installed.length >= 3 && Math.sin(timeSec * 9.5) > 0.88 ? -1 : 0;
      if (installed.includes('left_arm')) {
        ctx.fillStyle = '#dde6f0';
        ctx.fillRect(rx + 5, ry - 3, 13, 2);
        ctx.fillStyle = '#7b8a99';
        ctx.fillRect(rx + 11, ry - 3, 2, 2);
        ctx.fillStyle = '#eef4fa';
        ctx.fillRect(rx + 2, ry - 4 + handTwitch, 3, 2);
      }
      if (installed.includes('right_arm')) {
        ctx.fillStyle = '#aab6c4';
        ctx.fillRect(rx + 5, ry + 9, 13, 2);
        ctx.fillStyle = '#697585';
        ctx.fillRect(rx + 11, ry + 9, 2, 2);
        ctx.fillStyle = '#cfd9e3';
        ctx.fillRect(rx + 2, ry + 9 - handTwitch, 3, 2);
      }

      // Slender neck tendons & collar ring
      ctx.fillStyle = '#313c4a';
      ctx.fillRect(rx + 19, ry + 1, 4, 6);
      ctx.fillStyle = '#738291';
      ctx.fillRect(rx + 20, ry + 2, 2, 4);
      ctx.fillStyle = '#a83c3c';
      ctx.fillRect(rx + 20, ry + 4, 2, 1);

      // Sculpted oval feminine head with flowing tapered ash-blonde locks on headrest
      const headTilt = installed.length >= 4 ? Math.round(Math.sin(timeSec * 2.4)) : 0;
      const twitch = installed.length >= 2 && Math.sin(timeSec * 11) > 0.94 ? 1 : 0;
      const hy = ry - 3 + headTilt - twitch;
      if (installed.includes('head')) {
        ctx.fillStyle = '#cbb87d';
        ctx.fillRect(rx + 16, hy + 2, 7, 6);
        ctx.fillRect(rx + 22, hy, 10, 9);
        ctx.fillStyle = '#e5d49a';
        ctx.fillRect(rx + 23, hy - 1, 8, 3);
        ctx.fillRect(rx + 18, hy + 1, 5, 6);
        ctx.fillStyle = '#f5eac1';
        ctx.fillRect(rx + 25, hy - 1, 5, 2);
        ctx.fillStyle = installed.includes('face_panel') ? '#f4f7fa' : '#4a5562';
        ctx.fillRect(rx + 23, hy + 1, 6, 7);
        if (installed.includes('face_panel')) {
          ctx.fillStyle = '#b0646c';
          ctx.fillRect(rx + 24, hy + 6, 2, 1);
        }
      } else {
        ctx.fillStyle = '#738190';
        ctx.fillRect(rx + 22, hy + 1, 8, 7);
        ctx.fillStyle = '#38414d';
        ctx.fillRect(rx + 24, hy + 2, 5, 5);
      }

      if (installed.length >= 1 && installed.length < 8 && Math.sin(timeSec * 23) > 0.85) {
        ctx.fillStyle = installed.length >= 5 ? '#ff7b7b' : '#7cd4ff';
        ctx.fillRect(rx + 15, ry - 4, 2, 2);
        ctx.fillRect(rx + 18, ry + 8, 2, 1);
      }

      const lookLeftShift =
        state.player.zone === 'house' && state.player.floor === 1 && state.player.x < 1015 ? -1 : 0;
      if (Math.sin(timeSec * 4) > -0.5) {
        ctx.fillStyle = robotState === 'red_mode' ? 'rgba(255, 50, 50, 0.35)' : 'rgba(92, 212, 255, 0.28)';
        ctx.fillRect(rx + 23, hy + 2, 4, 4);
        ctx.fillStyle = eyeColor;
        ctx.fillRect(rx + 24 + lookLeftShift, hy + 3, 2, 2);
      }
    } else {
      // Standing Echo-4: grounded on foreground floor plane clearly in front of the workbench
      const rx = Math.round(x - state.finale.robotOffsetX);
      const fy = y + 2; // foreground step slightly in front of bench plane
      const jitter = state.finale.active && Math.sin(timeSec * 36) > 0.82 ? 1 : 0;

      // Ground contact shadow beneath feet
      ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      ctx.fillRect(rx - 7, fy - 1, 14, 2);

      // Flowing ash-blonde hair draping smoothly behind shoulders & neck
      ctx.fillStyle = '#bfa96c';
      ctx.fillRect(rx - 6 + jitter, fy - 39, 12, 11);
      ctx.fillRect(rx - 5 + jitter, fy - 28, 10, 4);

      // Slender tapered female legs (thighs, knees, sculpted calves & delicate feet)
      ctx.fillStyle = '#d3dce6';
      ctx.fillRect(rx - 4, fy - 20, 3, 9);
      ctx.fillRect(rx + 1, fy - 20, 3, 9);
      ctx.fillStyle = '#5c6978';
      ctx.fillRect(rx - 4, fy - 11, 3, 2);
      ctx.fillRect(rx + 1, fy - 11, 3, 2);
      ctx.fillStyle = '#bcc8d6';
      ctx.fillRect(rx - 3, fy - 9, 2, 7);
      ctx.fillRect(rx + 1, fy - 9, 2, 7);
      ctx.fillStyle = '#eef4fa';
      ctx.fillRect(rx - 4, fy - 2, 3, 2);
      ctx.fillRect(rx + 1, fy - 2, 3, 2);

      // Contoured female pelvis, narrow hourglass waist & sculpted porcelain bust
      ctx.fillStyle = '#cfd9e3';
      ctx.fillRect(rx - 5 + jitter, fy - 23, 10, 4);
      ctx.fillStyle = '#3a4654';
      ctx.fillRect(rx - 3 + jitter, fy - 26, 6, 3); // slender waist
      ctx.fillStyle = '#ebf1f7';
      ctx.fillRect(rx - 5 + jitter, fy - 35, 10, 9);
      ctx.fillStyle = '#cfd9e3';
      ctx.fillRect(rx - 4 + jitter, fy - 36, 8, 1); // clavicle line
      ctx.fillStyle = '#9aa8b8';
      ctx.fillRect(rx - 5 + jitter, fy - 31, 3, 2);
      ctx.fillRect(rx + 2 + jitter, fy - 31, 3, 2);

      // Glowing chest core
      ctx.fillStyle = robotState === 'red_mode' ? 'rgba(255, 42, 42, 0.28)' : 'rgba(92, 212, 255, 0.26)';
      ctx.fillRect(rx - 3 + jitter, fy - 32, 6, 6);
      ctx.fillStyle = eyeColor;
      ctx.fillRect(rx - 1 + jitter, fy - 30, 2, 2);

      // Slim neck & collar shadow
      ctx.fillStyle = '#5c6978';
      ctx.fillRect(rx - 1 + jitter, fy - 39, 2, 3);

      // Slender reaching arms with articulated elbow & tapered hands
      const armReach = state.finale.phase === 'approach' || state.finale.phase === 'fade' ? -9 : 0;
      ctx.fillStyle = '#d8e1eb';
      if (armReach !== 0) {
        ctx.fillRect(rx - 6 + armReach, fy - 34, 8, 2);
        ctx.fillRect(rx + 2 + armReach, fy - 34, 6, 2);
        ctx.fillStyle = '#eef4fa';
        ctx.fillRect(rx - 9 + armReach, fy - 35, 3, 3);
      } else {
        ctx.fillRect(rx - 7, fy - 34, 2, 13);
        ctx.fillRect(rx + 5, fy - 34, 2, 13);
        ctx.fillStyle = '#738291';
        ctx.fillRect(rx - 7, fy - 28, 2, 2);
        ctx.fillRect(rx + 5, fy - 28, 2, 2);
        ctx.fillStyle = '#eef4fa';
        ctx.fillRect(rx - 7, fy - 21, 2, 2);
        ctx.fillRect(rx + 5, fy - 21, 2, 2);
      }

      // Rounded feminine crown, parted ash-blonde locks framing oval porcelain face
      ctx.fillStyle = '#e5d49a';
      ctx.fillRect(rx - 4 + jitter, fy - 48, 8, 2); // rounded crown top
      ctx.fillRect(rx - 5 + jitter, fy - 46, 10, 6);
      ctx.fillRect(rx - 5 + jitter, fy - 40, 2, 9); // cascading side locks
      ctx.fillRect(rx + 3 + jitter, fy - 40, 2, 9);
      ctx.fillStyle = '#f5eac1';
      ctx.fillRect(rx - 3 + jitter, fy - 47, 6, 2); // hair sheen
      ctx.fillStyle = '#f2f6fa';
      ctx.fillRect(rx - 3 + jitter, fy - 44, 6, 6); // oval upper face
      ctx.fillRect(rx - 2 + jitter, fy - 38, 4, 1); // tapered chin
      ctx.fillStyle = robotState === 'red_mode' ? 'rgba(255, 42, 42, 0.34)' : 'rgba(92, 212, 255, 0.3)';
      ctx.fillRect(rx - 3 + jitter, fy - 43, 6, 3);
      ctx.fillStyle = eyeColor;
      ctx.fillRect(rx - 2 + jitter, fy - 42, 2, 1);
      ctx.fillRect(rx + 1 + jitter, fy - 42, 2, 1);
      ctx.fillStyle = '#b0646c';
      ctx.fillRect(rx - 1 + jitter, fy - 39, 2, 1);

      if (state.finale.active && state.finale.phase === 'rising' && Math.sin(timeSec * 27) > 0.4) {
        ctx.fillStyle = '#ff4b4b';
        ctx.fillRect(rx - 8, fy - 29, 2, 2);
        ctx.fillRect(rx + 7, fy - 39, 2, 2);
      }
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, timeSec: number): void {
    const p = state.player;
    const px = Math.round(safeNum(p.x, 120));
    const py = Math.round(safeNum(p.y, FOREST_GROUND_Y));
    const vx = safeNum(p.vx, 0);
    const walkCycle = safeNum(p.walkCycle, 0);
    const facing = p.facing === -1 ? -1 : 1;
    const isMoving = !p.isHiding && Math.abs(vx) > 6;
    const strideFreq = walkCycle * 1.45;
    const swing = isMoving ? Math.sin(strideFreq) : 0;
    const liftFront = isMoving ? Math.max(0, Math.round(Math.cos(strideFreq) * 2)) : 0;
    const liftBack = isMoving ? Math.max(0, Math.round(-Math.cos(strideFreq) * 2)) : 0;

    const strideAmp = p.isRunning ? 5 : 3;
    const frontLegX = Math.round(swing * strideAmp);
    const backLegX = Math.round(-swing * strideAmp);
    const backArmSwing = isMoving ? Math.round(swing * 3) : 0;

    const crouchDrop = p.isHiding ? 10 : p.isCrouching ? 7 : 0;
    const idleBreath = !isMoving && Math.sin(timeSec * 2.5) > 0.35 ? 1 : 0;
    const bob = isMoving ? Math.round(Math.abs(Math.cos(strideFreq)) * (p.isRunning ? 2 : 1)) : idleBreath;
    const lean = p.isHiding ? 1 : p.startledTimer > 0 ? -2 : p.isRunning ? 2 : p.isCrouching ? 1 : p.exhausted ? 1 : 0;
    const coatTrail = isMoving ? -Math.round(Math.min(2, Math.abs(vx) / 45)) : 0;

    ctx.save();
    try {
      if (p.isHiding) {
        ctx.globalAlpha = 0.42;
      }
      ctx.translate(px, py);
      ctx.scale(facing, 1);

      // Subtle ground contact shadow + running dust/splash puff
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-6, -1, 13, 2);
      if (isMoving && Math.abs(swing) > 0.85) {
        ctx.fillStyle = state.player.zone === 'forest' ? 'rgba(165, 200, 230, 0.38)' : 'rgba(180, 175, 165, 0.25)';
        ctx.fillRect(-7, -2, 2, 1);
        ctx.fillRect(-9, -4, 1, 1);
      }

      // Back arm swinging opposite to stride
      ctx.fillStyle = '#1f2836';
      ctx.fillRect(-2 + lean + backArmSwing, -22 + crouchDrop + bob, 3, Math.max(4, 9 - Math.floor(crouchDrop * 0.4)));

      // Back leg (thigh + shin + boot with foot lift)
      ctx.fillStyle = '#19222e';
      ctx.fillRect(-2 + Math.round(backLegX * 0.5), -13 + crouchDrop, 3, Math.max(2, 6 - Math.floor(crouchDrop * 0.5)));
      ctx.fillRect(-2 + backLegX, -8 + Math.floor(crouchDrop * 0.4) - liftBack, 3, Math.max(2, 6 - Math.floor(crouchDrop * 0.3)));
      ctx.fillStyle = '#0e1116';
      ctx.fillRect(-2 + backLegX, -3 - liftBack, 5, 3);

      // Backpack with leather flap & brass clasp
      ctx.fillStyle = '#382c20';
      ctx.fillRect(-7 + lean + coatTrail, -24 + crouchDrop + bob, 4, 10);
      ctx.fillStyle = '#524130';
      ctx.fillRect(-7 + lean + coatTrail, -24 + crouchDrop + bob, 4, 4);
      ctx.fillStyle = '#c49f52';
      ctx.fillRect(-6 + lean + coatTrail, -20 + crouchDrop + bob, 1, 1);

      // Front leg (thigh + knee bend when crouched/hiding + boot)
      const kneeShift = p.isCrouching || p.isHiding ? 2 : 0;
      ctx.fillStyle = '#253142';
      ctx.fillRect(0 + Math.round(frontLegX * 0.5), -13 + crouchDrop, 3, Math.max(2, 6 - Math.floor(crouchDrop * 0.5)));
      ctx.fillRect(0 + frontLegX + kneeShift, -8 + Math.floor(crouchDrop * 0.4) - liftFront, 3, Math.max(2, 6 - Math.floor(crouchDrop * 0.3)));
      ctx.fillStyle = '#14181f';
      ctx.fillRect(0 + frontLegX + kneeShift, -3 - liftFront, 5, 3);
      ctx.fillStyle = '#2b3440';
      ctx.fillRect(1 + frontLegX + kneeShift, -3 - liftFront, 3, 1);

      // Jacket torso, hood silhouette, raised collar, dynamic coat hem & scarf
      ctx.fillStyle = '#273446';
      ctx.fillRect(-4 + lean, -25 + crouchDrop + bob, 8, 12);
      ctx.fillStyle = '#202b3a';
      ctx.fillRect(-5 + lean + coatTrail, -15 + crouchDrop + bob, 3, 4);
      ctx.fillStyle = '#3e5066';
      ctx.fillRect(-1 + lean, -24 + crouchDrop + bob, 4, 10);
      // Dropped rain hood behind shoulders + wool scarf
      ctx.fillStyle = '#1e2836';
      ctx.fillRect(-5 + lean, -28 + crouchDrop + bob, 4, 4);
      ctx.fillStyle = '#6e3a38';
      ctx.fillRect(-3 + lean, -26 + crouchDrop + bob, 6, 2);
      ctx.fillRect(-6 + lean + coatTrail, -24 + crouchDrop + bob, 3, 2);
      ctx.fillStyle = '#5d6e82';
      ctx.fillRect(0 + lean, -26 + crouchDrop + bob, 3, 2);

      // Head, side-profile nose/chin, layered hair & blinking eye
      ctx.fillStyle = '#dbb89c';
      ctx.fillRect(-3 + lean, -33 + crouchDrop + bob, 6, 7);
      ctx.fillRect(3 + lean, -30 + crouchDrop + bob, 1, 2);
      ctx.fillStyle = '#b89176';
      ctx.fillRect(-2 + lean, -27 + crouchDrop + bob, 4, 1);
      ctx.fillStyle = '#3d281c';
      ctx.fillRect(-4 + lean, -35 + crouchDrop + bob, 8, 4);
      ctx.fillRect(-4 + lean, -32 + crouchDrop + bob, 2, 4);
      ctx.fillStyle = '#593d2b';
      ctx.fillRect(-2 + lean, -35 + crouchDrop + bob, 5, 2);
      if (timeSec % 4.6 > 0.14) {
        ctx.fillStyle = '#13171d';
        ctx.fillRect(1 + lean, -31 + crouchDrop + bob, 1, 2);
      }

      if (!p.isHiding && (state.player.zone === 'forest' || state.player.floor === 0)) {
        const breathPhase = timeSec % 3.2;
        if (breathPhase < 0.9) {
          const bx = 5 + lean + Math.round(breathPhase * 7);
          const by = -29 + crouchDrop + bob - Math.round(breathPhase * 3);
          ctx.fillStyle = `rgba(210, 230, 248, ${(1 - breathPhase / 0.9) * 0.35})`;
          ctx.fillRect(bx, by, 3, 2);
        }
      }

      // Front arm: tucked inward when hiding, or extended smoothly toward flashlight/interactable
      if (p.isHiding) {
        ctx.fillStyle = '#334254';
        ctx.fillRect(-1 + lean, -22 + crouchDrop + bob, 5, 4);
        ctx.fillStyle = '#dbb89c';
        ctx.fillRect(3 + lean, -20 + crouchDrop + bob, 2, 2);
      } else {
        const reach = p.interactAnimTimer > 0 ? Math.round(Math.sin((p.interactAnimTimer / 0.35) * Math.PI) * 6) : 0;
        const armAimBob = isMoving && !p.isCrouching ? Math.round(Math.sin(strideFreq)) : 0;
        const armY = (p.startledTimer > 0 ? -25 : -22) + armAimBob;
        ctx.fillStyle = '#334254';
        ctx.fillRect(0 + lean, armY + crouchDrop + bob, 7 + reach, 3);
        ctx.fillStyle = '#485c73';
        ctx.fillRect(1 + lean, armY + crouchDrop + bob, 5 + reach, 1);
        ctx.fillStyle = '#dbb89c';
        ctx.fillRect(7 + lean + reach, armY + crouchDrop + bob, 2, 2);
        if (p.interactAnimTimer > 0) {
          ctx.fillStyle = 'rgba(170, 230, 255, 0.85)';
          ctx.fillRect(10 + lean + reach, armY + crouchDrop + bob - 1, 2, 3);
        }
        if (p.hasFlashlight && p.flashlightOn) {
          ctx.fillStyle = '#8b99a8';
          ctx.fillRect(7 + lean + reach, armY + crouchDrop + bob, 4, 2);
          const lensAlpha = Math.sin(timeSec * 31) > 0.96 ? 0.35 : 0.94;
          ctx.fillStyle = `rgba(255, 240, 190, ${lensAlpha})`;
          ctx.fillRect(11 + lean + reach, armY + crouchDrop + bob, 2, 2);
        }
      }
    } finally {
      ctx.restore();
    }
  }

  private drawPixelCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    headlightsOn: boolean,
    trunkOpen: boolean,
    interiorDriver: boolean,
    sputtering: boolean,
    timeSec = 0,
    distance = 0
  ): void {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 4, y + 36, 90, 4);

    // Sedan body + subtle fender arch cutouts + door seam
    ctx.fillStyle = '#425268';
    ctx.fillRect(x, y + 14, 96, 18);
    ctx.fillStyle = '#576b87';
    ctx.fillRect(x + 2, y + 15, 92, 4);
    ctx.fillStyle = '#536782';
    ctx.fillRect(x + 20, y + 2, 48, 13);
    ctx.fillStyle = '#334052';
    ctx.fillRect(x + 43, y + 16, 1, 14);
    ctx.fillStyle = '#8998ab';
    ctx.fillRect(x + 46, y + 20, 3, 1);

    // Windows + diagonal night sky reflection & side mirror
    ctx.fillStyle = '#182430';
    ctx.fillRect(x + 24, y + 4, 18, 9);
    ctx.fillRect(x + 45, y + 4, 19, 9);
    ctx.fillStyle = 'rgba(130, 172, 212, 0.25)';
    ctx.fillRect(x + 27, y + 5, 2, 6);
    ctx.fillRect(x + 58, y + 5, 2, 7);
    ctx.fillStyle = '#2d3745';
    ctx.fillRect(x + 65, y + 11, 4, 3);
    if (interiorDriver) {
      ctx.fillStyle = '#0d1218';
      ctx.fillRect(x + 50, y + 6, 6, 7);
    }
    if (trunkOpen) {
      ctx.fillStyle = '#536782';
      ctx.fillRect(x - 2, y + 4, 16, 4);
    }

    // Chrome bumpers & tail light bloom
    ctx.fillStyle = '#7e8c9c';
    ctx.fillRect(x - 2, y + 25, 6, 3);
    ctx.fillRect(x + 93, y + 25, 5, 3);
    if (headlightsOn) {
      ctx.fillStyle = 'rgba(215, 58, 58, 0.28)';
      ctx.fillRect(x - 4, y + 16, 6, 8);
    }
    ctx.fillStyle = headlightsOn ? '#b53a3a' : '#4a2323';
    ctx.fillRect(x, y + 18, 3, 4);

    // Wheel wells & animated spinning hub spokes
    ctx.fillStyle = '#090c10';
    ctx.fillRect(x + 12, y + 24, 18, 8);
    ctx.fillRect(x + 66, y + 24, 18, 8);
    ctx.fillStyle = '#101318';
    ctx.fillRect(x + 14, y + 26, 14, 12);
    ctx.fillRect(x + 68, y + 26, 14, 12);
    ctx.fillStyle = '#6c7987';
    ctx.fillRect(x + 18, y + 30, 6, 5);
    ctx.fillRect(x + 72, y + 30, 6, 5);
    if (distance > 0) {
      const spoke = Math.floor(distance * 180) % 2;
      ctx.fillStyle = '#2b333d';
      ctx.fillRect(x + 20 + spoke, y + 30, 1, 5);
      ctx.fillRect(x + 74 + spoke, y + 30, 1, 5);
    }

    // Headlight bulb
    ctx.fillStyle = headlightsOn ? '#fff2b8' : '#3a4047';
    ctx.fillRect(x + 93, y + 18, 4, 5);

    if (sputtering) {
      const puff = Math.floor(timeSec * 10) % 10;
      ctx.fillStyle = 'rgba(170, 185, 200, 0.28)';
      ctx.fillRect(x + 82, y + 8 - Math.floor(puff * 0.6), 8, 5);
      ctx.fillRect(x + 76 - Math.floor(puff * 0.4), y + 2 - puff, 6, 4);
    }
  }

  private drawPine(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    height: number,
    color: string,
    highlight?: string,
    swayOffset = 0
  ): void {
    const trunkH = Math.round(height * 0.24);
    ctx.fillStyle = '#181410';
    ctx.fillRect(x - 2, groundY - trunkH, 4, trunkH);
    ctx.fillRect(x - 4, groundY - 2, 8, 2);

    // Stepped pixel-art evergreen canopy tiers (4 layered jagged boughs)
    for (let t = 0; t < 4; t++) {
      const tierTop = groundY - height + Math.round(t * height * 0.17);
      const tierH = Math.round(height * 0.26);
      const maxHalf = 7 + t * 4;
      const rows = Math.max(4, Math.floor(tierH / 2));
      const tierSway = t <= 1 ? Math.round(swayOffset) : 0;

      for (let r = 0; r < rows; r++) {
        const half = Math.max(1, Math.round((r / rows) * maxHalf));
        const ry = tierTop + r * 2;
        ctx.fillStyle = color;
        ctx.fillRect(x - half + tierSway, ry, half * 2, 2);
        // Subtle jagged branch overhang pixels at tier bottom
        if (r === rows - 1 && maxHalf >= 9) {
          ctx.fillRect(x - half - 1 + tierSway, ry + 1, 2, 2);
          ctx.fillRect(x + half - 1 + tierSway, ry + 1, 2, 2);
        }
        // Cold moonlight edge highlight on right bough ridge
        if (highlight && r >= 1 && r < rows - 1) {
          ctx.fillStyle = highlight;
          ctx.fillRect(x + Math.max(0, half - 2) + tierSway, ry, 2, 2);
        }
      }
    }
  }

  private drawInteractMarker(ctx: CanvasRenderingContext2D, x: number, y: number, timeSec: number): void {
    const bob = Math.round(Math.sin(timeSec * 4) * 1.5);
    const mx = Math.round(x) - 5;
    const my = Math.round(y) + bob - 9;
    ctx.fillStyle = 'rgba(9, 13, 18, 0.9)';
    ctx.fillRect(mx - 1, my - 1, 12, 11);
    ctx.fillStyle = '#627c96';
    ctx.fillRect(mx, my, 10, 9);
    ctx.fillStyle = '#121821';
    ctx.fillRect(mx + 1, my + 1, 8, 7);
    ctx.fillStyle = '#e6eef7';
    // Crisp 3x5 pixel 'E' glyph
    ctx.fillRect(mx + 3, my + 2, 4, 1);
    ctx.fillRect(mx + 3, my + 2, 1, 5);
    ctx.fillRect(mx + 3, my + 4, 3, 1);
    ctx.fillRect(mx + 3, my + 6, 4, 1);
  }

  private renderForestLighting(ctx: CanvasRenderingContext2D, state: GameState, cx: number, timeSec: number): void {
    const lctx = this.lightCtx;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    lctx.fillStyle = 'rgba(5, 8, 16, 0.54)';
    lctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    lctx.globalCompositeOperation = 'destination-out';

    // Subtle moonlight opening in upper sky
    const skyGrad = safeLinearGrad(lctx, 0, 0, 0, 125);
    skyGrad.addColorStop(0, 'rgba(255,255,255,0.52)');
    skyGrad.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.fillStyle = skyGrad;
    lctx.fillRect(0, 0, VIRTUAL_W, 125);

    const lampPositions = [245, 580, 960, 1420, 1820, 2198];
    for (const wx of lampPositions) {
      const lx = Math.round(wx - cx);
      if (lx < -80 || lx > VIRTUAL_W + 80) continue;
      const lg = safeRadialGrad(lctx, lx, FOREST_GROUND_Y - 22, 6, lx, FOREST_GROUND_Y - 22, 66);
      lg.addColorStop(0, 'rgba(255,255,255,0.72)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = lg;
      lctx.fillRect(lx - 68, FOREST_GROUND_Y - 90, 136, 136);
    }

    const px = Math.round(safeNum(state.player.x, 120) - cx);
    const crouchDrop = state.player.isHiding ? 10 : state.player.isCrouching ? 7 : 0;
    const py = Math.round(safeNum(state.player.y, FOREST_GROUND_Y) - 18 + Math.floor(crouchDrop * 0.6));
    const halo = safeRadialGrad(lctx, px, py, 8, px, py, 58);
    halo.addColorStop(0, 'rgba(255,255,255,0.85)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.fillStyle = halo;
    lctx.fillRect(px - 60, py - 60, 120, 120);

    const lowBatFlicker =
      state.player.flashlightBattery <= 20 && Math.sin(timeSec * 29) > 0.72 ? 0.35 : 1;
    const batFactor = 0.55 + (safeNum(state.player.flashlightBattery, 100) / 100) * 0.45;
    const flicker = (Math.sin(timeSec * 37) > 0.95 ? 0.45 : 1) * lowBatFlicker * batFactor;
    const dir = state.player.facing >= 0 ? 1 : -1;
    const lean = state.player.isHiding
      ? 1
      : state.player.startledTimer > 0
      ? -2
      : state.player.isRunning
      ? 2
      : state.player.isCrouching
      ? 1
      : state.player.exhausted
      ? 1
      : 0;
    const lensX = px + dir * (12 + lean);
    const lensY = Math.round(safeNum(state.player.y, FOREST_GROUND_Y) - 21 + crouchDrop);

    if (state.player.hasFlashlight && state.player.flashlightOn) {
      const grad = safeLinearGrad(lctx, lensX, lensY, lensX + dir * 200, lensY);
      grad.addColorStop(0, `rgba(255,255,255,${Math.min(1, 0.98 * flicker)})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.moveTo(lensX, lensY - 1);
      lctx.lineTo(lensX + dir * 200, lensY - 48);
      lctx.lineTo(lensX + dir * 200, lensY + 46);
      lctx.lineTo(lensX, lensY + 1);
      lctx.closePath();
      lctx.fill();
    }

    if (Math.sin(timeSec * 15) > 0.58) {
      const sparkScreenX = Math.round(1590 - cx);
      if (sparkScreenX > -60 && sparkScreenX < VIRTUAL_W + 60) {
        const sg = safeRadialGrad(lctx, sparkScreenX, FOREST_GROUND_Y - 24, 3, sparkScreenX, FOREST_GROUND_Y - 24, 42);
        sg.addColorStop(0, 'rgba(255,255,255,0.92)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        lctx.fillStyle = sg;
        lctx.fillRect(sparkScreenX - 44, FOREST_GROUND_Y - 68, 88, 88);
      }
    }

    const houseX = 2368 - cx;
    if (houseX > -120 && houseX < VIRTUAL_W + 120) {
      const hGrad = safeRadialGrad(lctx, houseX, FOREST_GROUND_Y - 40, 10, houseX, FOREST_GROUND_Y - 40, 120);
      hGrad.addColorStop(0, 'rgba(255,255,255,0.92)');
      hGrad.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = hGrad;
      lctx.fillRect(houseX - 122, FOREST_GROUND_Y - 160, 244, 244);
    }

    ctx.drawImage(this.lightCanvas, 0, 0);

    const flash = this.getLightningIntensity(timeSec, false);
    if (flash > 0) {
      ctx.fillStyle = `rgba(175, 210, 250, ${flash * 0.22})`;
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    }

    ctx.fillStyle = 'rgba(200, 220, 240, 0.14)';
    for (let i = 0; i < 18; i++) {
      const dx = (i * 73 + Math.floor(timeSec * 12)) % VIRTUAL_W;
      const dy = (i * 41 + Math.floor(timeSec * 8 + i * 17)) % VIRTUAL_H;
      ctx.fillRect(dx, dy, 1, 1);
    }

    if (state.player.hasFlashlight && state.player.flashlightOn) {
      ctx.save();
      try {
        const tint = safeLinearGrad(ctx, lensX, lensY, lensX + dir * 185, lensY);
        tint.addColorStop(0, `rgba(255, 224, 155, ${0.18 * flicker})`);
        tint.addColorStop(1, 'rgba(255, 224, 155, 0)');
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.moveTo(lensX, lensY - 1);
        ctx.lineTo(lensX + dir * 185, lensY - 44);
        ctx.lineTo(lensX + dir * 185, lensY + 42);
        ctx.lineTo(lensX, lensY + 1);
        ctx.closePath();
        ctx.fill();
      } finally {
        ctx.restore();
      }
    }
  }

  private renderHouseLighting(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cx: number,
    cy: number,
    timeSec: number
  ): void {
    const stage = getLightingStage(state.installedParts.length);
    const lctx = this.lightCtx;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    // Balanced moonlight chiaroscuro so cutaway rooms stay readable with rich contrast
    const baseDark = stage >= 4 ? 0.3 : stage >= 2 ? 0.42 : 0.54;
    lctx.fillStyle = `rgba(4, 7, 14, ${baseDark})`;
    lctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    lctx.globalCompositeOperation = 'destination-out';

    for (const room of HOUSE_ROOMS) {
      const roomFloorY = getHouseFloorY(room.floor);
      if (room.hasWindow && room.windowX) {
        const wx = Math.round(room.windowX - cx);
        const wy = Math.round(roomFloorY - 54 - cy);
        if (wx > -80 && wx < VIRTUAL_W + 80 && wy > -80 && wy < VIRTUAL_H + 80) {
          const wg = safeRadialGrad(lctx, wx, wy + 10, 6, wx, wy + 18, 62);
          wg.addColorStop(0, 'rgba(255,255,255,0.68)');
          wg.addColorStop(1, 'rgba(255,255,255,0)');
          lctx.fillStyle = wg;
          lctx.fillRect(wx - 64, wy - 54, 128, 128);
        }
      }
      if (!room.lampX) continue;
      const lit =
        stage >= (room.minLampStage ?? 99) ||
        (room.floor === 1 && room.id === 'f1_pantry' && stage >= 1);
      if (!lit) continue;
      const flickerOff = stage === 1 && Math.sin(timeSec * 19) > 0.65;
      if (flickerOff) continue;

      const lx = Math.round(room.lampX - cx);
      const ly = Math.round(roomFloorY - 78 - cy);
      if (lx < -120 || lx > VIRTUAL_W + 120 || ly < -120 || ly > VIRTUAL_H + 120) continue;

      const g = safeRadialGrad(lctx, lx, ly + 22, 14, lx, ly + 32, 108);
      g.addColorStop(0, 'rgba(255,255,255,0.96)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = g;
      lctx.fillRect(lx - 110, ly - 64, 220, 220);
    }

    const rx = Math.round(1024 - cx);
    const ry = Math.round(HOUSE_FLOOR_Y[1] - 28 - cy);
    const rg = safeRadialGrad(lctx, rx, ry, 10, rx, ry, 84);
    rg.addColorStop(0, 'rgba(255,255,255,0.94)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.fillStyle = rg;
    lctx.fillRect(rx - 86, ry - 86, 172, 172);

    for (const prop of HOUSE_PROPS) {
      const propFloorY = getHouseFloorY(prop.floor);
      if (prop.type === 'tv' && state.atmospheric.tvStaticTriggered) {
        const tx = Math.round(prop.x - cx);
        const ty = Math.round(propFloorY - 20 - cy);
        const tg = safeRadialGrad(lctx, tx, ty, 4, tx, ty, 52);
        tg.addColorStop(0, 'rgba(255,255,255,0.8)');
        tg.addColorStop(1, 'rgba(255,255,255,0)');
        lctx.fillStyle = tg;
        lctx.fillRect(tx - 54, ty - 54, 108, 108);
      } else if (prop.type === 'boiler') {
        const bx = Math.round(prop.x - cx);
        const by = Math.round(propFloorY - 30 - cy);
        const bg = safeRadialGrad(lctx, bx, by, 4, bx, by, 50);
        bg.addColorStop(0, 'rgba(255,255,255,0.78)');
        bg.addColorStop(1, 'rgba(255,255,255,0)');
        lctx.fillStyle = bg;
        lctx.fillRect(bx - 52, by - 52, 104, 104);
      } else if (prop.type === 'fireplace') {
        const fx = Math.round(prop.x - cx);
        const fy = Math.round(propFloorY - 12 - cy);
        const fireR = state.installedParts.length >= 1 ? 66 : 38;
        const fg = safeRadialGrad(lctx, fx, fy, 4, fx, fy, fireR);
        fg.addColorStop(0, state.installedParts.length >= 1 ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.48)');
        fg.addColorStop(1, 'rgba(255,255,255,0)');
        lctx.fillStyle = fg;
        lctx.fillRect(fx - fireR - 2, fy - fireR - 2, (fireR + 2) * 2, (fireR + 2) * 2);
      }
    }

    const safePx = safeNum(state.player.x, 120);
    const safePy = safeNum(state.player.y, HOUSE_FLOOR_Y[1]);
    const px = Math.round(safePx - cx);
    const crouchY = state.player.isHiding ? 10 : state.player.isCrouching ? 7 : 0;
    const py = Math.round(safePy - 20 + Math.floor(crouchY * 0.6) - cy);
    const halo = safeRadialGrad(lctx, px, py, 10, px, py, 64);
    halo.addColorStop(0, 'rgba(255,255,255,0.85)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.fillStyle = halo;
    lctx.fillRect(px - 66, py - 66, 132, 132);

    const lowBatFlicker =
      state.player.flashlightBattery <= 20 && Math.sin(timeSec * 31) > 0.7 ? 0.35 : 1;
    const batFactor = 0.55 + (safeNum(state.player.flashlightBattery, 100) / 100) * 0.45;
    const flicker = (Math.sin(timeSec * 39) > 0.96 ? 0.38 : 1) * lowBatFlicker * batFactor;
    const dir = state.player.facing >= 0 ? 1 : -1;
    const lean = state.player.isHiding
      ? 1
      : state.player.startledTimer > 0
      ? -2
      : state.player.isRunning
      ? 2
      : state.player.isCrouching
      ? 1
      : state.player.exhausted
      ? 1
      : 0;
    const lensX = px + dir * (12 + lean);
    const lensY = Math.round(safePy - 21 + crouchY - cy);

    const bounds = getHorizontalBounds(state);
    const rawReach = 185;
    const maxDistToWall =
      dir > 0
        ? Math.max(20, safeNum(bounds.maxX, 1100) + 12 - (safePx + dir * (12 + lean)))
        : Math.max(20, safePx + dir * (12 + lean) - (safeNum(bounds.minX, 24) - 12));
    const beamReach = Math.min(rawReach, maxDistToWall);
    const beamSpread = Math.max(14, Math.round((beamReach / rawReach) * 42));
    const swayY = Math.round(
      Math.sin(safeNum(state.player.walkCycle, 0) * 1.4 + timeSec * 1.8) * (Math.abs(safeNum(state.player.vx, 0)) > 8 ? 2.2 : 0.8)
    );

    if (state.player.hasFlashlight && state.player.flashlightOn && !state.player.isHiding) {
      const outerGrad = safeLinearGrad(lctx, lensX, lensY, lensX + dir * beamReach, lensY + swayY);
      outerGrad.addColorStop(0, `rgba(255,255,255,${Math.min(1, 0.98 * flicker)})`);
      outerGrad.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = outerGrad;
      lctx.beginPath();
      lctx.moveTo(lensX, lensY - 1);
      lctx.lineTo(lensX + dir * beamReach, lensY + swayY - beamSpread);
      lctx.lineTo(lensX + dir * beamReach, lensY + swayY + beamSpread);
      lctx.lineTo(lensX, lensY + 1);
      lctx.closePath();
      lctx.fill();
    }

    ctx.drawImage(this.lightCanvas, 0, 0);

    for (const d of this.dustPool) {
      const mx = Math.round(d.x);
      const my = Math.round(d.y);
      let inBeam = false;
      if (state.player.hasFlashlight && state.player.flashlightOn && !state.player.isHiding) {
        const along = (mx - lensX) * dir;
        if (along > 4 && along < beamReach) {
          const halfH = 2 + (along / beamReach) * beamSpread;
          const beamCenterY = lensY + (along / beamReach) * swayY;
          inBeam = Math.abs(my - beamCenterY) <= halfH;
        }
      }
      ctx.fillStyle = inBeam ? `rgba(255, 240, 190, ${0.42 * flicker})` : 'rgba(220, 232, 245, 0.14)';
      ctx.fillRect(mx, my, 1, 1);
    }

    if (state.player.hasFlashlight && state.player.flashlightOn && !state.player.isHiding) {
      ctx.save();
      try {
        const tintReach = Math.max(16, beamReach - 8);
        const tintSpread = Math.max(12, Math.round((tintReach / rawReach) * 40));
        const tint = safeLinearGrad(ctx, lensX, lensY, lensX + dir * tintReach, lensY + swayY);
        tint.addColorStop(0, `rgba(255, 224, 155, ${0.16 * flicker})`);
        tint.addColorStop(0.55, `rgba(255, 224, 155, ${0.07 * flicker})`);
        tint.addColorStop(1, 'rgba(255, 224, 155, 0)');
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.moveTo(lensX, lensY - 1);
        ctx.lineTo(lensX + dir * tintReach, lensY + swayY - tintSpread);
        ctx.lineTo(lensX + dir * tintReach, lensY + swayY + tintSpread);
        ctx.lineTo(lensX, lensY + 1);
        ctx.closePath();
        ctx.fill();
      } finally {
        ctx.restore();
      }
    }

    if (stage >= 3 && !state.finale.active) {
      const pulse = stage >= 5 ? 0.09 + Math.abs(Math.sin(timeSec * 4)) * 0.11 : 0.06;
      ctx.fillStyle = `rgba(175, 22, 22, ${pulse})`;
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    }
  }

  private drawReachingHands(ctx: CanvasRenderingContext2D, reachProgress: number, timeSec: number): void {
    const inward = Math.round(reachProgress * 158);
    const liftY = Math.round(reachProgress * 14);
    const tremor = Math.round(Math.sin(timeSec * 34) * 1.5);

    ctx.fillStyle = `rgba(8, 2, 4, ${Math.min(0.72, reachProgress * 0.8)})`;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    // Looming feminine android portrait (slender neck, contoured shoulders, oval porcelain face & flowing ash-blonde hair)
    const faceAlpha = Math.min(0.96, 0.25 + reachProgress * 0.72);
    const cx = VIRTUAL_W / 2;

    // Tapered female shoulders, clavicles & upper chest seam
    ctx.fillStyle = `rgba(18, 8, 12, ${faceAlpha})`;
    ctx.beginPath();
    ctx.moveTo(cx - 64, 270);
    ctx.lineTo(cx - 52, 146);
    ctx.quadraticCurveTo(cx - 24, 134, cx - 14, 130);
    ctx.lineTo(cx + 14, 130);
    ctx.quadraticCurveTo(cx + 24, 134, cx + 52, 146);
    ctx.lineTo(cx + 64, 270);
    ctx.closePath();
    ctx.fill();

    // Glowing collarbones & sternal core line
    ctx.fillStyle = `rgba(195, 206, 218, ${faceAlpha * 0.65})`;
    ctx.fillRect(cx - 34, 142, 22, 2);
    ctx.fillRect(cx + 12, 142, 22, 2);
    ctx.fillStyle = `rgba(255, 62, 62, ${faceAlpha * 0.5})`;
    ctx.fillRect(cx - 5, 162, 10, 10);

    // Slender neck with subtle synthetic muscle tendons
    ctx.fillStyle = `rgba(128, 138, 152, ${faceAlpha * 0.75})`;
    ctx.fillRect(cx - 9, 112, 18, 22);
    ctx.fillStyle = `rgba(38, 44, 54, ${faceAlpha * 0.85})`;
    ctx.fillRect(cx - 4, 115, 2, 16);
    ctx.fillRect(cx + 2, 115, 2, 16);
    ctx.fillStyle = `rgba(195, 208, 220, ${faceAlpha * 0.85})`;
    ctx.fillRect(cx - 12, 130, 24, 4);

    // Back hair volume draping behind cheeks & shoulders
    ctx.fillStyle = `rgba(145, 130, 96, ${faceAlpha * 0.72})`;
    ctx.beginPath();
    ctx.moveTo(cx - 30, 60);
    ctx.quadraticCurveTo(cx, 30, cx + 30, 60);
    ctx.lineTo(cx + 34, 138);
    ctx.lineTo(cx + 20, 140);
    ctx.lineTo(cx + 18, 72);
    ctx.lineTo(cx - 18, 72);
    ctx.lineTo(cx - 20, 140);
    ctx.lineTo(cx - 34, 138);
    ctx.closePath();
    ctx.fill();

    // Oval porcelain feminine face mask (cheekbones, delicate chin & cheek panel seams)
    ctx.fillStyle = `rgba(218, 226, 236, ${faceAlpha * 0.88})`;
    ctx.beginPath();
    ctx.moveTo(cx - 19, 60);
    ctx.quadraticCurveTo(cx, 48, cx + 19, 60);
    ctx.lineTo(cx + 18, 92);
    ctx.quadraticCurveTo(cx + 12, 116, cx, 119);
    ctx.quadraticCurveTo(cx - 12, 116, cx - 18, 92);
    ctx.closePath();
    ctx.fill();

    // Subtle facial contours: nose shadow, hairline seam & softly parted rose-tinted lips
    ctx.fillStyle = `rgba(120, 128, 142, ${faceAlpha * 0.55})`;
    ctx.fillRect(cx - 1, 82, 2, 14);
    ctx.fillStyle = `rgba(60, 48, 54, ${faceAlpha * 0.6})`;
    ctx.fillRect(cx - 18, 96, 5, 1);
    ctx.fillRect(cx + 13, 96, 5, 1);
    ctx.fillStyle = `rgba(148, 74, 84, ${faceAlpha * 0.9})`;
    ctx.fillRect(cx - 6, 105, 12, 2);
    ctx.fillRect(cx - 4, 107, 8, 1);

    // Fine arched eyebrows & sculpted curved ash-blonde bangs framing forehead & cheekbones
    ctx.fillStyle = `rgba(182, 166, 126, ${faceAlpha * 0.9})`;
    ctx.beginPath();
    ctx.moveTo(cx - 21, 64);
    ctx.quadraticCurveTo(cx - 19, 43, cx, 42);
    ctx.quadraticCurveTo(cx + 19, 43, cx + 21, 64);
    ctx.lineTo(cx + 22, 114);
    ctx.quadraticCurveTo(cx + 16, 104, cx + 17, 74);
    ctx.quadraticCurveTo(cx + 10, 58, cx, 57);
    ctx.quadraticCurveTo(cx - 10, 58, cx - 17, 74);
    ctx.quadraticCurveTo(cx - 16, 104, cx - 22, 114);
    ctx.closePath();
    ctx.fill();

    // Soft forehead fringe highlights & arched eyebrows
    ctx.fillStyle = `rgba(218, 202, 158, ${faceAlpha * 0.6})`;
    ctx.beginPath();
    ctx.moveTo(cx - 14, 54);
    ctx.quadraticCurveTo(cx - 6, 46, cx, 48);
    ctx.quadraticCurveTo(cx + 7, 46, cx + 14, 54);
    ctx.quadraticCurveTo(cx + 4, 52, cx, 56);
    ctx.quadraticCurveTo(cx - 4, 52, cx - 14, 54);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(116, 102, 74, ${faceAlpha * 0.85})`;
    ctx.fillRect(cx - 14, 73, 9, 1);
    ctx.fillRect(cx + 5, 73, 9, 1);

    // Almond crimson optical eyes with dark upper lash line & bright iris pinpoints
    ctx.fillStyle = `rgba(255, 36, 36, ${Math.min(0.32, reachProgress * 0.34)})`;
    ctx.fillRect(cx - 16, 76, 32, 10);
    ctx.fillStyle = `rgba(24, 14, 18, ${faceAlpha})`;
    ctx.fillRect(cx - 14, 78, 10, 2);
    ctx.fillRect(cx + 4, 78, 10, 2);
    ctx.fillStyle = `rgba(255, 44, 44, ${Math.min(1, reachProgress * 1.25)})`;
    ctx.fillRect(cx - 13, 80, 8, 3);
    ctx.fillRect(cx + 5, 80, 8, 3);
    ctx.fillStyle = `rgba(255, 224, 224, ${Math.min(0.95, reachProgress)})`;
    ctx.fillRect(cx - 10, 80, 3, 2);
    ctx.fillRect(cx + 7, 80, 3, 2);

    // Slender articulated feminine mechanical forearms & elongated tapered hands reaching in
    const lx = -148 + inward;
    const ly = 132 - liftY + tremor;
    ctx.fillStyle = '#a8b4c2';
    ctx.fillRect(lx, ly + 5, 134, 12);
    ctx.fillStyle = '#dce5ef';
    ctx.fillRect(lx + 10, ly + 6, 120, 5);
    ctx.fillStyle = '#4c5763';
    ctx.fillRect(lx + 24, ly + 13, 96, 2);
    ctx.fillStyle = '#2c3540';
    ctx.fillRect(lx + 128, ly + 4, 9, 14);
    ctx.fillStyle = '#ff3838';
    ctx.fillRect(lx + 131, ly + 9, 3, 3);
    ctx.fillStyle = '#d4dfe9';
    for (let f = 0; f < 4; f++) {
      const fy = ly + f * 5;
      ctx.fillRect(lx + 137, fy, 17, 3);
      ctx.fillStyle = '#7b8998';
      ctx.fillRect(lx + 152, fy + 1, 14, 2);
      ctx.fillStyle = '#d4dfe9';
    }
    ctx.fillRect(lx + 134, ly - 7, 11, 4);

    const rx = VIRTUAL_W - inward + 14;
    const ry = 136 - liftY - tremor;
    ctx.fillStyle = '#a8b4c2';
    ctx.fillRect(rx, ry + 5, 134, 12);
    ctx.fillStyle = '#dce5ef';
    ctx.fillRect(rx + 4, ry + 6, 120, 5);
    ctx.fillStyle = '#4c5763';
    ctx.fillRect(rx + 14, ry + 13, 96, 2);
    ctx.fillStyle = '#2c3540';
    ctx.fillRect(rx - 9, ry + 4, 9, 14);
    ctx.fillStyle = '#ff3838';
    ctx.fillRect(rx - 6, ry + 9, 3, 3);
    ctx.fillStyle = '#d4dfe9';
    for (let f = 0; f < 4; f++) {
      const fy = ry + f * 5;
      ctx.fillRect(rx - 26, fy, 17, 3);
      ctx.fillStyle = '#7b8998';
      ctx.fillRect(rx - 38, fy + 1, 12, 2);
      ctx.fillStyle = '#d4dfe9';
    }
    ctx.fillRect(rx - 19, ry - 7, 11, 4);
  }

  private drawPostEffects(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeSec: number,
    rainPaused = false,
    reduceFlashes = false,
    visualNoise = true
  ): void {
    // Claustrophobic dark vignette when hiding inside a shadow nook
    if (!state.finale.active && state.player.isHiding) {
      const vg = ctx.createRadialGradient(
        VIRTUAL_W / 2,
        VIRTUAL_H / 2,
        42,
        VIRTUAL_W / 2,
        VIRTUAL_H / 2,
        240
      );
      vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vg.addColorStop(1, 'rgba(2, 4, 8, 0.78)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    }

    // Horror Director power-dip lamp flicker overlay
    if (!state.finale.active && state.horror.flickerTimer > 0 && !reduceFlashes) {
      const dip = Math.sin(timeSec * 37) > 0.15 ? 0.34 : 0.08;
      ctx.fillStyle = `rgba(3, 5, 10, ${dip})`;
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    }

    // Low-stamina or high-stage tension red pulse
    if (!state.finale.active && (state.player.exhausted || state.player.startledTimer > 0)) {
      const base = state.player.startledTimer > 0 ? 0.14 : 0.06 + Math.abs(Math.sin(timeSec * 5)) * 0.05;
      const tension = reduceFlashes ? base * 0.45 : base;
      ctx.fillStyle = `rgba(145, 20, 24, ${tension})`;
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    }

    if (state.finale.active) {
      const ending = state.finale.selectedEnding ?? 'awakening';
      if (
        ending === 'awakening' &&
        (state.finale.phase === 'approach' || state.finale.phase === 'fade')
      ) {
        const reach =
          state.finale.phase === 'fade' ? 1 : Math.min(1, state.finale.timer / 2.4);
        this.drawReachingHands(ctx, reach, timeSec);
      }
      if (state.finale.redOverlay > 0) {
        ctx.fillStyle = `rgba(165, 10, 14, ${state.finale.redOverlay})`;
        ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      }
      if (state.finale.blueOverlay > 0) {
        const rgb = ending === 'last_record' ? '36, 148, 124' : '42, 118, 178';
        ctx.fillStyle = `rgba(${rgb}, ${state.finale.blueOverlay})`;
        ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      }
      if (state.finale.blackOverlay > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${state.finale.blackOverlay})`;
        ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      }
    }

    // Pre-baked CRT scanlines & dithered vignette
    ctx.drawImage(this.scanlineCanvas, 0, 0);

    // Animated retro film grain (respects visualNoise toggle)
    if (visualNoise) {
      const grainAlpha = rainPaused ? 0.02 : 0.035;
      ctx.fillStyle = `rgba(220, 230, 240, ${grainAlpha})`;
      const seed = Math.floor(timeSec * 16);
      for (let i = 0; i < 28; i++) {
        const gx = (seed * 73 + i * 137) % VIRTUAL_W;
        const gy = (seed * 41 + i * 97) % VIRTUAL_H;
        ctx.fillRect(gx, gy, 1, 1);
      }
    }
  }
}

export function getFloorLabel(floor: number): string {
  return getFloorName(floor);
}
