import { getHorizontalBounds, getLightingStage } from '../rules';
import { GameState } from '../types';
import { FOREST_GROUND_Y, getHouseFloorY, HOUSE_FLOOR_Y, HOUSE_PROPS, HOUSE_ROOMS } from '../world';
import { getLightningIntensity } from './effectsRenderer';
import { drawCachedGlow, DustMote, safeLinearGrad, safeNum, VIRTUAL_H, VIRTUAL_W } from './utils';

export function renderForestLighting(
  ctx: CanvasRenderingContext2D,
  lightCanvas: HTMLCanvasElement,
  lctx: CanvasRenderingContext2D,
  glowCanvas: HTMLCanvasElement,
  state: GameState,
  cx: number,
  timeSec: number,
  reduceFlashes: boolean,
  rainPausedActive: boolean
): void {
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);
  lctx.fillStyle = 'rgba(5, 8, 16, 0.54)';
  lctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

  lctx.globalCompositeOperation = 'destination-out';

  const skyGrad = safeLinearGrad(lctx, 0, 0, 0, 125);
  skyGrad.addColorStop(0, 'rgba(255,255,255,0.52)');
  skyGrad.addColorStop(1, 'rgba(255,255,255,0)');
  lctx.fillStyle = skyGrad;
  lctx.fillRect(0, 0, VIRTUAL_W, 125);

  const lampPositions = [245, 580, 960, 1420, 1820, 2198];
  for (const wx of lampPositions) {
    const lx = Math.round(wx - cx);
    if (lx < -80 || lx > VIRTUAL_W + 80) continue;
    drawCachedGlow(lctx, glowCanvas, lx, FOREST_GROUND_Y - 22, 66, 0.72);
  }

  const px = Math.round(safeNum(state.player.x, 120) - cx);
  const crouchDrop = state.player.isHiding ? 10 : state.player.isCrouching ? 7 : 0;
  const py = Math.round(safeNum(state.player.y, FOREST_GROUND_Y) - 18 + Math.floor(crouchDrop * 0.6));
  drawCachedGlow(lctx, glowCanvas, px, py, 58, 0.85);

  const lowBatFlicker =
    !reduceFlashes && state.player.flashlightBattery <= 20 && Math.sin(timeSec * 29) > 0.72 ? 0.35 : 1;
  const batFactor = 0.55 + (safeNum(state.player.flashlightBattery, 100) / 100) * 0.45;
  const microFlicker = !reduceFlashes && Math.sin(timeSec * 37) > 0.95 ? 0.45 : 1;
  const flicker = microFlicker * lowBatFlicker * batFactor;
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
      drawCachedGlow(lctx, glowCanvas, sparkScreenX, FOREST_GROUND_Y - 24, 42, 0.92);
    }
  }

  const houseX = 2368 - cx;
  if (houseX > -120 && houseX < VIRTUAL_W + 120) {
    drawCachedGlow(lctx, glowCanvas, houseX, FOREST_GROUND_Y - 40, 120, 0.92);
  }

  ctx.drawImage(lightCanvas, 0, 0);

  const flash = reduceFlashes ? 0 : getLightningIntensity(timeSec, rainPausedActive);
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
      tint.addColorStop(0, `rgba(255, 224, 155, ${0.2 * flicker})`);
      tint.addColorStop(0.6, `rgba(255, 224, 155, ${0.08 * flicker})`);
      tint.addColorStop(1, 'rgba(255, 224, 155, 0)');
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(lensX, lensY - 1);
      ctx.lineTo(lensX + dir * 185, lensY - 44);
      ctx.lineTo(lensX + dir * 185, lensY + 42);
      ctx.lineTo(lensX, lensY + 1);
      ctx.closePath();
      ctx.fill();

      // Focused bright center filament core
      const coreTint = safeLinearGrad(ctx, lensX, lensY, lensX + dir * 135, lensY);
      coreTint.addColorStop(0, `rgba(255, 244, 208, ${0.22 * flicker})`);
      coreTint.addColorStop(1, 'rgba(255, 244, 208, 0)');
      ctx.fillStyle = coreTint;
      ctx.beginPath();
      ctx.moveTo(lensX, lensY);
      ctx.lineTo(lensX + dir * 135, lensY - 14);
      ctx.lineTo(lensX + dir * 135, lensY + 14);
      ctx.lineTo(lensX, lensY + 1);
      ctx.closePath();
      ctx.fill();
    } finally {
      ctx.restore();
    }
  }
}

export function renderHouseLighting(
  ctx: CanvasRenderingContext2D,
  lightCanvas: HTMLCanvasElement,
  lctx: CanvasRenderingContext2D,
  glowCanvas: HTMLCanvasElement,
  dustPool: DustMote[],
  state: GameState,
  cx: number,
  cy: number,
  timeSec: number,
  reduceFlashes: boolean,
  reducedMotion: boolean
): void {
  const stage = getLightingStage(state.installedParts.length);
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);

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
        drawCachedGlow(lctx, glowCanvas, wx, wy + 16, 62, 0.68);
      }
    }
    if (!room.lampX) continue;
    const lit =
      stage >= (room.minLampStage ?? 99) ||
      (room.floor === 1 && room.id === 'f1_pantry' && stage >= 1);
    if (!lit) continue;
    const flickerOff = !reduceFlashes && stage === 1 && Math.sin(timeSec * 19) > 0.65;
    if (flickerOff) continue;

    const lx = Math.round(room.lampX - cx);
    const ly = Math.round(roomFloorY - 78 - cy);
    if (lx < -120 || lx > VIRTUAL_W + 120 || ly < -120 || ly > VIRTUAL_H + 120) continue;

    drawCachedGlow(lctx, glowCanvas, lx, ly + 28, 108, 0.96);
  }

  const rx = Math.round(1024 - cx);
  const ry = Math.round(HOUSE_FLOOR_Y[1] - 28 - cy);
  if (rx > -110 && rx < VIRTUAL_W + 110 && ry > -110 && ry < VIRTUAL_H + 110) {
    drawCachedGlow(lctx, glowCanvas, rx, ry, 84, 0.94);
  }

  for (const prop of HOUSE_PROPS) {
    const propFloorY = getHouseFloorY(prop.floor);
    if (prop.type === 'tv' && state.atmospheric.tvStaticTriggered) {
      const tx = Math.round(prop.x - cx);
      const ty = Math.round(propFloorY - 20 - cy);
      if (tx > -80 && tx < VIRTUAL_W + 80 && ty > -80 && ty < VIRTUAL_H + 80) {
        drawCachedGlow(lctx, glowCanvas, tx, ty, 52, 0.8);
      }
    } else if (prop.type === 'boiler') {
      const bx = Math.round(prop.x - cx);
      const by = Math.round(propFloorY - 30 - cy);
      if (bx > -80 && bx < VIRTUAL_W + 80 && by > -80 && by < VIRTUAL_H + 80) {
        drawCachedGlow(lctx, glowCanvas, bx, by, 50, 0.78);
      }
    } else if (prop.type === 'fireplace') {
      const fx = Math.round(prop.x - cx);
      const fy = Math.round(propFloorY - 12 - cy);
      const fireR = state.installedParts.length >= 1 ? 66 : 38;
      if (fx > -90 && fx < VIRTUAL_W + 90 && fy > -90 && fy < VIRTUAL_H + 90) {
        drawCachedGlow(lctx, glowCanvas, fx, fy, fireR, state.installedParts.length >= 1 ? 0.88 : 0.48);
      }
    }
  }

  const safePx = safeNum(state.player.x, 120);
  const safePy = safeNum(state.player.y, HOUSE_FLOOR_Y[1]);
  const px = Math.round(safePx - cx);
  const crouchY = state.player.isHiding ? 10 : state.player.isCrouching ? 7 : 0;
  const py = Math.round(safePy - 20 + Math.floor(crouchY * 0.6) - cy);
  drawCachedGlow(lctx, glowCanvas, px, py, 64, 0.85);

  const lowBatFlicker =
    !reduceFlashes && state.player.flashlightBattery <= 20 && Math.sin(timeSec * 31) > 0.7 ? 0.35 : 1;
  const batFactor = 0.55 + (safeNum(state.player.flashlightBattery, 100) / 100) * 0.45;
  const microFlicker = !reduceFlashes && Math.sin(timeSec * 39) > 0.96 ? 0.38 : 1;
  const flicker = microFlicker * lowBatFlicker * batFactor;
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
  const swayY = reducedMotion
    ? 0
    : Math.round(
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

  ctx.drawImage(lightCanvas, 0, 0);

  for (const d of dustPool) {
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
      tint.addColorStop(0, `rgba(255, 224, 155, ${0.18 * flicker})`);
      tint.addColorStop(0.55, `rgba(255, 224, 155, ${0.08 * flicker})`);
      tint.addColorStop(1, 'rgba(255, 224, 155, 0)');
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(lensX, lensY - 1);
      ctx.lineTo(lensX + dir * tintReach, lensY + swayY - tintSpread);
      ctx.lineTo(lensX + dir * tintReach, lensY + swayY + tintSpread);
      ctx.lineTo(lensX, lensY + 1);
      ctx.closePath();
      ctx.fill();

      // Narrow focused inner core beam inside the house
      const coreReach = Math.max(14, Math.round(tintReach * 0.72));
      const coreSpread = Math.max(6, Math.round(tintSpread * 0.35));
      const coreSway = Math.round(swayY * 0.72);
      const core = safeLinearGrad(ctx, lensX, lensY, lensX + dir * coreReach, lensY + coreSway);
      core.addColorStop(0, `rgba(255, 244, 210, ${0.19 * flicker})`);
      core.addColorStop(1, 'rgba(255, 244, 210, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.moveTo(lensX, lensY);
      ctx.lineTo(lensX + dir * coreReach, lensY + coreSway - coreSpread);
      ctx.lineTo(lensX + dir * coreReach, lensY + coreSway + coreSpread);
      ctx.lineTo(lensX, lensY + 1);
      ctx.closePath();
      ctx.fill();
    } finally {
      ctx.restore();
    }
  }

  if (stage >= 3 && !state.finale.active) {
    const pulse = reducedMotion
      ? 0.08
      : stage >= 5
      ? 0.09 + Math.abs(Math.sin(timeSec * 4)) * 0.11
      : 0.06;
    ctx.fillStyle = `rgba(175, 22, 22, ${pulse})`;
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
  }
}
