import { SECRETS } from '../content';
import {
  AudioTapeId,
  DialogueMessage,
  GameState,
  InspectTargetId,
  PartId,
  TimelineEntry,
} from '../types';

export const STUDY_SAFE_CODE = '0419';
export const CLOCK_TARGET_HOUR = 23;
export const CLOCK_TARGET_MINUTE = 45;

export function submitSafeCode(
  state: GameState,
  code: string
): {
  success: boolean;
  dialogue: DialogueMessage;
} {
  if (state.safeUnlocked) {
    return {
      success: true,
      dialogue: { speaker: 'thought', text: 'Сейф уже открыт.', duration: 2.2 },
    };
  }
  if (code === STUDY_SAFE_CODE) {
    state.safeUnlocked = true;
    if (!state.collectedKeys.includes('tech_key')) {
      state.collectedKeys.push('tech_key');
    }
    const obs = 'Вскрыт сейф в кабинете (код 0419): получен ключ от тех. кабинета.';
    if (!state.journalObservations.includes(obs)) {
      state.journalObservations.push(obs);
    }
    return {
      success: true,
      dialogue: {
        speaker: 'thought',
        text: 'Замок щёлкнул! Внутри сейфа лежал ключ от технического кабинета на 3-м этаже.',
        duration: 3.8,
      },
    };
  }
  return {
    success: false,
    dialogue: {
      speaker: 'thought',
      text: 'Неверный код... Инженер упоминал дату запуска «Эхо-4» в своих записях.',
      duration: 3.0,
    },
  };
}

export function solveClockPuzzle(state: GameState): {
  alreadySolved: boolean;
  dialogue: DialogueMessage;
} {
  if (state.clockSolved) {
    return {
      alreadySolved: true,
      dialogue: { speaker: 'thought', text: 'Тайник за маятником часов уже пуст.', duration: 2.2 },
    };
  }
  state.clockSolved = true;
  if (!state.collectedKeys.includes('basement_key')) {
    state.collectedKeys.push('basement_key');
  }
  state.player.batteries += 1;
  const obs =
    'Напольные часы (2-й этаж, 23:45): найден ржавый ключ от подвала и запасная батарейка.';
  if (!state.journalObservations.includes(obs)) {
    state.journalObservations.push(obs);
  }
  return {
    alreadySolved: false,
    dialogue: {
      speaker: 'thought',
      text: 'Бой часов отзвучал глухим эхом. За маятником открылся тайник: ключ от подвала и батарейка!',
      duration: 4.0,
    },
  };
}

export function solveTerminalPuzzle(state: GameState): void {
  if (state.terminalSolved) return;
  state.terminalSolved = true;
  const obs =
    'Терминал 3-го этажа: голос и привод изолированы. Обнаружена аварийная частота связи — 104.8 МГц.';
  if (!state.journalObservations.includes(obs)) {
    state.journalObservations.push(obs);
  }
}

export function solveBreakerPuzzle(state: GameState): void {
  if (state.breakerFixed) return;
  state.breakerFixed = true;
  const obs =
    'Переключён электрощиток в подвале: питание вентиляции отключено, лаз открыт.';
  if (!state.journalObservations.includes(obs)) {
    state.journalObservations.push(obs);
  }
}

export function recordRadioSecret(state: GameState): void {
  if (state.radioTunedSecret) return;
  state.radioTunedSecret = true;
  const obs =
    'На чердачной радиостанции (104.8 МГц) поймана экстренная запись инженера: «Не включай Эхо-4».';
  if (!state.journalObservations.includes(obs)) {
    state.journalObservations.push(obs);
  }
}

export function recordInspectHotspotDiscovery(
  state: GameState,
  targetId: InspectTargetId,
  hotspotId: string
): {
  discoveredSecretId?: string;
  collectedTapeId?: AudioTapeId;
  observation?: string;
} {
  const key = `${targetId}:${hotspotId}`;
  const firstTime = !state.inspectedObjects.includes(key);
  if (firstTime) {
    state.inspectedObjects.push(key);
  }

  if (targetId === 'mirror' && hotspotId === 'frame_scratch') {
    const secretId = 'secret_mirror_whisper';
    if (!state.discoveredSecrets.includes(secretId)) {
      state.discoveredSecrets.push(secretId);
      const sec = SECRETS.find((s) => s.id === secretId);
      const obs = `Открыт тайник: ${sec?.name ?? 'Царапина за рамой зеркала'}.`;
      state.journalObservations.push(obs);
      return { discoveredSecretId: secretId, observation: obs };
    }
  }

  if (targetId === 'attic_mannequin' && hotspotId === 'collar_badge') {
    const secretId = 'secret_attic_badge';
    if (!state.discoveredSecrets.includes(secretId)) {
      state.discoveredSecrets.push(secretId);
      const sec = SECRETS.find((s) => s.id === secretId);
      const obs = `Открыт тайник: ${sec?.name ?? 'Бирка прототипа «ЭХО-03»'}.`;
      state.journalObservations.push(obs);
      return { discoveredSecretId: secretId, observation: obs };
    }
  }

  if (targetId === 'phone_tape' && hotspotId === 'cassette_play') {
    const wasNew = !state.collectedTapes.includes('tape_01');
    state.phoneListened = true;
    if (wasNew) {
      state.collectedTapes.push('tape_01');
      return { collectedTapeId: 'tape_01' };
    }
  }

  if (firstTime && targetId === 'portrait' && hotspotId === 'back_inscription') {
    const obs =
      'На обороте портрета в гостиной подписано: «Марина, октябрь. Прости, что не смог отпустить тишину».';
    state.journalObservations.push(obs);
    return { observation: obs };
  }

  if (targetId === 'forest_car' && hotspotId === 'windshield_note' && state.installedParts.length >= 4) {
    const obs =
      'На запотевшем стекле машины изнутри появилась надпись: «ВОЗВРАЩАЙСЯ В КЛАДОВУЮ».';
    if (!state.journalObservations.includes(obs)) {
      state.journalObservations.push(obs);
      return { observation: obs };
    }
  }

  return {};
}

export function isTimelineEntryUnlocked(
  state: {
    collectedNotes: string[];
    collectedTapes: AudioTapeId[];
    installedParts: PartId[];
    phoneListened: boolean;
    clockSolved: boolean;
    safeUnlocked: boolean;
    terminalSolved: boolean;
    breakerFixed: boolean;
    radioTunedSecret: boolean;
  },
  entry: TimelineEntry
): boolean {
  if (entry.unlockByNote && state.collectedNotes.includes(entry.unlockByNote)) return true;
  if (entry.unlockByTape && state.collectedTapes.includes(entry.unlockByTape)) return true;
  if (entry.unlockByInstalled !== undefined && state.installedParts.length >= entry.unlockByInstalled) {
    return true;
  }
  if (entry.unlockByPuzzle) {
    if (entry.unlockByPuzzle === 'phone') return state.phoneListened;
    if (entry.unlockByPuzzle === 'clock') return state.clockSolved;
    if (entry.unlockByPuzzle === 'safe') return state.safeUnlocked;
    if (entry.unlockByPuzzle === 'terminal') return state.terminalSolved;
    if (entry.unlockByPuzzle === 'breaker') return state.breakerFixed;
    if (entry.unlockByPuzzle === 'radio') return state.radioTunedSecret;
  }
  return false;
}
