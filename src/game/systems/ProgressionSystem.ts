import { ALL_NOTES, PART_BY_ID } from '../content';
import { canUnlockLastRecordEnding, selectContextualRobotDialogue } from '../dialogueDirector';
import {
  DialogueMessage,
  EndingId,
  GameState,
  PartId,
  RobotState,
  RunSummary,
} from '../types';
import { HOUSE_ROOMS } from '../world';
import { countAllNotes, countCoreNotes } from './InventorySystem';

function clampDt(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return Math.min(0.25, dt);
}

/**
 * Returns lighting stage 0..5 based on installed robot parts (ТЗ §9):
 * 0: 0 parts (almost complete darkness)
 * 1: 1-2 parts (lamp above workbench flickers)
 * 2: 3-4 parts (corridor lamps turn on, electronics work)
 * 3: 5-6 parts (reddish glow, loud hum)
 * 4: 7 parts (almost whole house lit, ominous)
 * 5: 8 parts (final red emergency pulse)
 */
export function getLightingStage(installedCount: number): number {
  if (installedCount <= 0) return 0;
  if (installedCount <= 2) return 1;
  if (installedCount <= 4) return 2;
  if (installedCount <= 6) return 3;
  if (installedCount === 7) return 4;
  return 5;
}

export function getRobotState(
  installedCount: number,
  finaleActive: boolean,
  finalePhase?: string
): RobotState {
  if (finaleActive && finalePhase && finalePhase !== 'rising') {
    return 'red_mode';
  }
  if (installedCount <= 0) return 'disassembled';
  if (installedCount <= 3) return 'partial';
  if (installedCount <= 7) return 'almost';
  return 'assembled';
}

export function getCurrentObjective(state: GameState): string {
  if (state.player.zone === 'car_prologue') {
    return state.prologue.phase === 'stalled'
      ? 'Выйти из машины [W] или проверить зажигание [E]'
      : 'Держать дорогу вперёд';
  }
  if (state.player.zone === 'forest') {
    if (!state.player.hasFlashlight) return 'Найти фонарик в багажнике машины [E]';
    return 'Идти по дороге к светящемуся дому';
  }
  if (!state.robotFirstMet) return 'Осмотреть дом и кладовую на 1-м этаже';
  if (state.finale.active) return 'Эхо-4 пробудилась...';
  if (state.installedParts.length >= 8) return 'Подойти к верстаку в кладовой';
  if (state.installedParts.length + state.collectedParts.length >= 8) {
    return `Вернуться к верстаку — все 8 деталей собраны (${state.collectedParts.length} с собой)`;
  }
  if (state.collectedParts.length >= 2) {
    return `Установить найденные детали на верстаке (${state.collectedParts.length} с собой)`;
  }
  if (!state.phoneListened && !state.clockSolved) {
    return 'Прослушать автоответчик в прихожей (1-й этаж)';
  }
  if (!state.clockSolved && !state.collectedKeys.includes('basement_key')) {
    return 'Выставить 23:45 на напольных часах (2-й этаж)';
  }
  if (!state.safeUnlocked && !state.collectedKeys.includes('tech_key')) {
    return 'Найти код от сейфа в кабинете (2-й этаж)';
  }
  if (!state.collectedKeys.includes('attic_crowbar')) {
    return 'Проверить тайник под лестницей на 1-м этаже';
  }
  if (!state.collectedKeys.includes('fuse') && !state.breakerFixed) {
    return 'Найти предохранитель 15A на кухне (1-й этаж)';
  }
  if (!state.breakerFixed) {
    return 'Починить щиток в подвале и открыть вентиляцию';
  }
  if (!state.terminalSolved) {
    return 'Расшифровать терминал «Эхо-4» на 3-м этаже';
  }
  if (!state.radioTunedSecret) {
    return 'Настроить радиостанцию на мансарде (104.8 МГц)';
  }
  if (state.collectedParts.length > 0) {
    return `Установить детали на верстаке (${state.collectedParts.length} с собой)`;
  }
  return `Собрать детали робота (${state.installedParts.length}/8 установлено)`;
}

export function startFinale(state: GameState): void {
  state.finale = {
    active: true,
    phase: 'rising',
    timer: 0,
    redOverlay: 0,
    blueOverlay: 0,
    blackOverlay: 0,
    robotOffsetX: 0,
    selectedEnding: null,
  };
  state.activeOverlay = 'none';
  state.dialogueQueue = [];
  state.activeDialogue = null;
}

export function installPartOnRobot(
  state: GameState,
  partId: PartId
): {
  success: boolean;
  dialogues: DialogueMessage[];
  triggeredFinale: boolean;
} {
  const def = PART_BY_ID[partId];
  if (!def || !state.collectedParts.includes(partId) || state.installedParts.includes(partId)) {
    return { success: false, dialogues: [], triggeredFinale: false };
  }
  state.collectedParts = state.collectedParts.filter((id) => id !== partId);
  state.installedParts = [...state.installedParts, partId];

  const count = state.installedParts.length;
  state.journalObservations.push(`Установлен узел (${count}/8): ${def.name}.`);

  if (count >= 3) state.atmospheric.tvStaticTriggered = true;
  if (count >= 4) state.atmospheric.portraitChanged = true;
  if (count >= 5) state.atmospheric.mannequinMoved = true;

  if (count >= 8) {
    state.activeOverlay = 'none';
    startFinale(state);
    return {
      success: true,
      dialogues: [],
      triggeredFinale: true,
    };
  }

  const contextualLine = selectContextualRobotDialogue(state);
  return {
    success: true,
    dialogues: [contextualLine],
    triggeredFinale: false,
  };
}

export function chooseFinaleEnding(state: GameState, endingId: EndingId): DialogueMessage {
  const resolvedEnding: EndingId =
    endingId === 'last_record' && !canUnlockLastRecordEnding(state) ? 'awakening' : endingId;
  state.finale.selectedEnding = resolvedEnding;
  state.finale.phase = 'approach';
  state.finale.timer = 0;

  if (resolvedEnding === 'liberation') {
    return {
      speaker: 'robot',
      text: 'Стой... нет, питание... Наконец... тишина...',
      duration: 3.0,
    };
  }
  if (resolvedEnding === 'last_record') {
    return {
      speaker: 'tape',
      text: '«Аварийный архив 104.8 активирован. Я не хотел оставлять тебя одну в темноте... Прощай, Эхо.»',
      duration: 3.6,
    };
  }
  return {
    speaker: 'robot',
    text: 'Теперь ты останешься со мной. Здесь больше не будет тихо.',
    duration: 2.6,
  };
}

export function updateFinale(
  state: GameState,
  rawDt: number
): {
  newDialogue?: DialogueMessage;
  finished: boolean;
} {
  const dt = clampDt(rawDt);
  const f = state.finale;
  if (!f.active) return { finished: false };

  f.timer += dt;

  switch (f.phase) {
    case 'rising':
      if (f.timer >= 2.2) {
        f.phase = 'eye_shift';
        f.timer = 0;
      }
      break;

    case 'eye_shift':
      f.redOverlay = Math.min(0.25, f.timer * 0.14);
      if (f.timer >= 2.0) {
        f.phase = 'dialogue_1';
        f.timer = 0;
        return {
          newDialogue: {
            speaker: 'robot',
            text: 'Ты правда решил, что просто чинишь сломанную вещь?',
            duration: 3.4,
          },
          finished: false,
        };
      }
      break;

    case 'dialogue_1':
      if (f.timer >= 3.6) {
        f.phase = 'dialogue_2';
        f.timer = 0;
        return {
          newDialogue: {
            speaker: 'robot',
            text: 'Спасибо, что не стал слушать чужих предупреждений.',
            duration: 3.4,
          },
          finished: false,
        };
      }
      break;

    case 'dialogue_2':
      if (f.timer >= 3.2) {
        f.phase = 'choice';
        f.timer = 0;
      }
      break;

    case 'choice':
      f.redOverlay = 0.25 + Math.abs(Math.sin(f.timer * 2.2)) * 0.08;
      break;

    case 'approach': {
      const ending = f.selectedEnding ?? 'awakening';
      if (ending === 'awakening') {
        f.robotOffsetX = Math.min(48, f.timer * 24);
        f.redOverlay = Math.min(0.75, 0.25 + f.timer * 0.26);
      } else if (ending === 'liberation') {
        f.redOverlay = Math.max(0, 0.25 - f.timer * 0.16);
        f.blueOverlay = Math.min(0.45, f.timer * 0.22);
      } else {
        f.redOverlay = Math.max(0, 0.25 - f.timer * 0.18);
        f.blueOverlay = Math.min(0.35, f.timer * 0.18);
      }
      if (f.timer >= 2.6) {
        f.phase = 'fade';
        f.timer = 0;
      }
      break;
    }

    case 'fade': {
      const ending = f.selectedEnding ?? 'awakening';
      if (ending === 'awakening') {
        f.redOverlay = Math.min(0.9, 0.75 + f.timer * 0.15);
      } else {
        f.blueOverlay = Math.max(0, f.blueOverlay - dt * 0.25);
      }
      f.blackOverlay = Math.min(1, f.timer * 0.65);
      if (f.timer >= 2.2) {
        f.phase = 'credits';
        f.timer = 0;
        state.screen = 'gameover';
        return { finished: true };
      }
      break;
    }

    case 'credits':
      break;
  }

  return { finished: false };
}

export function buildRunSummary(state: GameState): RunSummary {
  return {
    playTimeSeconds: Math.round(state.playTimeSeconds),
    partsInstalled: state.installedParts.length,
    notesFound: countCoreNotes(state.collectedNotes),
    totalNotesFound: countAllNotes(state.collectedNotes),
    totalNotes: ALL_NOTES.length,
    secretsFound: state.discoveredSecrets.length,
    tapesFound: state.collectedTapes.length,
    roomsVisited: state.visitedRooms.length,
    totalRooms: HOUSE_ROOMS.length,
    endingId: state.finale.selectedEnding ?? 'awakening',
  };
}
