import { ROOM_RADIO_SIGNALS } from '../content';
import {
  DialogueMessage,
  DifficultyMode,
  GameState,
  RoomRadioSignalDefinition,
} from '../types';
import {
  FOREST_MAX_X,
  FOREST_MIN_X,
  getFloorBounds,
  HOUSE_ROOMS,
} from '../world';

export const WALK_SPEED = 66; // ~2.2 game units/s in 480x270 virtual space
export const RUN_SPEED = 108; // ~3.6 game units/s
export const ACCEL_RATE = 520;
export const BRAKE_RATE = 380; // Slight braking inertia
export const STAMINA_DRAIN = 28; // per sec
export const STAMINA_RECOVER = 18; // per sec

export interface DifficultyProfile {
  staminaDrainScale: number;
  staminaRecoverScale: number;
  shadowExposureScale: number;
  shadowCooldownDelta: number;
  tensionRateScale: number;
  anomalyCooldown: number;
}

export function getDifficultyProfile(difficulty: DifficultyMode = 'standard'): DifficultyProfile {
  if (difficulty === 'story') {
    return {
      staminaDrainScale: 0.72,
      staminaRecoverScale: 1.25,
      shadowExposureScale: 0.62,
      shadowCooldownDelta: 8,
      tensionRateScale: 0.72,
      anomalyCooldown: 36,
    };
  }
  if (difficulty === 'tension') {
    return {
      staminaDrainScale: 1.18,
      staminaRecoverScale: 0.9,
      shadowExposureScale: 1.32,
      shadowCooldownDelta: -5,
      tensionRateScale: 1.25,
      anomalyCooldown: 21,
    };
  }
  return {
    staminaDrainScale: 1,
    staminaRecoverScale: 1,
    shadowExposureScale: 1,
    shadowCooldownDelta: 0,
    tensionRateScale: 1,
    anomalyCooldown: 28,
  };
}

function clampDt(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return Math.min(0.25, dt);
}

export function getCurrentRoomName(state: GameState): string {
  if (state.player.zone === 'car_prologue') return 'Автомобиль · Лесная дорога';
  if (state.player.zone === 'forest') {
    const x = state.player.x;
    if (x < 340) return 'Место поломки автомобиля';
    if (x < 680) return 'Лесная дорога';
    if (x < 1050) return 'Заброшенная остановка';
    if (x < 1460) return 'Лесная просека';
    if (x < 1800) return 'Обочина у щитка';
    if (x < 2160) return 'Старый мост';
    return 'У крыльца старого дома';
  }
  const room = HOUSE_ROOMS.find(
    (r) =>
      r.floor === state.player.floor &&
      state.player.x >= r.x &&
      state.player.x <= r.x + r.width
  );
  return room ? room.name : 'Старый дом';
}

export function getHorizontalBounds(state: GameState): { minX: number; maxX: number } {
  if (state.player.zone === 'forest') {
    return { minX: FOREST_MIN_X, maxX: FOREST_MAX_X };
  }
  const base = getFloorBounds(state.player.floor);
  let minX = base.minX;
  let maxX = base.maxX;

  if (state.player.floor === 0) {
    if (state.player.x < 320) {
      minX = 44;
      maxX = 304;
    } else {
      minX = 336;
      maxX = 1104;
    }
  }

  if (state.player.floor === 3 && !state.collectedKeys.includes('tech_key')) {
    if (state.player.x < 720) {
      maxX = 712;
    }
  }

  return { minX, maxX };
}

export function updatePlayerMovement(
  state: GameState,
  input: { left: boolean; right: boolean; run: boolean; crouch: boolean },
  rawDt: number,
  difficulty: DifficultyMode = 'standard'
): void {
  const dt = clampDt(rawDt);
  const diff = getDifficultyProfile(difficulty);
  const p = state.player;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (p.interactAnimTimer > 0) {
    p.interactAnimTimer = Math.max(0, p.interactAnimTimer - dt);
  }
  if (p.startledTimer > 0) {
    p.startledTimer = Math.max(0, p.startledTimer - dt);
  }

  if (p.isHiding) {
    p.vx = 0;
    p.isRunning = false;
    p.isCrouching = true;
    p.stamina = Math.min(100, p.stamina + STAMINA_RECOVER * diff.staminaRecoverScale * 1.15 * dt);
    if (p.exhausted && p.stamina >= 28) {
      p.exhausted = false;
    }
    return;
  }

  p.isCrouching = input.crouch && dir === 0;
  const wantsRun = input.run && dir !== 0 && !p.exhausted && !p.isCrouching;
  p.isRunning = wantsRun && p.stamina > 1;

  if (p.isRunning) {
    p.stamina = Math.max(0, p.stamina - STAMINA_DRAIN * diff.staminaDrainScale * dt);
    if (p.stamina <= 0.5) {
      p.exhausted = true;
    }
  } else {
    p.stamina = Math.min(100, p.stamina + STAMINA_RECOVER * diff.staminaRecoverScale * dt);
    if (p.exhausted && p.stamina >= 28) {
      p.exhausted = false;
    }
  }

  const targetSpeed =
    dir === 0 ? 0 : dir * (p.isRunning ? RUN_SPEED : p.isCrouching ? WALK_SPEED * 0.55 : WALK_SPEED);

  if (dir !== 0) {
    p.facing = dir > 0 ? 1 : -1;
    if (p.vx < targetSpeed) {
      p.vx = Math.min(targetSpeed, p.vx + ACCEL_RATE * dt);
    } else if (p.vx > targetSpeed) {
      p.vx = Math.max(targetSpeed, p.vx - ACCEL_RATE * dt);
    }
  } else {
    if (p.vx > 0) {
      p.vx = Math.max(0, p.vx - BRAKE_RATE * dt);
    } else if (p.vx < 0) {
      p.vx = Math.min(0, p.vx + BRAKE_RATE * dt);
    }
  }

  p.x += p.vx * dt;
  const bounds = getHorizontalBounds(state);
  if (p.x < bounds.minX) {
    p.x = bounds.minX;
    p.vx = 0;
  } else if (p.x > bounds.maxX) {
    p.x = bounds.maxX;
    p.vx = 0;
  }

  if (Math.abs(p.vx) > 4) {
    p.walkCycle += Math.abs(p.vx) * dt * 0.14;
  }

  if (p.hasFlashlight && p.flashlightOn && !state.finale.active) {
    p.flashlightBattery = Math.max(12, p.flashlightBattery - 0.55 * dt);
  }
}

export function toggleHidingSpot(
  state: GameState,
  spotId: string | null
): { isHiding: boolean; dialogue: DialogueMessage } {
  if (state.player.isHiding) {
    state.player.isHiding = false;
    state.player.hidingSpotId = null;
    state.player.isCrouching = false;
    return {
      isHiding: false,
      dialogue: { speaker: 'thought', text: 'Осторожно выхожу из укрытия.', duration: 2.0 },
    };
  }
  state.player.isHiding = true;
  state.player.hidingSpotId = spotId;
  state.player.vx = 0;
  state.player.flashlightOn = false;
  return {
    isHiding: true,
    dialogue: {
      speaker: 'thought',
      text: 'Затаил дыхание в тени... Фонарик погашен. [E] или [S] — выйти.',
      duration: 2.8,
    },
  };
}

export function updatePrologue(
  state: GameState,
  input: { left: boolean; right: boolean; brake: boolean },
  rawDt: number
): DialogueMessage | null {
  const dt = clampDt(rawDt);
  const pr = state.prologue;
  if (pr.phase === 'done') return null;

  if (pr.phase === 'driving') {
    const accel = input.right ? 0.55 : input.left ? -0.25 : 0;
    const brake = input.brake ? -0.85 : 0;
    pr.speed = Math.max(0.35, Math.min(1.85, pr.speed + (accel + brake) * dt));
    pr.distance = Math.min(1, pr.distance + pr.speed * 0.068 * dt);

    if (pr.distance >= 0.36 && !pr.radioBroken) {
      pr.radioBroken = true;
      return {
        speaker: 'radio',
        text: '...[помехи]... ...не оставляй... ...[треск]...',
        duration: 3.0,
      };
    }

    if (pr.distance >= 0.72) {
      pr.phase = 'sputtering';
      return {
        speaker: 'thought',
        text: 'Что-то стукнуло под капотом. Фары мигают...',
        duration: 2.8,
      };
    }
  } else if (pr.phase === 'sputtering') {
    pr.speed = Math.max(0, pr.speed - 0.48 * dt);
    pr.distance = Math.min(1, pr.distance + pr.speed * 0.04 * dt);
    pr.headlightFlicker = Math.sin(pr.distance * 210) > 0.15 ? 0.2 : 1;
    if (pr.speed <= 0.02) {
      pr.speed = 0;
      pr.phase = 'stalled';
      pr.headlightFlicker = 0;
      return {
        speaker: 'thought',
        text: 'Двигатель заглох. Попробовать завести [E] или выйти из машины [W].',
        duration: 4.0,
      };
    }
  }
  return null;
}

export interface RoomRadioDetectionResult {
  active: RoomRadioSignalDefinition | null;
  strength: number; // 0..1
  newlyDiscovered: RoomRadioSignalDefinition | null;
}

export function detectNearbyRoomRadioSignal(state: GameState): RoomRadioDetectionResult {
  if (state.player.zone !== 'house' || state.finale.active) {
    return { active: null, strength: 0, newlyDiscovered: null };
  }

  let best: RoomRadioSignalDefinition | null = null;
  let bestStrength = 0;

  for (const sig of ROOM_RADIO_SIGNALS) {
    if (sig.floor !== state.player.floor) continue;
    if (sig.requiresMinInstalled !== undefined && state.installedParts.length < sig.requiresMinInstalled) {
      continue;
    }
    if (sig.requiresBreaker && !state.breakerFixed) {
      continue;
    }
    const dist = Math.abs(state.player.x - sig.x);
    if (dist <= sig.radius) {
      const strength = Math.max(0, Math.min(1, 1 - dist / sig.radius));
      if (strength > bestStrength) {
        best = sig;
        bestStrength = strength;
      }
    }
  }

  let newlyDiscovered: RoomRadioSignalDefinition | null = null;
  if (best && bestStrength >= 0.72 && !state.discoveredRadioSignals.includes(best.id)) {
    state.discoveredRadioSignals.push(best.id);
    const obs = `Перехвачен радиосигнал (${best.freqLabel}, ${best.roomLabel}): «${best.title}».`;
    if (!state.journalObservations.includes(obs)) {
      state.journalObservations.push(obs);
    }
    newlyDiscovered = best;
  }

  return {
    active: best,
    strength: bestStrength,
    newlyDiscovered,
  };
}
