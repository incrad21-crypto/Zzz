import {
  ALL_NOTES,
  AUDIO_TAPES,
  KEY_LABELS,
  PART_BY_ID,
  SECRETS,
  getRobotDialogueForStage,
} from '../content';
import {
  AudioTapeId,
  DialogueMessage,
  DifficultyMode,
  GameState,
  InspectTargetId,
  Interactable,
  ShadowBehavior,
} from '../types';
import { FOREST_GROUND_Y, getHouseFloorY, WORLD_INTERACTABLES } from '../world';
import { getDifficultyProfile, getHorizontalBounds, toggleHidingSpot } from './MovementSystem';
import { startFinale } from './ProgressionSystem';

function clampDt(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return Math.min(0.25, dt);
}

export function isInteractableAvailable(state: GameState, item: Interactable): boolean {
  if (item.zone !== state.player.zone) return false;
  if (item.zone === 'house' && item.floor !== state.player.floor) return false;

  if (item.kind === 'part' && item.partId) {
    if (state.collectedParts.includes(item.partId) || state.installedParts.includes(item.partId)) {
      return false;
    }
  }
  if (item.kind === 'note' && item.noteId) {
    if (state.collectedNotes.includes(item.noteId)) {
      return false;
    }
  }
  if (item.kind === 'key' && item.keyId) {
    if (state.collectedKeys.includes(item.keyId)) {
      return false;
    }
  }
  if (item.kind === 'audio_tape' && item.tapeId) {
    if (state.collectedTapes.includes(item.tapeId)) {
      return false;
    }
  }
  if (item.kind === 'container') {
    if (state.lootedContainers.includes(item.id)) {
      return false;
    }
  }
  if (item.kind === 'safe' && state.safeUnlocked) {
    return false;
  }
  if (item.kind === 'clock_puzzle' && state.clockSolved) {
    return false;
  }
  if (item.kind === 'car_trunk' && state.player.hasFlashlight) {
    return false;
  }
  if (
    item.kind === 'secret_trigger' &&
    item.secretId &&
    item.targetFloor === undefined &&
    state.discoveredSecrets.includes(item.secretId)
  ) {
    return false;
  }
  if (item.requiresSecret && !state.discoveredSecrets.includes(item.requiresSecret)) {
    return false;
  }
  if (item.id === 'f3_tech_door_lock' && state.collectedKeys.includes('tech_key')) {
    return false;
  }
  return true;
}

export function getInteractableEffectiveX(state: GameState, item: Interactable): number {
  if (item.id === 'f4_mannequin' && state.atmospheric.mannequinMoved) {
    return item.x + 42;
  }
  return item.x;
}

export function findNearestInteractable(state: GameState): Interactable | null {
  if (state.player.zone === 'car_prologue') return null;
  if (state.player.isHiding) {
    return WORLD_INTERACTABLES.find((i) => i.id === state.player.hidingSpotId) ?? null;
  }
  let best: Interactable | null = null;
  let bestDist = Infinity;
  for (const item of WORLD_INTERACTABLES) {
    if (!isInteractableAvailable(state, item)) continue;
    const dist = Math.abs(state.player.x - getInteractableEffectiveX(state, item));
    if (dist <= item.width * 0.85 + 14 && dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}

export interface RequirementCheckResult {
  allowed: boolean;
  reason?: string;
  sfx?: InteractionResult['sfx'];
}

export function checkInteractableRequirements(
  state: GameState,
  item: Interactable
): RequirementCheckResult {
  if (item.zone !== state.player.zone) {
    return { allowed: false, reason: 'Объект находится в другой зоне.', sfx: 'none' };
  }
  if (item.zone === 'house' && item.floor !== state.player.floor) {
    return { allowed: false, reason: 'Объект находится на другом этаже.', sfx: 'none' };
  }
  if (item.requiresKey && !state.collectedKeys.includes(item.requiresKey)) {
    const keyName = KEY_LABELS[item.requiresKey] ?? 'ключ';
    return {
      allowed: false,
      reason: `Заперто. Похоже, нужен: ${keyName}.`,
      sfx: 'locked',
    };
  }
  if (item.requiresBreaker && !state.breakerFixed) {
    return {
      allowed: false,
      reason:
        'Вентиляционная решётка под напряжением и заперта магнитным замком. Нужно обесточить её на электрощитке рядом.',
      sfx: 'locked',
    };
  }
  if (item.requiresSecret && !state.discoveredSecrets.includes(item.requiresSecret)) {
    return { allowed: false, reason: 'Путь пока скрыт.', sfx: 'locked' };
  }
  return { allowed: true };
}

export interface InteractionResult {
  dialogues: DialogueMessage[];
  openOverlay?:
    | 'assembly'
    | 'journal'
    | 'safe'
    | 'clock'
    | 'terminal'
    | 'breaker'
    | 'radio'
    | 'container'
    | 'inspect';
  activeContainerId?: string;
  activeInspectId?: InspectTargetId;
  selectedNoteId?: string;
  sfx:
    | 'none'
    | 'pickup'
    | 'paper'
    | 'door'
    | 'locked'
    | 'secret'
    | 'robot'
    | 'finale'
    | 'tape'
    | 'unlock'
    | 'hide';
  shouldSave: boolean;
}

function pushObservationUnique(state: GameState, obs: string): void {
  if (!state.journalObservations.includes(obs)) {
    state.journalObservations.push(obs);
  }
}

export function triggerInteraction(state: GameState, item: Interactable): InteractionResult {
  state.player.interactAnimTimer = 0.35;
  const dialogues: DialogueMessage[] = [];

  const req = checkInteractableRequirements(state, item);
  if (!req.allowed) {
    return {
      dialogues: req.reason
        ? [{ speaker: 'thought', text: req.reason, duration: 3.5 }]
        : [],
      sfx: req.sfx ?? 'locked',
      shouldSave: false,
    };
  }

  switch (item.kind) {
    case 'car_trunk': {
      const firstPickup = !state.player.hasFlashlight;
      state.player.hasFlashlight = true;
      state.player.flashlightOn = true;
      if (!state.collectedKeys.includes('flashlight')) {
        state.collectedKeys.push('flashlight');
      }
      state.prologue.phase = 'done';
      if (firstPickup) {
        pushObservationUnique(
          state,
          'В багажнике нашёлся фонарик. В глубине леса виднеется дом.'
        );
      }
      return {
        dialogues: firstPickup
          ? [
              { speaker: 'thought', text: 'Взял фонарик из багажника [F — вкл/выкл].', duration: 3 },
              {
                speaker: 'thought',
                text: 'Вдалеке между деревьями светится окно. Кажется, там кто-то живёт.',
                duration: 3.8,
              },
            ]
          : [{ speaker: 'thought', text: 'В багажнике больше ничего полезного нет.', duration: 2.2 }],
        sfx: firstPickup ? 'pickup' : 'none',
        shouldSave: firstPickup,
      };
    }

    case 'house_entrance':
    case 'door_transition': {
      if (item.targetZone === 'house') {
        state.player.zone = 'house';
        state.player.floor = item.targetFloor ?? 1;
        state.player.x = item.targetX ?? 68;
        state.player.y = item.targetY ?? getHouseFloorY(state.player.floor);
        state.player.vx = 0;
        pushObservationUnique(state, 'Дверь старого дома оказалась не заперта.');
        return {
          dialogues: [
            {
              speaker: 'thought',
              text: 'Дверь приоткрыта. Внутри пахнет пылью, сыростью и старой изоляцией.',
              duration: 3.8,
            },
          ],
          sfx: 'door',
          shouldSave: true,
        };
      }
      if (item.targetZone === 'forest') {
        if (
          item.id === 'f1_exit_door' &&
          state.installedParts.length >= 7 &&
          !state.atmospheric.doorRelockedOnce
        ) {
          state.atmospheric.doorRelockedOnce = true;
          state.player.startledTimer = 0.45;
          pushObservationUnique(
            state,
            'Перед самой развязкой входная дверь захлопнулась, словно её держали с другой стороны.'
          );
          return {
            dialogues: [
              {
                speaker: 'thought',
                text: 'Ручка дёрнулась и замерла — будто кто-то держит дверь снаружи.',
                duration: 3.0,
              },
              {
                speaker: 'robot',
                text: '...Не уходи... Остался последний шаг в кладовой...',
                duration: 3.2,
              },
            ],
            sfx: 'locked',
            shouldSave: true,
          };
        }
        state.player.zone = 'forest';
        state.player.x = item.targetX ?? 2345;
        state.player.y = item.targetY ?? FOREST_GROUND_Y;
        state.player.vx = 0;
        return {
          dialogues: [
            { speaker: 'thought', text: 'На улице по-прежнему льёт холодный дождь.', duration: 2.8 },
          ],
          sfx: 'door',
          shouldSave: false,
        };
      }
      break;
    }

    case 'stairs': {
      if (item.targetFloor !== undefined) {
        state.player.floor = item.targetFloor;
        state.player.x = item.targetX ?? state.player.x;
        state.player.y = item.targetY ?? getHouseFloorY(item.targetFloor);
        state.player.vx = 0;
        return {
          dialogues: [],
          sfx: 'door',
          shouldSave: false,
        };
      }
      break;
    }

    case 'part': {
      if (item.partId) {
        const def = PART_BY_ID[item.partId];
        if (!def) break;
        const alreadyOwned =
          state.collectedParts.includes(item.partId) || state.installedParts.includes(item.partId);
        if (alreadyOwned) {
          return {
            dialogues: [{ speaker: 'thought', text: 'Эту деталь я уже забрал.', duration: 2.2 }],
            sfx: 'none',
            shouldSave: false,
          };
        }
        state.collectedParts.push(item.partId);
        pushObservationUnique(state, `Найдена деталь: ${def.name} (${def.locationHint}).`);
        return {
          dialogues: [
            { speaker: 'thought', text: `Подобрана деталь: ${def.name}.`, duration: 3.0 },
          ],
          sfx: 'pickup',
          shouldSave: true,
        };
      }
      break;
    }

    case 'note': {
      if (item.noteId) {
        const firstPickup = !state.collectedNotes.includes(item.noteId);
        if (firstPickup) {
          state.collectedNotes.push(item.noteId);
          const note = ALL_NOTES.find((n) => n.id === item.noteId);
          if (note) {
            pushObservationUnique(
              state,
              note.isBonus
                ? `Найден архивный документ: «${note.title}».`
                : `Прочитана записка №${note.number}: «${note.title}».`
            );
          }
        }
        return {
          dialogues: [],
          openOverlay: 'journal',
          selectedNoteId: item.noteId,
          sfx: firstPickup ? 'paper' : 'none',
          shouldSave: firstPickup,
        };
      }
      break;
    }

    case 'audio_tape': {
      if (item.tapeId) {
        const tapeId: AudioTapeId = item.tapeId;
        const firstPickup = !state.collectedTapes.includes(tapeId);
        const tape = AUDIO_TAPES.find((t) => t.id === tapeId);
        if (firstPickup) {
          state.collectedTapes.push(tapeId);
          if (tape) {
            pushObservationUnique(
              state,
              `Найдена аудиокассета №${tape.number}: «${tape.title}» (${tape.locationLabel}).`
            );
          }
        }
        return {
          dialogues: [
            {
              speaker: 'tape',
              text: firstPickup
                ? tape
                  ? `Найдена аудиокассета №${tape.number} «${tape.title}». Расшифровка доступна в журнале [J].`
                  : 'Найдена аудиокассета.'
                : 'Эта аудиокассета уже сохранена в журнале [J].',
              duration: 3.6,
            },
          ],
          sfx: firstPickup ? 'tape' : 'none',
          shouldSave: firstPickup,
        };
      }
      break;
    }

    case 'hiding_spot': {
      const res = toggleHidingSpot(state, item.id);
      return {
        dialogues: [res.dialogue],
        sfx: 'hide',
        shouldSave: false,
      };
    }

    case 'key': {
      if (item.keyId) {
        const firstPickup = !state.collectedKeys.includes(item.keyId);
        const label = KEY_LABELS[item.keyId] ?? item.label;
        if (firstPickup) {
          state.collectedKeys.push(item.keyId);
          pushObservationUnique(state, `Найден предмет: ${label}.`);
        }
        return {
          dialogues: [
            {
              speaker: 'thought',
              text: firstPickup ? `Взял: ${label}.` : `${label} уже у меня.`,
              duration: 3.0,
            },
          ],
          sfx: firstPickup ? 'pickup' : 'none',
          shouldSave: firstPickup,
        };
      }
      break;
    }

    case 'container': {
      if (!state.openedContainers.includes(item.id)) {
        state.openedContainers.push(item.id);
      }
      return {
        dialogues: [],
        openOverlay: 'container',
        activeContainerId: item.id,
        sfx: 'door',
        shouldSave: false,
      };
    }

    case 'safe': {
      return {
        dialogues: [],
        openOverlay: 'safe',
        sfx: 'door',
        shouldSave: false,
      };
    }

    case 'clock_puzzle': {
      return {
        dialogues: [],
        openOverlay: 'clock',
        sfx: 'door',
        shouldSave: false,
      };
    }

    case 'terminal_puzzle': {
      return {
        dialogues: [],
        openOverlay: 'terminal',
        sfx: 'tape',
        shouldSave: false,
      };
    }

    case 'breaker_puzzle': {
      return {
        dialogues: [],
        openOverlay: 'breaker',
        sfx: 'door',
        shouldSave: false,
      };
    }

    case 'radio_tuner': {
      return {
        dialogues: [],
        openOverlay: 'radio',
        sfx: 'door',
        shouldSave: false,
      };
    }

    case 'secret_trigger': {
      if (item.secretId) {
        const isNew = !state.discoveredSecrets.includes(item.secretId);
        if (isNew) {
          state.discoveredSecrets.push(item.secretId);
          const sec = SECRETS.find((s) => s.id === item.secretId);
          if (sec) {
            pushObservationUnique(state, `Открыт тайник: ${sec.name}.`);
          }
        }
        if (item.keyId) {
          const isNewKey = !state.collectedKeys.includes(item.keyId);
          if (isNewKey) {
            state.collectedKeys.push(item.keyId);
            const keyName = KEY_LABELS[item.keyId] ?? 'предмет';
            dialogues.push({
              speaker: 'thought',
              text: `Скрытый ящик открыт! Внутри нашёлся ${keyName.toLowerCase()}.`,
              duration: 3.5,
            });
            return { dialogues, sfx: 'secret', shouldSave: true };
          }
        }
        if (item.targetFloor !== undefined) {
          state.player.floor = item.targetFloor;
          state.player.x = item.targetX ?? state.player.x;
          state.player.y = item.targetY ?? getHouseFloorY(item.targetFloor);
          state.player.vx = 0;
          dialogues.push({
            speaker: 'thought',
            text: isNew
              ? 'За вентиляционной решёткой оказался потайной лаз...'
              : 'Пролез через вентиляцию в скрытую комнату.',
            duration: 3.2,
          });
          return { dialogues, sfx: 'secret', shouldSave: isNew };
        }
        if (isNew && item.batteryCount && item.batteryCount > 0) {
          state.player.batteries += item.batteryCount;
        }
        const sec = SECRETS.find((s) => s.id === item.secretId);
        const batteryNote =
          isNew && item.batteryCount && item.batteryCount > 0
            ? ` Также найдена запасная батарейка (${item.batteryCount} шт.).`
            : '';
        dialogues.push({
          speaker: 'thought',
          text: isNew
            ? `Тайник обнаружен: ${sec?.description ?? item.label}${batteryNote}`
            : sec?.description ?? item.label,
          duration: 4.2,
        });
        return { dialogues, sfx: isNew ? 'secret' : 'none', shouldSave: isNew };
      }
      break;
    }

    case 'robot_workbench': {
      if (!state.robotFirstMet) {
        state.robotFirstMet = true;
        pushObservationUnique(
          state,
          'В кладовой стоит полуразобранная кукла-робот. Она попросила найти восемь недостающих узлов.'
        );
        const lines = getRobotDialogueForStage(0, false);
        return {
          dialogues: lines.map((text) => ({ speaker: 'robot', text, duration: 3.4 })),
          sfx: 'robot',
          shouldSave: true,
        };
      }
      if (state.installedParts.length >= 8) {
        startFinale(state);
        return {
          dialogues: [],
          sfx: 'finale',
          shouldSave: true,
        };
      }
      return {
        dialogues: [],
        openOverlay: 'assembly',
        sfx: 'robot',
        shouldSave: false,
      };
    }

    case 'inspect': {
      if (item.inspectId) {
        if (!state.inspectedObjects.includes(item.inspectId)) {
          state.inspectedObjects.push(item.inspectId);
        }
        if (item.id === 'f1_phone') {
          const firstListen = !state.phoneListened;
          state.phoneListened = true;
          if (!state.collectedTapes.includes('tape_01')) {
            state.collectedTapes.push('tape_01');
          }
          if (firstListen) {
            pushObservationUnique(
              state,
              'Автоответчик (прихожая): последняя запись сделана в 23:45 — инженер упомянул часы в коридоре 2-го этажа.'
            );
          }
          return {
            dialogues: [],
            openOverlay: 'inspect',
            activeInspectId: item.inspectId,
            sfx: 'tape',
            shouldSave: firstListen,
          };
        }
        return {
          dialogues: [],
          openOverlay: 'inspect',
          activeInspectId: item.inspectId,
          sfx: 'none',
          shouldSave: false,
        };
      }
      const stage = state.installedParts.length;
      const text =
        item.inspectTextAfterStage && stage >= item.inspectTextAfterStage.minInstalled
          ? item.inspectTextAfterStage.text
          : item.inspectText ?? 'Ничего необычного.';
      return {
        dialogues: [{ speaker: 'thought', text, duration: 3.8 }],
        sfx: 'none',
        shouldSave: false,
      };
    }
  }

  return { dialogues: [], sfx: 'none', shouldSave: false };
}

function findUndiscoveredFloorClueX(state: GameState): number | null {
  for (const item of WORLD_INTERACTABLES) {
    if (item.zone !== 'house' || item.floor !== state.player.floor) continue;
    if (!isInteractableAvailable(state, item)) continue;
    if (item.kind === 'part' || item.kind === 'note' || item.kind === 'audio_tape') {
      if (Math.abs(item.x - state.player.x) > 85 && Math.abs(item.x - state.player.x) < 260) {
        return item.x;
      }
    }
  }
  return null;
}

export function updateShadowEncounter(
  state: GameState,
  rawDt: number,
  difficulty: DifficultyMode = 'standard'
): { startled: boolean; evaded: boolean; spawned: boolean; guided: boolean; behavior: ShadowBehavior } {
  const dt = clampDt(rawDt);
  const diff = getDifficultyProfile(difficulty);
  const sh = state.shadowEncounter;
  if (state.player.zone !== 'house' || state.finale.active || state.installedParts.length < 4) {
    sh.active = false;
    sh.exposure = 0;
    return { startled: false, evaded: false, spawned: false, guided: false, behavior: sh.behavior };
  }

  if (!sh.active) {
    sh.cooldown = Math.max(0, sh.cooldown - dt);
    sh.hideTimer = 0;
    if (sh.cooldown <= 0 && (state.player.floor === 2 || state.player.floor === 3 || state.player.floor === 0)) {
      const bounds = getHorizontalBounds(state);
      const minSpawnX = bounds.minX + 18;
      const maxSpawnX = bounds.maxX - 18;
      const clueX = findUndiscoveredFloorClueX(state);
      const roll = Math.abs(Math.sin(state.playTimeSeconds * 3.7 + state.player.x * 0.05));
      if (
        clueX !== null &&
        clueX >= minSpawnX &&
        clueX <= maxSpawnX &&
        !sh.guideHintShown &&
        roll > 0.72
      ) {
        sh.active = true;
        sh.floor = state.player.floor;
        sh.x = clueX;
        sh.exposure = 0;
        sh.hideTimer = 0;
        sh.behavior = 'guide';
        sh.guideTargetX = clueX;
        sh.guideHintShown = true;
        return { startled: false, evaded: false, spawned: true, guided: true, behavior: 'guide' };
      }

      const rawTarget = state.player.x + state.player.facing * 150;
      const fallbackTarget = state.player.x - state.player.facing * 150;
      const targetX =
        rawTarget >= minSpawnX && rawTarget <= maxSpawnX
          ? rawTarget
          : fallbackTarget >= minSpawnX && fallbackTarget <= maxSpawnX
            ? fallbackTarget
            : null;
      if (targetX !== null && Math.abs(targetX - state.player.x) >= 95) {
        const behaviors: ShadowBehavior[] = ['stalk', 'observe', 'light_react'];
        const picked = behaviors[Math.floor(roll * 3) % behaviors.length] ?? 'stalk';
        sh.active = true;
        sh.floor = state.player.floor;
        sh.x = targetX;
        sh.exposure = 0;
        sh.hideTimer = 0;
        sh.behavior = picked;
        return { startled: false, evaded: false, spawned: true, guided: false, behavior: picked };
      }
    }
    return { startled: false, evaded: false, spawned: false, guided: false, behavior: sh.behavior };
  }

  if (sh.behavior === 'guide') {
    const dist = Math.abs(state.player.x - sh.x);
    if (state.player.floor !== sh.floor || dist < 54 || dist > 300) {
      sh.active = false;
      sh.exposure = 0;
      sh.hideTimer = 0;
      sh.cooldown = Math.max(12, 22 + diff.shadowCooldownDelta);
      return { startled: false, evaded: false, spawned: false, guided: false, behavior: 'guide' };
    }
    return { startled: false, evaded: false, spawned: false, guided: false, behavior: 'guide' };
  }

  const bounds = getHorizontalBounds(state);
  if (
    state.player.floor !== sh.floor ||
    Math.abs(state.player.x - sh.x) > 260 ||
    sh.x < bounds.minX ||
    sh.x > bounds.maxX
  ) {
    sh.active = false;
    sh.exposure = 0;
    sh.hideTimer = 0;
    sh.cooldown = Math.max(12, 18 + diff.shadowCooldownDelta);
    return { startled: false, evaded: true, spawned: false, guided: false, behavior: sh.behavior };
  }

  if (state.player.isHiding) {
    sh.exposure = Math.max(0, sh.exposure - dt * 1.2);
    sh.hideTimer = (sh.hideTimer ?? 0) + dt * 1.4;
    if (sh.hideTimer >= 1.4) {
      sh.active = false;
      sh.exposure = 0;
      sh.hideTimer = 0;
      sh.cooldown = Math.max(12, 25 + diff.shadowCooldownDelta);
      return { startled: false, evaded: true, spawned: false, guided: false, behavior: sh.behavior };
    }
    return { startled: false, evaded: false, spawned: false, guided: false, behavior: sh.behavior };
  }

  const dist = Math.abs(state.player.x - sh.x);
  const facingToward =
    (sh.x > state.player.x && state.player.facing === 1) ||
    (sh.x < state.player.x && state.player.facing === -1);

  if (sh.behavior === 'stalk' && !facingToward && dist > 68) {
    const stepDir = state.player.x > sh.x ? 1 : -1;
    sh.x = Math.max(bounds.minX + 12, Math.min(bounds.maxX - 12, sh.x + stepDir * 14 * dt));
  }

  const shiningOnIt =
    state.player.hasFlashlight &&
    state.player.flashlightOn &&
    facingToward &&
    dist < 165 &&
    !state.player.isCrouching;

  if (shiningOnIt) {
    const baseRate = sh.behavior === 'light_react' ? 0.96 : sh.behavior === 'observe' ? 0.55 : 0.72;
    sh.hideTimer = 0;
    sh.exposure += dt * baseRate * diff.shadowExposureScale;
    if (sh.exposure >= 1) {
      sh.active = false;
      sh.exposure = 0;
      sh.hideTimer = 0;
      sh.cooldown = Math.max(12, 26 + diff.shadowCooldownDelta);
      state.player.startledTimer = 0.65;
      state.player.stamina = Math.max(0, state.player.stamina - 35);
      state.player.exhausted = state.player.stamina < 20;
      return { startled: true, evaded: false, spawned: false, guided: false, behavior: sh.behavior };
    }
  } else {
    sh.exposure = Math.max(0, sh.exposure - dt * 0.45);
    if (state.player.isCrouching || !state.player.flashlightOn) {
      sh.hideTimer = (sh.hideTimer ?? 0) + dt;
      if (dist < 64 && sh.hideTimer >= 1.1) {
        sh.active = false;
        sh.exposure = 0;
        sh.hideTimer = 0;
        sh.cooldown = Math.max(12, 24 + diff.shadowCooldownDelta);
        return { startled: false, evaded: true, spawned: false, guided: false, behavior: sh.behavior };
      }
    }
  }
  return { startled: false, evaded: false, spawned: false, guided: false, behavior: sh.behavior };
}
