import { GameState } from '../types';
import { FOREST_GROUND_Y } from '../world';
import { safeNum } from './utils';

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeSec: number,
  reducedMotion = false
): void {
  const p = state.player;
  const px = Math.round(safeNum(p.x, 120));
  const py = Math.round(safeNum(p.y, FOREST_GROUND_Y));
  const vx = safeNum(p.vx, 0);
  const walkCycle = safeNum(p.walkCycle, 0);
  const facing = p.facing === -1 ? -1 : 1;
  const isMoving = !p.isHiding && Math.abs(vx) > 6;
  const strideFreq = walkCycle * 1.48;
  const swing = isMoving ? Math.sin(strideFreq) : 0;
  const liftFront = isMoving ? Math.max(0, Math.round(Math.cos(strideFreq) * (p.isRunning ? 2.5 : 2))) : 0;
  const liftBack = isMoving ? Math.max(0, Math.round(-Math.cos(strideFreq) * (p.isRunning ? 2.5 : 2))) : 0;

  const strideAmp = p.isRunning ? 5.5 : 3.4;
  const frontLegX = Math.round(swing * strideAmp);
  const backLegX = Math.round(-swing * strideAmp);
  const backArmSwing = isMoving ? Math.round(swing * (p.isRunning ? 4 : 2.5)) : 0;

  const crouchDrop = p.isHiding ? 10 : p.isCrouching ? 7 : 0;
  const idleBreath = !isMoving && !reducedMotion && Math.sin(timeSec * 2.4) > 0.3 ? 1 : 0;
  const bob = isMoving ? Math.round(Math.abs(Math.cos(strideFreq)) * (p.isRunning ? 2 : 1)) : idleBreath;
  const lean = p.isHiding ? 1 : p.startledTimer > 0 ? -2 : p.isRunning ? 2 : p.isCrouching ? 1 : p.exhausted ? 1 : 0;
  const speedNorm = Math.min(1, Math.abs(vx) / 85);
  const coatTrail = isMoving ? -Math.round(1 + speedNorm * 2) : 0;
  const windWave = reducedMotion ? 0 : Math.round(Math.sin(timeSec * (isMoving ? 10 : 3.2)) * (isMoving ? 1.5 : 0.8));

  ctx.save();
  try {
    if (p.isHiding) {
      ctx.globalAlpha = 0.44;
    }
    ctx.translate(px, py);
    ctx.scale(facing, 1);

    // Contact ground shadow + puddle/dust footstep splash
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-7, -1, 15, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(-5, 1, 11, 1);
    if (isMoving && Math.abs(swing) > 0.82 && !reducedMotion) {
      const isWet = state.player.zone === 'forest';
      ctx.fillStyle = isWet ? 'rgba(170, 210, 240, 0.45)' : 'rgba(190, 185, 175, 0.28)';
      ctx.fillRect(-8, -2, 2, 1);
      ctx.fillRect(-10, -4, 1, 1);
      if (isWet) ctx.fillRect(-6, -1, 3, 1);
    }

    // Back arm (deep silhouette behind torso)
    ctx.fillStyle = '#18212d';
    ctx.fillRect(-2 + lean + backArmSwing, -22 + crouchDrop + bob, 3, Math.max(4, 9 - Math.floor(crouchDrop * 0.4)));
    ctx.fillStyle = '#a8846c';
    ctx.fillRect(-2 + lean + backArmSwing, -14 + crouchDrop + bob, 2, 2);

    // Back leg: thigh, knee cuff, boot, heel
    ctx.fillStyle = '#161e29';
    ctx.fillRect(-2 + Math.round(backLegX * 0.45), -13 + crouchDrop, 3, Math.max(2, 6 - Math.floor(crouchDrop * 0.5)));
    ctx.fillStyle = '#1b2431';
    ctx.fillRect(-2 + backLegX, -8 + Math.floor(crouchDrop * 0.4) - liftBack, 3, Math.max(2, 6 - Math.floor(crouchDrop * 0.3)));
    ctx.fillStyle = '#0c0f14';
    ctx.fillRect(-2 + backLegX, -3 - liftBack, 5, 3);
    ctx.fillStyle = '#202630';
    ctx.fillRect(-1 + backLegX, -3 - liftBack, 3, 1);

    // Canvas field backpack + rolled blanket/strap + brass buckle
    const bx = -7 + lean + coatTrail;
    const by = -25 + crouchDrop + bob;
    ctx.fillStyle = '#2d2319';
    ctx.fillRect(bx, by, 5, 11);
    ctx.fillStyle = '#473728';
    ctx.fillRect(bx, by + 1, 4, 9);
    ctx.fillStyle = '#5e4a37';
    ctx.fillRect(bx, by + 1, 4, 4); // top flap
    ctx.fillStyle = '#33414f';
    ctx.fillRect(bx - 1, by - 1, 4, 2); // strapped bedroll
    ctx.fillStyle = '#d1aa58';
    ctx.fillRect(bx + 1, by + 4, 1, 2); // brass clasp

    // Coat tail flutter behind legs
    ctx.fillStyle = '#1b2432';
    ctx.fillRect(-5 + lean + coatTrail, -15 + crouchDrop + bob, 4, 5);
    ctx.fillStyle = '#273446';
    ctx.fillRect(-4 + lean + coatTrail, -15 + crouchDrop + bob, 3, 4);

    // Front leg: hip, knee highlight, boot with sole & mud rim
    const kneeShift = p.isCrouching || p.isHiding ? 2 : 0;
    ctx.fillStyle = '#222d3d';
    ctx.fillRect(0 + Math.round(frontLegX * 0.45), -13 + crouchDrop, 3, Math.max(2, 6 - Math.floor(crouchDrop * 0.5)));
    ctx.fillStyle = '#2b394d';
    ctx.fillRect(0 + frontLegX + kneeShift, -8 + Math.floor(crouchDrop * 0.4) - liftFront, 3, Math.max(2, 6 - Math.floor(crouchDrop * 0.3)));
    ctx.fillStyle = '#11161d';
    ctx.fillRect(0 + frontLegX + kneeShift, -3 - liftFront, 5, 3);
    ctx.fillStyle = '#2e3947';
    ctx.fillRect(1 + frontLegX + kneeShift, -3 - liftFront, 3, 1);
    ctx.fillStyle = '#090b0f';
    ctx.fillRect(0 + frontLegX + kneeShift, -1 - liftFront, 5, 1);

    // Trenchcoat torso + lapel + waist belt + brass buckle + backpack strap
    ctx.fillStyle = '#243142';
    ctx.fillRect(-4 + lean, -25 + crouchDrop + bob, 8, 12);
    ctx.fillStyle = '#364860';
    ctx.fillRect(-1 + lean, -24 + crouchDrop + bob, 5, 10);
    // Wet moonlight shoulder highlight outdoors
    if (state.player.zone === 'forest') {
      ctx.fillStyle = 'rgba(165, 205, 240, 0.28)';
      ctx.fillRect(-3 + lean, -25 + crouchDrop + bob, 6, 1);
    }
    // Waist belt + buckle
    ctx.fillStyle = '#171c24';
    ctx.fillRect(-4 + lean, -17 + crouchDrop + bob, 8, 2);
    ctx.fillStyle = '#c49f52';
    ctx.fillRect(2 + lean, -17 + crouchDrop + bob, 1, 2);
    // Diagonal backpack chest strap
    ctx.fillStyle = '#473728';
    ctx.fillRect(-2 + lean, -24 + crouchDrop + bob, 2, 4);
    ctx.fillRect(0 + lean, -21 + crouchDrop + bob, 2, 3);
    // Upturned storm collar & lapel
    ctx.fillStyle = '#1b2432';
    ctx.fillRect(-5 + lean, -28 + crouchDrop + bob, 4, 4);
    ctx.fillStyle = '#4f647d';
    ctx.fillRect(1 + lean, -25 + crouchDrop + bob, 3, 3);

    // Crimson-rust wool scarf + fluttering tail
    ctx.fillStyle = '#5e2e2d';
    ctx.fillRect(-3 + lean, -27 + crouchDrop + bob, 7, 3);
    ctx.fillStyle = '#7d403d';
    ctx.fillRect(-2 + lean, -27 + crouchDrop + bob, 5, 2);
    ctx.fillStyle = '#99534f';
    ctx.fillRect(0 + lean, -27 + crouchDrop + bob, 2, 1);
    // Scarf tail blowing behind neck
    ctx.fillStyle = '#693432';
    ctx.fillRect(-6 + lean + coatTrail, -25 + crouchDrop + bob + windWave, 4, 2);
    ctx.fillStyle = '#854542';
    ctx.fillRect(-8 + lean + coatTrail, -24 + crouchDrop + bob + windWave, 3, 1);

    // Head: jaw shadow, cheek highlight, nose silhouette, ear, expressive blink
    ctx.fillStyle = '#c9a487';
    ctx.fillRect(-3 + lean, -33 + crouchDrop + bob, 6, 7);
    ctx.fillStyle = '#e0be9f';
    ctx.fillRect(-2 + lean, -33 + crouchDrop + bob, 5, 5);
    ctx.fillRect(3 + lean, -30 + crouchDrop + bob, 1, 2); // nose bridge
    ctx.fillStyle = '#a88167';
    ctx.fillRect(-2 + lean, -28 + crouchDrop + bob, 4, 1); // chin shadow
    ctx.fillRect(-3 + lean, -31 + crouchDrop + bob, 1, 2); // ear shadow

    // Layered messy hair
    ctx.fillStyle = '#362318';
    ctx.fillRect(-4 + lean, -35 + crouchDrop + bob, 8, 4);
    ctx.fillRect(-4 + lean, -32 + crouchDrop + bob, 2, 5);
    ctx.fillStyle = '#523726';
    ctx.fillRect(-3 + lean, -35 + crouchDrop + bob, 6, 2);
    ctx.fillStyle = '#6b4934';
    ctx.fillRect(-1 + lean, -35 + crouchDrop + bob, 3, 1);
    // Front brow lock
    ctx.fillStyle = '#3d281c';
    ctx.fillRect(2 + lean, -33 + crouchDrop + bob, 2, 1);

    // Eye (with periodic blink & wide startled glint)
    if (p.startledTimer > 0) {
      ctx.fillStyle = '#e8eef5';
      ctx.fillRect(1 + lean, -31 + crouchDrop + bob, 2, 2);
      ctx.fillStyle = '#11151b';
      ctx.fillRect(2 + lean, -31 + crouchDrop + bob, 1, 1);
    } else if (timeSec % 4.6 > 0.14) {
      ctx.fillStyle = '#12161d';
      ctx.fillRect(1 + lean, -31 + crouchDrop + bob, 1, 2);
      ctx.fillStyle = '#404c5c';
      ctx.fillRect(1 + lean, -31 + crouchDrop + bob, 1, 1);
    }

    // Cold breath condensation outdoors or in cold basement
    if (!p.isHiding && !reducedMotion && (state.player.zone === 'forest' || state.player.floor === 0)) {
      const breathPhase = timeSec % 3.2;
      if (breathPhase < 0.95) {
        const bxBreath = 5 + lean + Math.round(breathPhase * 7);
        const byBreath = -29 + crouchDrop + bob - Math.round(breathPhase * 3.5);
        ctx.fillStyle = `rgba(215, 235, 250, ${(1 - breathPhase / 0.95) * 0.36})`;
        ctx.fillRect(bxBreath, byBreath, 3, 2);
        ctx.fillRect(bxBreath + 2, byBreath - 1, 2, 1);
      }
    }

    // Raindrops dripping off shoulder outdoors
    if (state.player.zone === 'forest' && !reducedMotion) {
      const dropY = Math.floor((timeSec * 22) % 16);
      if (dropY < 10) {
        ctx.fillStyle = 'rgba(180, 215, 245, 0.45)';
        ctx.fillRect(-5 + lean, -16 + crouchDrop + dropY, 1, 2);
      }
    }

    // Front arm: tucked hiding pose OR active reaching / metallic flashlight hand
    if (p.isHiding) {
      ctx.fillStyle = '#2d3b4d';
      ctx.fillRect(-1 + lean, -22 + crouchDrop + bob, 5, 4);
      ctx.fillStyle = '#43566e';
      ctx.fillRect(0 + lean, -22 + crouchDrop + bob, 4, 1);
      ctx.fillStyle = '#dbb89c';
      ctx.fillRect(3 + lean, -20 + crouchDrop + bob, 2, 2);
    } else {
      const reach = p.interactAnimTimer > 0 ? Math.round(Math.sin((p.interactAnimTimer / 0.35) * Math.PI) * 6) : 0;
      const armAimBob = isMoving && !p.isCrouching ? Math.round(Math.sin(strideFreq)) : 0;
      const armY = (p.startledTimer > 0 ? -25 : -22) + armAimBob;
      ctx.fillStyle = '#2d3b4d';
      ctx.fillRect(0 + lean, armY + crouchDrop + bob, 7 + reach, 3);
      ctx.fillStyle = '#4b607a';
      ctx.fillRect(1 + lean, armY + crouchDrop + bob, 5 + reach, 1);
      ctx.fillStyle = '#dbb89c';
      ctx.fillRect(7 + lean + reach, armY + crouchDrop + bob, 2, 2);
      if (p.interactAnimTimer > 0) {
        ctx.fillStyle = 'rgba(170, 230, 255, 0.85)';
        ctx.fillRect(10 + lean + reach, armY + crouchDrop + bob - 1, 2, 3);
      }
      if (p.hasFlashlight) {
        // Metallic flashlight barrel + knurled bevel even when off; lens glow when on
        ctx.fillStyle = '#536170';
        ctx.fillRect(7 + lean + reach, armY + crouchDrop + bob, 3, 2);
        ctx.fillStyle = '#9aa8b8';
        ctx.fillRect(10 + lean + reach, armY + crouchDrop + bob - 1, 2, 3);
        ctx.fillStyle = '#c49648';
        ctx.fillRect(8 + lean + reach, armY + crouchDrop + bob, 1, 1);
        if (p.flashlightOn) {
          const lensAlpha = Math.sin(timeSec * 31) > 0.96 ? 0.35 : 0.96;
          ctx.fillStyle = `rgba(255, 240, 190, ${lensAlpha})`;
          ctx.fillRect(12 + lean + reach, armY + crouchDrop + bob - 1, 1, 3);
          ctx.fillStyle = `rgba(255, 224, 150, ${lensAlpha * 0.4})`;
          ctx.fillRect(13 + lean + reach, armY + crouchDrop + bob - 1, 2, 3);
        }
      }
    }
  } finally {
    ctx.restore();
  }
}
