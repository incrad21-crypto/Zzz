import { GameState } from '../types';
import { RainDrop, VIRTUAL_H, VIRTUAL_W } from './utils';

export function getLightningIntensity(timeSec: number, rainPaused: boolean): number {
  if (rainPaused) return 0;
  const cycle = timeSec % 11.4;
  if (cycle > 10.15 && cycle < 10.27) return 0.72;
  if (cycle > 10.34 && cycle < 10.48) return 0.45;
  return 0;
}

export function drawRain(
  ctx: CanvasRenderingContext2D,
  rainPool: RainDrop[],
  alpha = 0.4,
  groundSplashY?: number
): void {
  ctx.save();
  try {
    ctx.strokeStyle = `rgba(145, 178, 210, ${alpha * 0.45})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < rainPool.length; i += 2) {
      const r = rainPool[i];
      if (!r) continue;
      const rx = Math.round((r.x * 1.13 + 37) % VIRTUAL_W);
      const ry = Math.round((r.y * 0.91 + 19) % VIRTUAL_H);
      const len = Math.max(4, Math.round(r.len * 0.65));
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - Math.round(len * 0.2), ry + len);
    }
    ctx.stroke();

    ctx.strokeStyle = `rgba(176, 206, 234, ${alpha})`;
    ctx.beginPath();
    for (const r of rainPool) {
      const rx = Math.round(r.x);
      const ry = Math.round(r.y);
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - Math.round(r.len * 0.24), ry + r.len);
    }
    ctx.stroke();

    if (groundSplashY !== undefined) {
      ctx.fillStyle = `rgba(186, 216, 240, ${alpha * 0.72})`;
      for (let i = 0; i < 24; i++) {
        const r = rainPool[i];
        if (!r) continue;
        const sx = Math.round((r.x * 1.37) % VIRTUAL_W);
        if (r.y > groundSplashY - 10 && r.y < groundSplashY + 8) {
          ctx.fillRect(sx - 1, groundSplashY, 3, 1);
          ctx.fillRect(sx, groundSplashY - 1, 1, 1);
          if (i % 3 === 0) {
            ctx.fillRect(sx - 2, groundSplashY + 1, 5, 1);
          }
        }
      }
    }
  } finally {
    ctx.restore();
  }
}

export function drawReachingHands(
  ctx: CanvasRenderingContext2D,
  reachProgress: number,
  timeSec: number,
  reducedMotion = false
): void {
  const inward = Math.round(reachProgress * 158);
  const liftY = Math.round(reachProgress * 14);
  const tremor = reducedMotion ? 0 : Math.round(Math.sin(timeSec * 34) * 1.5);

  ctx.fillStyle = `rgba(8, 2, 4, ${Math.min(0.72, reachProgress * 0.8)})`;
  ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

  const faceAlpha = Math.min(0.96, 0.25 + reachProgress * 0.72);
  const cx = VIRTUAL_W / 2;

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

  ctx.fillStyle = `rgba(195, 206, 218, ${faceAlpha * 0.65})`;
  ctx.fillRect(cx - 34, 142, 22, 2);
  ctx.fillRect(cx + 12, 142, 22, 2);
  ctx.fillStyle = `rgba(255, 62, 62, ${faceAlpha * 0.5})`;
  ctx.fillRect(cx - 5, 162, 10, 10);

  ctx.fillStyle = `rgba(128, 138, 152, ${faceAlpha * 0.75})`;
  ctx.fillRect(cx - 9, 112, 18, 22);
  ctx.fillStyle = `rgba(38, 44, 54, ${faceAlpha * 0.85})`;
  ctx.fillRect(cx - 4, 115, 2, 16);
  ctx.fillRect(cx + 2, 115, 2, 16);
  ctx.fillStyle = `rgba(195, 208, 220, ${faceAlpha * 0.85})`;
  ctx.fillRect(cx - 12, 130, 24, 4);

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

  ctx.fillStyle = `rgba(218, 226, 236, ${faceAlpha * 0.88})`;
  ctx.beginPath();
  ctx.moveTo(cx - 19, 60);
  ctx.quadraticCurveTo(cx, 48, cx + 19, 60);
  ctx.lineTo(cx + 18, 92);
  ctx.quadraticCurveTo(cx + 12, 116, cx, 119);
  ctx.quadraticCurveTo(cx - 12, 116, cx - 18, 92);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(120, 128, 142, ${faceAlpha * 0.55})`;
  ctx.fillRect(cx - 1, 82, 2, 14);
  ctx.fillStyle = `rgba(60, 48, 54, ${faceAlpha * 0.6})`;
  ctx.fillRect(cx - 18, 96, 5, 1);
  ctx.fillRect(cx + 13, 96, 5, 1);
  ctx.fillStyle = `rgba(148, 74, 84, ${faceAlpha * 0.9})`;
  ctx.fillRect(cx - 6, 105, 12, 2);
  ctx.fillRect(cx - 4, 107, 8, 1);

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

export function drawPostEffects(
  ctx: CanvasRenderingContext2D,
  scanlineCanvas: HTMLCanvasElement,
  hidingVignetteCanvas: HTMLCanvasElement,
  state: GameState,
  timeSec: number,
  rainPaused = false,
  reduceFlashes = false,
  visualNoise = true,
  reducedMotion = false
): void {
  if (!state.finale.active && state.player.isHiding) {
    ctx.drawImage(hidingVignetteCanvas, 0, 0);
  }

  if (!state.finale.active && state.horror.flickerTimer > 0 && !reduceFlashes && !reducedMotion) {
    const dip = Math.sin(timeSec * 37) > 0.15 ? 0.34 : 0.08;
    ctx.fillStyle = `rgba(3, 5, 10, ${dip})`;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
  }

  if (!state.finale.active && (state.player.exhausted || state.player.startledTimer > 0)) {
    const base =
      state.player.startledTimer > 0
        ? 0.14
        : reducedMotion
        ? 0.08
        : 0.06 + Math.abs(Math.sin(timeSec * 5)) * 0.05;
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
      drawReachingHands(ctx, reach, timeSec, reducedMotion);
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

  ctx.drawImage(scanlineCanvas, 0, 0);

  if (visualNoise && !reducedMotion) {
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
