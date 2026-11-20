import { drawPlayer } from './renderer/characterRenderer';
import { drawPostEffects, drawRain, getLightningIntensity } from './renderer/effectsRenderer';
import {
  buildStaticHouseLayer,
  drawPartSprite,
  drawProp,
  drawRobotWorkbench,
  drawStaircase,
} from './renderer/houseBuilder';
import { renderForestLighting, renderHouseLighting } from './renderer/lightingRenderer';
import {
  createHidingVignetteCanvas,
  createRadialGlowCanvas,
  createScanlineCanvas,
  drawInteractMarker,
  drawPine,
  drawPixelCar,
  drawPixelCloud,
  drawPixelMoon,
  DustMote,
  RainDrop,
  RenderOptions,
  safeLinearGrad,
  safeNum,
  VIRTUAL_H,
  VIRTUAL_W,
} from './renderer/utils';
import { createSeededRng } from './rng';
import { getInteractableEffectiveX, getLightingStage } from './rules';
import { GameState, Interactable, WorldZone } from './types';
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

export { VIRTUAL_W, VIRTUAL_H };

export class PixelWorldRenderer {
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private glowCanvas: HTMLCanvasElement;
  private scanlineCanvas: HTMLCanvasElement;
  private hidingVignetteCanvas: HTMLCanvasElement;
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

    this.glowCanvas = createRadialGlowCanvas(128);
    this.scanlineCanvas = createScanlineCanvas();
    this.hidingVignetteCanvas = createHidingVignetteCanvas();

    this.houseStaticCanvas = document.createElement('canvas');
    this.houseStaticCanvas.width = 1152;
    this.houseStaticCanvas.height = 620;
    const hctx = this.houseStaticCanvas.getContext('2d');
    if (hctx) {
      hctx.imageSmoothingEnabled = false;
      hctx.save();
      hctx.translate(0, 20);
      buildStaticHouseLayer(hctx);
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

  public resetCamera(): void {
    this.camInitialized = false;
    this.lastZone = null;
  }

  private updateParticles(rawDt: number, rainPaused: boolean, freezeDust: boolean): void {
    const dt = Math.min(0.05, Math.max(0, safeNum(rawDt, 0)));
    if (dt <= 0) return;
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
    if (!freezeDust) {
      for (const d of this.dustPool) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.x < 0) d.x += VIRTUAL_W;
        if (d.x > VIRTUAL_W) d.x -= VIRTUAL_W;
        if (d.y < 0) d.y += VIRTUAL_H;
        if (d.y > VIRTUAL_H) d.y -= VIRTUAL_H;
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeSec: number,
    dt: number,
    nearest: Interactable | null,
    rainPausedActive = false,
    options?: RenderOptions
  ): void {
    ctx.imageSmoothingEnabled = false;
    const isPaused = Boolean(options?.paused) || state.screen === 'paused';
    const reducedMotion = Boolean(options?.reducedMotion);
    const effectiveDt = isPaused ? 0 : dt;
    this.updateParticles(effectiveDt, rainPausedActive, reducedMotion);

    if (this.lastZone !== state.player.zone) {
      this.lastZone = state.player.zone;
      this.camInitialized = false;
    }

    if (state.screen === 'title') {
      this.renderTitleScene(ctx, timeSec, reducedMotion);
      return;
    }

    const allowShake = options?.screenShake !== false && !reducedMotion;
    const reduceFlashes = Boolean(options?.reduceFlashes) || reducedMotion;
    const visualNoise = options?.visualNoise !== false;

    const thunderFlash =
      state.player.zone !== 'house' && !reduceFlashes
        ? getLightningIntensity(timeSec, rainPausedActive)
        : 0;
    let shakeX = 0;
    let shakeY = 0;
    if (allowShake && !isPaused) {
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
        this.renderForest(ctx, state, timeSec, nearest, rainPausedActive, reduceFlashes, reducedMotion);
      } else {
        this.renderHouse(ctx, state, timeSec, nearest, reduceFlashes, reducedMotion);
      }
    } finally {
      ctx.restore();
    }
    drawPostEffects(
      ctx,
      this.scanlineCanvas,
      this.hidingVignetteCanvas,
      state,
      timeSec,
      rainPausedActive,
      reduceFlashes,
      visualNoise,
      reducedMotion
    );
  }

  private renderTitleScene(ctx: CanvasRenderingContext2D, timeSec: number, reducedMotion: boolean): void {
    const t = reducedMotion ? 0 : timeSec;
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

    const flash = reducedMotion ? 0 : getLightningIntensity(t, false);
    if (flash < 0.35) {
      for (let s = 0; s < 26; s++) {
        const sx = (s * 67 + 19) % VIRTUAL_W;
        const sy = 6 + ((s * 29 + 11) % 68);
        const tw = 0.16 + Math.max(0, Math.sin(t * 1.9 + s * 1.7)) * 0.36;
        ctx.fillStyle = `rgba(182, 212, 242, ${tw})`;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }

    drawPixelMoon(ctx, 368, 42);
    for (let i = 0; i < 6; i++) {
      const cx =
        (((i * 112 - t * 4) % (VIRTUAL_W + 130)) + (VIRTUAL_W + 130)) % (VIRTUAL_W + 130) - 65;
      drawPixelCloud(ctx, cx, 22 + (i % 2) * 18, 58 + (i % 3) * 14);
    }

    const pan = t * 10;
    for (let i = -1; i < 22; i++) {
      const tx = Math.round(
        (((i * 32 - pan * 0.35) % (VIRTUAL_W + 64)) + (VIRTUAL_W + 64)) % (VIRTUAL_W + 64) - 32
      );
      drawPine(ctx, tx, 212, 68 + (i % 3) * 14, '#0a111a', '#132030');
    }

    const hx = 318;
    const hy = 114;
    // Clapboard house walls + corner quoins & climbing dark ivy
    ctx.fillStyle = '#0f1620';
    ctx.fillRect(hx, hy + 30, 124, 68);
    ctx.fillStyle = '#15202e';
    for (let sy = hy + 36; sy < hy + 96; sy += 5) {
      ctx.fillRect(hx + 2, sy, 120, 1);
    }
    ctx.fillStyle = '#1a2534';
    ctx.fillRect(hx, hy + 30, 3, 68);
    ctx.fillRect(hx + 121, hy + 30, 3, 68);
    // Mossy ivy & gutter downspout
    ctx.fillStyle = '#18242e';
    ctx.fillRect(hx - 2, hy + 31, 2, 67);
    ctx.fillStyle = '#142622';
    ctx.fillRect(hx + 3, hy + 56, 6, 36);
    ctx.fillRect(hx + 9, hy + 68, 4, 24);

    // Gable roof shingles + stone chimney + rising smoke
    ctx.fillStyle = '#0b1018';
    for (let row = 0; row < 32; row += 2) {
      const span = Math.round((row / 32) * 72);
      ctx.fillRect(hx + 62 - span, hy + row, span * 2, 2);
    }
    ctx.fillStyle = '#1a2330';
    ctx.fillRect(hx + 92, hy + 2, 14, 24);
    ctx.fillStyle = '#253142';
    ctx.fillRect(hx + 90, hy + 2, 18, 3);
    for (let p = 0; p < 5; p++) {
      const age = (t * 0.42 + p * 0.2) % 1;
      const sx = Math.round(hx + 96 - age * 14 + Math.sin(t * 1.8 + p) * 2);
      const sy = Math.round(hy - age * 28);
      const sw = 4 + Math.round(age * 6);
      ctx.fillStyle = `rgba(145, 165, 192, ${(1 - age) * 0.24})`;
      ctx.fillRect(sx, sy, sw, 3);
    }

    // Attic gable vent
    ctx.fillStyle = '#131b26';
    ctx.fillRect(hx + 57, hy + 16, 10, 8);
    ctx.fillStyle = '#243245';
    ctx.fillRect(hx + 59, hy + 18, 6, 4);

    // Flickering upper window with wooden shutters & sill
    const flicker = reducedMotion ? 0.85 : Math.sin(t * 7.3) > 0.88 ? 0.35 : 0.92;
    ctx.fillStyle = '#18212e';
    ctx.fillRect(hx + 73, hy + 47, 5, 20);
    ctx.fillRect(hx + 92, hy + 47, 5, 20);
    ctx.fillStyle = `rgba(98, 178, 232, ${flicker})`;
    ctx.fillRect(hx + 78, hy + 48, 14, 18);
    ctx.fillStyle = '#0c121a';
    ctx.fillRect(hx + 84, hy + 48, 2, 18);
    ctx.fillRect(hx + 78, hy + 56, 14, 2);
    ctx.fillStyle = '#222d3d';
    ctx.fillRect(hx + 76, hy + 66, 18, 2);

    // Recessed door, porch steps, swaying wind chime & warm flickering lantern
    ctx.fillStyle = '#2d2219';
    ctx.fillRect(hx + 22, hy + 68, 16, 26);
    ctx.fillStyle = '#3f3023';
    ctx.fillRect(hx + 24, hy + 70, 12, 24);
    ctx.fillStyle = '#211912';
    ctx.fillRect(hx + 26, hy + 73, 8, 7);
    ctx.fillRect(hx + 26, hy + 83, 8, 9);
    ctx.fillStyle = '#1b2430';
    ctx.fillRect(hx + 18, hy + 94, 24, 4);
    const chimeSway = reducedMotion ? 0 : Math.round(Math.sin(t * 2.8));
    ctx.fillStyle = '#7c8b9c';
    ctx.fillRect(hx + 18 + chimeSway, hy + 66, 1, 5);
    ctx.fillRect(hx + 20 + chimeSway, hy + 66, 1, 6);
    const lanternPulse = 0.78 + Math.sin(t * 6.5) * 0.12;
    ctx.fillStyle = '#2a3340';
    ctx.fillRect(hx + 40, hy + 70, 3, 2);
    ctx.fillStyle = `rgba(235, 178, 96, ${lanternPulse})`;
    ctx.fillRect(hx + 41, hy + 72, 2, 3);
    ctx.fillStyle = `rgba(235, 178, 96, ${0.15 * lanternPulse})`;
    ctx.fillRect(hx + 35, hy + 68, 14, 14);
    ctx.fillStyle = `rgba(235, 178, 96, ${0.06 * lanternPulse})`;
    ctx.fillRect(hx + 28, hy + 64, 28, 28);
    ctx.fillStyle = `rgba(235, 178, 96, ${0.22 * lanternPulse})`;
    ctx.fillRect(hx + 22, hy + 94, 14, 1);

    for (let i = -1; i < 15; i++) {
      const tx = Math.round(
        (((i * 48 - pan * 0.7) % (VIRTUAL_W + 80)) + (VIRTUAL_W + 80)) % (VIRTUAL_W + 80) - 40
      );
      if (tx > 290 && tx < 455) continue;
      drawPine(ctx, tx, 214, 92 + (i % 2) * 18, '#060b11', '#0e1824', reducedMotion ? 0 : Math.sin(t * 1.3 + i) * 0.8);
    }

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
      const fx = Math.round(((f * 130 + t * 7) % (VIRTUAL_W + 90)) - 45);
      ctx.fillRect(fx, 198 + (f % 2) * 4, 72, 6);
    }
    // Rain puddles + reflection ripples
    ctx.fillStyle = flash > 0 ? '#324861' : '#1b2838';
    ctx.fillRect(60, 224, 52, 3);
    ctx.fillRect(210, 234, 68, 3);
    ctx.fillRect(365, 222, 42, 3);
    const rip = Math.floor(t * 6) % 8;
    ctx.fillStyle = 'rgba(155, 200, 238, 0.28)';
    ctx.fillRect(78 - Math.floor(rip * 0.5), 225, 4 + rip, 1);
    ctx.fillRect(240 - Math.floor(rip * 0.5), 235, 4 + rip, 1);
    ctx.fillStyle = `rgba(98, 178, 232, ${flicker * 0.25})`;
    ctx.fillRect(390, 223, 10, 1);

    drawPixelCar(ctx, 198, 174, false, false, false, true, t, 0);
    if (Math.sin(t * 5.2) > 0.15) {
      ctx.fillStyle = '#ff9d3b';
      ctx.fillRect(197, 197, 3, 2);
      ctx.fillRect(292, 197, 3, 2);
      ctx.fillStyle = 'rgba(255, 157, 59, 0.16)';
      ctx.fillRect(189, 191, 18, 14);
      ctx.fillRect(285, 191, 18, 14);
      ctx.fillStyle = 'rgba(255, 157, 59, 0.25)';
      ctx.fillRect(216, 235, 12, 1);
      ctx.fillRect(264, 235, 10, 1);
    }

    drawRain(ctx, this.rainPool, 0.48, 218);
  }

  private renderCarPrologue(ctx: CanvasRenderingContext2D, state: GameState, timeSec: number): void {
    const pr = state.prologue;
    const scroll = pr.distance * 2600;

    ctx.fillStyle = '#06090f';
    ctx.fillRect(0, 0, VIRTUAL_W, 120);
    ctx.fillStyle = '#090f18';
    ctx.fillRect(0, 120, VIRTUAL_W, 82);

    for (let i = -2; i < 24; i++) {
      const x = Math.round((((i * 34 - scroll * 0.25) % (VIRTUAL_W + 72)) + (VIRTUAL_W + 72)) % (VIRTUAL_W + 72) - 36);
      drawPine(ctx, x, 200, 68 + (i % 3) * 14, '#091018', '#0e1824');
    }

    for (let i = 0; i < 12; i++) {
      const x = Math.round((((i * 125 - scroll * 0.85) % (VIRTUAL_W + 170)) + (VIRTUAL_W + 170)) % (VIRTUAL_W + 170) - 65);
      ctx.fillStyle = '#151b24';
      ctx.fillRect(x, 124, 3, 76);
      if (i % 3 === 0) {
        ctx.fillRect(x, 124, 14, 3);
        ctx.fillStyle = 'rgba(220, 195, 130, 0.45)';
        ctx.fillRect(x + 9, 127, 5, 3);
        ctx.fillStyle = 'rgba(215, 195, 145, 0.07)';
        ctx.beginPath();
        ctx.moveTo(x + 11, 130);
        ctx.lineTo(x - 14, 202);
        ctx.lineTo(x + 36, 202);
        ctx.closePath();
        ctx.fill();
      } else if (i % 3 === 1) {
        ctx.fillStyle = '#38414d';
        ctx.fillRect(x + 4, 178, 3, 22);
        ctx.fillStyle = '#b54c44';
        ctx.fillRect(x + 4, 181, 3, 3);
      }
    }

    ctx.fillStyle = '#1e2530';
    ctx.fillRect(0, 194, VIRTUAL_W, 3);
    ctx.fillStyle = '#11161d';
    ctx.fillRect(0, 199, VIRTUAL_W, 71);
    ctx.fillStyle = '#2f3845';
    for (let i = 0; i < 14; i++) {
      const dx = Math.round((((i * 44 - scroll) % (VIRTUAL_W + 44)) + (VIRTUAL_W + 44)) % (VIRTUAL_W + 44) - 22);
      ctx.fillRect(dx, 226, 20, 2);
    }

    const carX = 84;
    const bounce = pr.speed > 0.05 ? Math.round(Math.sin(timeSec * 24) * 0.8) : 0;
    const carY = 162 + bounce;

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

    drawPixelCar(ctx, carX, carY, beamOn, false, true, pr.phase === 'sputtering' || pr.phase === 'stalled', timeSec, pr.distance);

    if (beamOn) {
      ctx.fillStyle = pr.phase === 'sputtering' ? 'rgba(255, 242, 184, 0.18)' : 'rgba(255, 242, 184, 0.28)';
      ctx.fillRect(carX + 96, carY + 17, 4, 7);
    }

    if (pr.speed > 0.15) {
      ctx.fillStyle = 'rgba(150, 185, 215, 0.35)';
      for (let s = 0; s < 4; s++) {
        const sx = carX + 2 - ((Math.floor(timeSec * 40) + s * 7) % 18);
        const sy = 197 - (s % 2) * 2;
        ctx.fillRect(sx, sy, 2, 1);
      }
    }

    const wiperCycle = pr.phase === 'stalled' ? 0 : Math.sin(timeSec * 5.8);
    ctx.strokeStyle = '#8da0b5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(carX + 62, carY + 13);
    ctx.lineTo(carX + 56 + Math.round(wiperCycle * 6), carY + 5);
    ctx.stroke();

    if (pr.phase !== 'driving' && Math.sin(timeSec * 10) > 0) {
      ctx.fillStyle = '#ff4b4b';
      ctx.fillRect(carX + 58, carY + 10, 2, 2);
      ctx.fillStyle = '#ff9d3b';
      ctx.fillRect(carX - 1, carY + 23, 3, 2);
      ctx.fillRect(carX + 94, carY + 23, 3, 2);
    }

    ctx.fillStyle = '#040609';
    for (let i = 0; i < 6; i++) {
      const fx = Math.round((((i * 110 - scroll * 1.35) % (VIRTUAL_W + 110)) + (VIRTUAL_W + 110)) % (VIRTUAL_W + 110) - 40);
      ctx.fillRect(fx, 238, 6, 32);
    }

    drawRain(ctx, this.rainPool, 0.48, 224);
  }

  private renderForest(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeSec: number,
    nearest: Interactable | null,
    rainPausedActive: boolean,
    reduceFlashes: boolean,
    reducedMotion: boolean
  ): void {
    const pxSafe = safeNum(state.player.x, 120);
    const targetCamX = Math.max(0, Math.min(FOREST_MAX_X - VIRTUAL_W, pxSafe - VIRTUAL_W * 0.42));
    if (!Number.isFinite(this.camX)) this.camX = targetCamX;
    if (!this.camInitialized || reducedMotion || Math.abs(targetCamX - this.camX) > 220) {
      this.camX = targetCamX;
      this.camY = 0;
      this.camInitialized = true;
    } else {
      this.camX += (targetCamX - this.camX) * 0.14;
      this.camY = 0;
    }
    const cx = Math.round(safeNum(this.camX, 0));

    ctx.fillStyle = '#070c15';
    ctx.fillRect(0, 0, VIRTUAL_W, 118);
    ctx.fillStyle = '#0b121e';
    ctx.fillRect(0, 118, VIRTUAL_W, 100);

    const moonX = 360 - Math.round(cx * 0.05);
    drawPixelMoon(ctx, moonX, 36);
    for (let c = 0; c < 4; c++) {
      const cloudX = (((c * 145 - cx * 0.1 - timeSec * 3) % (VIRTUAL_W + 120)) + (VIRTUAL_W + 120)) % (VIRTUAL_W + 120) - 60;
      drawPixelCloud(ctx, cloudX, 20 + (c % 2) * 18, 62 + (c % 2) * 18);
    }

    for (let i = 0; i < 42; i++) {
      const wx = i * 76 - Math.round(cx * 0.32);
      if (wx < -60 || wx > VIRTUAL_W + 60) continue;
      drawPine(ctx, wx, 212, 76 + (i % 4) * 15, '#0d1520', '#131f2e');
    }

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

      for (let i = 0; i < 36; i++) {
        const tx = 48 + i * 70;
        if (tx > 2180) continue;
        const treeSway = reducedMotion ? 0 : Math.sin(timeSec * 1.45 + i * 0.9) * 0.85;
        drawPine(ctx, tx, FOREST_GROUND_Y - 2, 100 + (i % 3) * 18, '#090f17', '#101a26', treeSway);
      }

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

      ctx.fillStyle = '#121c18';
      ctx.fillRect(0, FOREST_GROUND_Y - 4, FOREST_MAX_X + 120, 5);
      ctx.fillStyle = '#1b2c24';
      for (let gx = 12; gx < 2240; gx += 18) {
        const sway = reducedMotion ? 0 : Math.round(Math.sin(timeSec * 2.2 + gx * 0.08));
        ctx.fillRect(gx + sway, FOREST_GROUND_Y - 7, 1, 3);
        ctx.fillRect(gx + 3, FOREST_GROUND_Y - 6, 1, 2);
        if (gx % 54 === 0) {
          ctx.fillRect(gx + 8 + sway, FOREST_GROUND_Y - 8, 2, 4);
        }
      }
      ctx.fillStyle = '#181f27';
      ctx.fillRect(0, FOREST_GROUND_Y, FOREST_MAX_X + 120, 60);
      ctx.fillStyle = '#242e39';
      for (let rx = 20; rx < FOREST_MAX_X; rx += 14) {
        ctx.fillRect(rx, FOREST_GROUND_Y + 3, 6, 2);
        ctx.fillRect(rx + 7, FOREST_GROUND_Y + 7, 5, 2);
      }
      ctx.fillStyle = '#1d2d3d';
      const ripCycle = reducedMotion ? 2 : Math.floor(timeSec * 6.5) % 8;
      for (let px = 210; px < 2200; px += 220) {
        ctx.fillRect(px, FOREST_GROUND_Y + 5, 38, 3);
        ctx.fillStyle = 'rgba(180, 205, 235, 0.22)';
        ctx.fillRect(px + 10 - Math.floor(ripCycle * 0.5), FOREST_GROUND_Y + 6, 6 + ripCycle, 1);
        ctx.fillStyle = '#1d2d3d';
      }

      ctx.fillStyle = 'rgba(145, 170, 195, 0.06)';
      for (let f = 0; f < 10; f++) {
        const fx = 160 + f * 225 + Math.round(Math.sin(timeSec * 0.6 + f) * 14);
        ctx.fillRect(fx, FOREST_GROUND_Y - 12, 84, 5);
      }

      drawPixelCar(ctx, 102, FOREST_GROUND_Y - 38, false, state.player.hasFlashlight, false, !state.player.hasFlashlight, timeSec, 0);

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

      ctx.fillStyle = '#28313b';
      ctx.fillRect(808, FOREST_GROUND_Y - 56, 64, 5);
      ctx.fillRect(812, FOREST_GROUND_Y - 51, 4, 51);
      ctx.fillRect(864, FOREST_GROUND_Y - 51, 4, 51);
      ctx.fillStyle = '#182029';
      ctx.fillRect(816, FOREST_GROUND_Y - 51, 48, 38);
      ctx.fillStyle = '#8b8577';
      ctx.fillRect(824, FOREST_GROUND_Y - 42, 10, 12);
      ctx.fillStyle = '#4b3b2d';
      ctx.fillRect(822, FOREST_GROUND_Y - 16, 36, 4);
      ctx.fillRect(825, FOREST_GROUND_Y - 12, 3, 12);
      ctx.fillRect(852, FOREST_GROUND_Y - 12, 3, 12);
      ctx.fillStyle = '#2b343e';
      ctx.fillRect(920, FOREST_GROUND_Y - 46, 18, 46);
      ctx.fillStyle = '#3f5061';
      ctx.fillRect(923, FOREST_GROUND_Y - 42, 12, 16);
      ctx.fillStyle = '#11151a';
      ctx.fillRect(927, FOREST_GROUND_Y - 36, 4, 7);
      if (!reduceFlashes && Math.sin(timeSec * 14) > 0.72) {
        ctx.fillStyle = 'rgba(210, 235, 255, 0.55)';
        ctx.fillRect(927, FOREST_GROUND_Y - 41, 4, 2);
      }

      ctx.fillStyle = '#2c3947';
      for (let f = 0; f < 6; f++) {
        ctx.fillRect(1224 + f * 9, FOREST_GROUND_Y + 2 + (f % 2) * 3, 4, 2);
      }

      ctx.fillStyle = '#2f3842';
      ctx.fillRect(1578, FOREST_GROUND_Y - 40, 24, 40);
      ctx.fillStyle = '#4b5966';
      ctx.fillRect(1581, FOREST_GROUND_Y - 36, 18, 22);
      ctx.fillStyle = '#d4c9b2';
      ctx.fillRect(1564, FOREST_GROUND_Y - 4, 10, 4);
      if (!reduceFlashes && Math.sin(timeSec * 15) > 0.58) {
        ctx.fillStyle = '#a3dcff';
        const spY = Math.floor((timeSec * 36) % 14);
        ctx.fillRect(1588, FOREST_GROUND_Y - 25, 4, 3);
        ctx.fillRect(1592 + (spY % 5), FOREST_GROUND_Y - 22 + spY, 2, 2);
        ctx.fillRect(1584 - (spY % 4), FOREST_GROUND_Y - 19 + spY, 1, 2);
      }

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

      // Detailed House Exterior Facade at Forest Approach
      ctx.fillStyle = '#1b212a';
      ctx.fillRect(2276, FOREST_GROUND_Y - 128, 176, 128);
      ctx.fillStyle = '#232b36';
      for (let sy = FOREST_GROUND_Y - 124; sy < FOREST_GROUND_Y; sy += 6) {
        ctx.fillRect(2278, sy, 172, 1);
      }
      ctx.fillStyle = '#2d3644';
      ctx.fillRect(2276, FOREST_GROUND_Y - 128, 4, 116);
      ctx.fillRect(2448, FOREST_GROUND_Y - 128, 4, 116);
      // Exterior rainwater downspout + ivy creepers
      ctx.fillStyle = '#364252';
      ctx.fillRect(2272, FOREST_GROUND_Y - 128, 4, 116);
      ctx.fillStyle = '#182b24';
      ctx.fillRect(2280, FOREST_GROUND_Y - 62, 12, 48);
      ctx.fillRect(2292, FOREST_GROUND_Y - 40, 8, 26);
      // Stone foundation plinth
      ctx.fillStyle = '#2d333b';
      ctx.fillRect(2274, FOREST_GROUND_Y - 12, 180, 12);
      ctx.fillStyle = '#1b2026';
      for (let sx = 2278; sx < 2448; sx += 14) {
        ctx.fillRect(sx, FOREST_GROUND_Y - 10, 10, 4);
      }
      // Shingled gable roof + overhang eaves
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
      // Brick chimney with mortar + drifting hearth smoke
      ctx.fillStyle = '#252b34';
      ctx.fillRect(2402, FOREST_GROUND_Y - 182, 18, 36);
      ctx.fillStyle = '#333b47';
      ctx.fillRect(2400, FOREST_GROUND_Y - 184, 22, 3);
      ctx.fillStyle = '#171b22';
      for (let cy = FOREST_GROUND_Y - 178; cy < FOREST_GROUND_Y - 150; cy += 6) {
        ctx.fillRect(2403, cy, 16, 1);
      }
      for (let s = 0; s < 5; s++) {
        const age = (timeSec * 0.45 + s * 0.2) % 1;
        const sx = Math.round(2407 - age * 14 + Math.sin(timeSec * 2 + s) * 2);
        const sy = Math.round(FOREST_GROUND_Y - 188 - age * 30);
        ctx.fillStyle = `rgba(165, 185, 208, ${(1 - age) * 0.25})`;
        ctx.fillRect(sx, sy, 4 + Math.round(age * 6), 3);
      }
      // Porch portico, columns, wind chime, carved front door & lantern
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
      ctx.fillStyle = '#d4b45e';
      ctx.fillRect(2376, FOREST_GROUND_Y - 27, 2, 3);
      const porchSway = reducedMotion ? 0 : Math.round(Math.sin(timeSec * 2.5));
      ctx.fillStyle = '#8b99a8';
      ctx.fillRect(2351 + porchSway, FOREST_GROUND_Y - 51, 1, 7);
      ctx.fillRect(2353 + porchSway, FOREST_GROUND_Y - 51, 1, 9);
      const lanternFlick = reduceFlashes ? 0.9 : Math.sin(timeSec * 12) > 0.85 ? 0.5 : 0.95;
      ctx.fillStyle = `rgba(235, 188, 108, ${lanternFlick})`;
      ctx.fillRect(2367, FOREST_GROUND_Y - 53, 4, 4);
      ctx.fillStyle = `rgba(235, 188, 108, ${0.15 * lanternFlick})`;
      ctx.fillRect(2358, FOREST_GROUND_Y - 54, 22, 16);
      ctx.fillStyle = '#2a241f';
      for (let fx = 2210; fx < 2268; fx += 12) {
        ctx.fillRect(fx, FOREST_GROUND_Y - 18, 3, 18);
      }
      ctx.fillRect(2208, FOREST_GROUND_Y - 13, 62, 2);
      // Tall exterior windows with shutters & muntin bars
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
        drawInteractMarker(ctx, nearest.x, nearest.y - 38, timeSec);
      }

      drawPlayer(ctx, state, timeSec, reducedMotion);
    } finally {
      ctx.restore();
    }

    renderForestLighting(
      ctx,
      this.lightCanvas,
      this.lightCtx,
      this.glowCanvas,
      state,
      cx,
      timeSec,
      reduceFlashes,
      rainPausedActive
    );

    drawRain(ctx, this.rainPool, rainPausedActive ? 0.16 : 0.44, FOREST_GROUND_Y);
  }

  private renderHouse(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    timeSec: number,
    nearest: Interactable | null,
    reduceFlashes: boolean,
    reducedMotion: boolean
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
    } else if (!this.camInitialized || reducedMotion) {
      this.camX = targetCamX;
      this.camY = targetCamY;
      this.camInitialized = true;
    } else {
      this.camX += (targetCamX - this.camX) * 0.14;
      this.camY += (targetCamY - this.camY) * 0.14;
    }

    const cx = Math.round(safeNum(this.camX, 0));
    const cy = Math.round(safeNum(this.camY, 0));

    ctx.fillStyle = '#0a1019';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    drawPixelMoon(ctx, 412, 34);

    for (let i = 0; i < 16; i++) {
      drawPine(ctx, i * 86 - Math.round(cx * 0.25), 255, 86 + (i % 3) * 14, '#0f1824', '#162333');
    }
    drawRain(ctx, this.rainPool, 0.28);

    ctx.save();
    try {
      ctx.translate(-cx, -cy);

      ctx.drawImage(this.houseStaticCanvas, 0, -20);

      const stage = getLightingStage(state.installedParts.length);

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
            ctx.fillStyle = '#3b2b1e';
            ctx.fillRect(divX - 2, floorY - 48, 4, 16);
            ctx.fillRect(divX - 2, floorY - 22, 4, 18);
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
            // Subtle brass wall switch plate
            ctx.fillStyle = '#a38952';
            ctx.fillRect(divX + 9, floorY - 30, 2, 1);
          }
        }

        if (room.hasWindow && room.windowX) {
          const wx = room.windowX;
          const wy = topY + 19;
          const winFlash = reduceFlashes ? 0 : getLightningIntensity(timeSec, false);
          ctx.fillStyle = winFlash > 0 ? '#4d7aa3' : '#122132';
          ctx.fillRect(wx - 15, wy, 30, 38);
          ctx.fillStyle = winFlash > 0 ? 'rgba(160, 205, 245, 0.14)' : 'rgba(110, 155, 200, 0.06)';
          ctx.beginPath();
          ctx.moveTo(wx - 13, wy + 38);
          ctx.lineTo(wx + 13, wy + 38);
          ctx.lineTo(wx + 24, floorY);
          ctx.lineTo(wx - 6, floorY);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(155, 200, 235, 0.38)';
          const rOff = reducedMotion ? 2 : Math.floor((timeSec * 40) % 12);
          ctx.fillRect(wx - 8, wy + 4 + rOff, 1, 6);
          ctx.fillRect(wx + 6, wy + 16 + (rOff % 8), 1, 6);
          ctx.fillRect(wx - 2, wy + 8 + ((rOff + 5) % 10), 1, 5);
          // Draped fabric curtains with fold highlights
          ctx.fillStyle = '#292226';
          ctx.fillRect(wx - 16, wy - 1, 5, 40);
          ctx.fillRect(wx + 11, wy - 1, 5, 40);
          ctx.fillStyle = '#3b3136';
          ctx.fillRect(wx - 15, wy, 2, 38);
          ctx.fillRect(wx + 13, wy, 2, 38);
          ctx.strokeStyle = '#4c5a6e';
          ctx.lineWidth = 2;
          ctx.strokeRect(wx - 15, wy, 30, 38);
          ctx.fillStyle = '#4c5a6e';
          ctx.fillRect(wx - 1, wy, 2, 38);
          ctx.fillRect(wx - 15, wy + 18, 30, 2);
          ctx.fillRect(wx - 17, wy + 38, 34, 2);
        }

        if (room.lampX) {
          const lampSway = !reducedMotion && stage >= 2 ? Math.round(Math.sin(timeSec * 1.6 + room.lampX) * 0.8) : 0;
          ctx.fillStyle = '#28303b';
          ctx.fillRect(room.lampX - 1 + lampSway, topY + 5, 2, 8);
          const lit =
            stage >= (room.minLampStage ?? 99) ||
            (room.floor === 1 && room.id === 'f1_pantry' && stage >= 1);
          const flickerOff = !reduceFlashes && stage === 1 && Math.sin(timeSec * 19) > 0.65;
          ctx.fillStyle = lit && !flickerOff ? (stage >= 3 ? '#ff9d78' : '#f2dfa8') : '#3c4552';
          ctx.fillRect(room.lampX - 5 + lampSway, topY + 13, 10, 3);

          if (lit && !flickerOff) {
            ctx.fillStyle =
              stage >= 3 ? 'rgba(255, 110, 90, 0.11)' : 'rgba(245, 220, 158, 0.11)';
            ctx.beginPath();
            ctx.moveTo(room.lampX - 4 + lampSway, topY + 16);
            ctx.lineTo(room.lampX - 42, floorY);
            ctx.lineTo(room.lampX + 42, floorY);
            ctx.lineTo(room.lampX + 4 + lampSway, topY + 16);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      drawStaircase(ctx, 715, HOUSE_FLOOR_Y[1], HOUSE_FLOOR_Y[2]);
      drawStaircase(ctx, 660, HOUSE_FLOOR_Y[2], HOUSE_FLOOR_Y[3]);
      drawStaircase(ctx, 865, HOUSE_FLOOR_Y[0], HOUSE_FLOOR_Y[1]);

      {
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

        const f2y = HOUSE_FLOOR_Y[2];
        const studyOpen = state.discoveredSecrets.includes('secret_study_blueprint');
        ctx.fillStyle = studyOpen ? '#11151b' : '#3a2d21';
        ctx.fillRect(253, f2y - 7, 18, 7);
        ctx.fillStyle = '#52402f';
        ctx.fillRect(253, studyOpen ? f2y - 12 : f2y - 7, 18, 3);

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

      for (const prop of HOUSE_PROPS) {
        drawProp(ctx, prop, state, timeSec);
      }

      for (const item of WORLD_INTERACTABLES) {
        if (item.zone !== 'house') continue;
        if (item.requiresSecret && !state.discoveredSecrets.includes(item.requiresSecret)) continue;
        const drawY = item.visualY ?? item.y;

        if (item.kind === 'part' && item.partId && !state.collectedParts.includes(item.partId) && !state.installedParts.includes(item.partId)) {
          drawPartSprite(ctx, item.partId, item.x, drawY, timeSec);
        } else if (item.kind === 'note' && item.noteId && !state.collectedNotes.includes(item.noteId)) {
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

      drawRobotWorkbench(ctx, state, timeSec, reducedMotion);

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

      if (state.shadowEncounter.active) {
        const shY = getHouseFloorY(state.shadowEncounter.floor);
        const shX = Math.round(safeNum(state.shadowEncounter.x, 420));
        const behavior = state.shadowEncounter.behavior;
        const isGuide = behavior === 'guide';
        const isStalk = behavior === 'stalk';
        const isLightReact = behavior === 'light_react';
        const exp = Math.max(0, Math.min(1, safeNum(state.shadowEncounter.exposure, 0)));
        const dirToPlayer = state.player.x >= shX ? 1 : -1;
        const shiver = isLightReact && exp > 0.12 && !reducedMotion ? Math.round(Math.sin(timeSec * 42) * (1 + exp * 1.5)) : 0;
        const jitter = (reducedMotion ? 0 : Math.round(Math.sin(timeSec * 28) * (exp > 0.3 ? 1 : 0))) + shiver;
        const baseAlpha = isGuide ? 0.68 : 0.78 + exp * 0.2;

        // Curling dark smoke & ash tendrils drifting off the silhouette
        for (let w = -2; w <= 2; w++) {
          const wy = shY - 3 - Math.abs(Math.round(Math.sin(timeSec * 3.4 + w * 1.4) * 6));
          const wx = shX + w * 4 + Math.round(Math.sin(timeSec * 2.1 + w) * 2);
          ctx.fillStyle = isGuide
            ? `rgba(26, 48, 68, ${0.34 - Math.abs(w) * 0.06})`
            : `rgba(8, 10, 16, ${0.44 - Math.abs(w) * 0.07})`;
          ctx.fillRect(wx, wy, 3, 5);
        }

        // Faint smoky echo silhouette behind Shadow when exposed
        if (exp > 0.18 && !reducedMotion) {
          ctx.fillStyle = isGuide ? 'rgba(65, 130, 185, 0.22)' : 'rgba(130, 22, 32, 0.24)';
          ctx.fillRect(shX - 8 - dirToPlayer * 3 + jitter, shY - 40, 14, 34);
        }

        const hunchY = isStalk ? 4 : isGuide ? 1 : -2;
        const leanX = isStalk ? dirToPlayer * 2 : 0;
        ctx.fillStyle = isGuide ? `rgba(14, 24, 34, ${baseAlpha})` : `rgba(4, 6, 11, ${baseAlpha})`;
        ctx.fillRect(shX - 7 + jitter, shY - 22, 14, 22);
        ctx.fillRect(shX - 6 + jitter + Math.round(leanX * 0.5), shY - 36 + hunchY, 12, 15 - hunchY);
        ctx.fillRect(shX - 4 + jitter + leanX, shY - 40 + hunchY, 8, 5);
        ctx.fillRect(shX - 3 + jitter + leanX, shY - 47 + hunchY, 6, 8);
        // Ragged smoky shoulder wisps
        const rise = reducedMotion ? 0 : Math.floor((timeSec * 12) % 6);
        ctx.fillStyle = isGuide ? 'rgba(42, 90, 130, 0.36)' : 'rgba(12, 14, 20, 0.55)';
        ctx.fillRect(shX - 8 + jitter, shY - 41 - rise, 2, 4);
        ctx.fillRect(shX + 6 + jitter, shY - 40 - ((rise + 3) % 6), 2, 4);

        const wispLift = reducedMotion ? 0 : Math.round(Math.sin(timeSec * 4.2) * 2);
        ctx.fillStyle = isGuide ? 'rgba(40, 82, 112, 0.5)' : isLightReact && exp > 0.2 ? 'rgba(110, 18, 22, 0.72)' : 'rgba(22, 8, 12, 0.58)';
        if (isGuide) {
          const pointDir = (state.shadowEncounter.guideTargetX ?? shX + 30) >= shX ? 1 : -1;
          ctx.fillRect(shX + (pointDir > 0 ? 5 : -14), shY - 31, 9, 2);
          ctx.fillRect(shX + (pointDir > 0 ? 12 : -15), shY - 32, 3, 2);
        } else if (isStalk) {
          ctx.fillRect(shX + (dirToPlayer > 0 ? 4 : -14) + jitter, shY - 30 + wispLift, 10, 2);
          ctx.fillRect(shX + (dirToPlayer > 0 ? 13 : -15) + jitter, shY - 29 + wispLift, 2, 3);
          ctx.fillRect(shX - 9 + jitter, shY - 33 - wispLift, 2, 9);
        } else {
          ctx.fillRect(shX - 9 + jitter, shY - 35 + wispLift + hunchY, 2, isLightReact ? 12 : 8);
          ctx.fillRect(shX + 7 + jitter, shY - 34 - wispLift + hunchY, 2, isLightReact ? 12 : 8);
        }

        // Piercing eye glints + static distortion tear lines
        ctx.fillStyle = isGuide
          ? 'rgba(130, 215, 255, 0.92)'
          : isLightReact && exp > 0.15
          ? '#ff2222'
          : exp > 0.25
          ? '#ff3a3a'
          : 'rgba(255, 70, 70, 0.85)';
        ctx.fillRect(shX - 2 + jitter + leanX, shY - 44 + hunchY, 2, 2);
        ctx.fillRect(shX + 1 + jitter + leanX, shY - 44 + hunchY, 2, 2);
        if (!reducedMotion && Math.sin(timeSec * 19) > 0.45) {
          ctx.fillStyle = isGuide ? 'rgba(110, 195, 240, 0.34)' : 'rgba(210, 56, 66, 0.34)';
          ctx.fillRect(shX - 10 + jitter, shY - 28, 20, 1);
          ctx.fillRect(shX - 7 + jitter, shY - 14, 14, 1);
        }
      }

      if (nearest) {
        drawInteractMarker(ctx, getInteractableEffectiveX(state, nearest), nearest.y - 42, timeSec);
      }

      drawPlayer(ctx, state, timeSec, reducedMotion);
    } finally {
      ctx.restore();
    }

    renderHouseLighting(
      ctx,
      this.lightCanvas,
      this.lightCtx,
      this.glowCanvas,
      this.dustPool,
      state,
      cx,
      cy,
      timeSec,
      reduceFlashes,
      reducedMotion
    );
  }
}

export function getFloorLabel(floor: number): string {
  return getFloorName(floor);
}
