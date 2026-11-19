import { DialogueMessage, DifficultyMode, GameState, HorrorDirectorState, HorrorMood } from './types';
import { HOUSE_ROOMS } from './world';

export type AnomalySoundKind =
  | 'steps_above'
  | 'knock'
  | 'whisper'
  | 'pipe_clang'
  | 'breath'
  | 'static'
  | 'creak';

const ANOMALY_CAPTION_LABELS: Record<AnomalySoundKind, string> = {
  steps_above: 'скрип половиц сверху',
  knock: 'глухой стук',
  whisper: 'тихий шёпот',
  pipe_clang: 'звон труб отопления',
  breath: 'ровный выдох',
  static: 'всплеск помех',
  creak: 'скрип дерева',
};

export function formatDirectionalSoundCaption(sound: AnomalySoundKind, pan: number): string {
  const direction = pan <= -0.2 ? 'слева' : pan >= 0.2 ? 'справа' : 'рядом';
  return `[Звук ${direction}: ${ANOMALY_CAPTION_LABELS[sound]}]`;
}

export interface AnomalyTriggerResult {
  anomalyId: string;
  sound: AnomalySoundKind;
  pan: number; // -1 (left) .. 1 (right)
  dialogue?: DialogueMessage;
  observation?: string;
  flickerDuration?: number;
  startleDuration?: number;
}

interface AnomalyRule {
  id: string;
  minInstalled: number;
  floors: number[];
  roomIds?: string[];
  minDwell: number;
  sound: AnomalySoundKind;
  pan: number;
  dialogue: DialogueMessage;
  observation: string;
  flickerDuration?: number;
  startleDuration?: number;
}

const ANOMALY_CATALOG: AnomalyRule[] = [
  {
    id: 'anom_steps_above_1f',
    minInstalled: 1,
    floors: [1],
    roomIds: ['f1_living', 'f1_kitchen', 'f1_hall'],
    minDwell: 5.5,
    sound: 'steps_above',
    pan: 0.35,
    dialogue: {
      speaker: 'thought',
      text: 'Над головой скрипнули половицы — будто кто-то неторопливо прошёл по второму этажу.',
      duration: 3.4,
    },
    observation: '1-й этаж: над головой отчётливо скрипнули половицы, хотя в доме никого нет.',
  },
  {
    id: 'anom_knock_locked_tech',
    minInstalled: 2,
    floors: [3],
    roomIds: ['f3_hall', 'f3_lab'],
    minDwell: 4.0,
    sound: 'knock',
    pan: 0.72,
    dialogue: {
      speaker: 'thought',
      text: 'Три глухих стука из-за двери технического кабинета... И снова тишина.',
      duration: 3.4,
    },
    observation: '3-й этаж: кто-то трижды ровно постучал изнутри запертого технического кабинета.',
    startleDuration: 0.25,
  },
  {
    id: 'anom_basement_pipes',
    minInstalled: 2,
    floors: [0],
    roomIds: ['b_boiler', 'b_storage', 'b_electric'],
    minDwell: 4.5,
    sound: 'pipe_clang',
    pan: -0.6,
    dialogue: {
      speaker: 'thought',
      text: 'По трубам прошла резкая металлическая дрожь — словно кто-то ударил по ним за стеной.',
      duration: 3.5,
    },
    observation: 'Подвал: по трубам отопления прошёл размеренный металлический звон, будто кто-то отбивал сигнал с той стороны стены.',
    flickerDuration: 1.4,
  },
  {
    id: 'anom_vent_whisper',
    minInstalled: 3,
    floors: [2],
    roomIds: ['f2_hall', 'f2_bedroom', 'f2_bathroom'],
    minDwell: 5.0,
    sound: 'whisper',
    pan: -0.45,
    dialogue: {
      speaker: 'robot',
      text: '...Я всё ещё здесь... Не задерживайся там слишком долго...',
      duration: 3.3,
    },
    observation: '2-й этаж: тихий голос из кладовой донёсся прямо из вентиляционной решётки под полом.',
    flickerDuration: 1.8,
  },
  {
    id: 'anom_dead_phone_breath',
    minInstalled: 4,
    floors: [1],
    roomIds: ['f1_foyer', 'f1_living'],
    minDwell: 4.0,
    sound: 'breath',
    pan: -0.55,
    dialogue: {
      speaker: 'thought',
      text: 'Из выключенного динамика автоответчика донёсся ровный, чуть хриплый выдох.',
      duration: 3.5,
    },
    observation: 'Прихожая: обесточенный автоответчик вдруг выдохнул из динамика, словно рядом стоял живой человек.',
    startleDuration: 0.3,
  },
  {
    id: 'anom_attic_knock_below',
    minInstalled: 4,
    floors: [4],
    roomIds: ['attic_west', 'attic_center', 'attic_east'],
    minDwell: 5.0,
    sound: 'knock',
    pan: -0.25,
    dialogue: {
      speaker: 'thought',
      text: 'Кто-то тихо постучал в крышку люка снизу. Когда я обернулся — под проёмом было пусто.',
      duration: 3.5,
    },
    observation: 'Мансарда: кто-то негромко постучал снизу в крышку чердачного люка.',
    flickerDuration: 2.0,
    startleDuration: 0.35,
  },
  {
    id: 'anom_power_surge_late',
    minInstalled: 5,
    floors: [1, 2, 3],
    minDwell: 6.0,
    sound: 'static',
    pan: 0.5,
    dialogue: {
      speaker: 'thought',
      text: 'Лампы на миг погасли, и по обоям скользнула вытянутая тень.',
      duration: 3.3,
    },
    observation: 'По всему дому прошёл резкий перепад напряжения — чем больше узлов на верстаке, тем тяжелее дышит проводка.',
    flickerDuration: 2.6,
    startleDuration: 0.3,
  },
  {
    id: 'anom_echo_name_whisper',
    minInstalled: 6,
    floors: [0, 2, 3],
    minDwell: 5.5,
    sound: 'whisper',
    pan: 0.2,
    dialogue: {
      speaker: 'robot',
      text: '...Ты слышишь, как тихо стало в доме?.. Скоро нам больше не понадобятся двери...',
      duration: 3.8,
    },
    observation: 'Голос из кладовой прозвучал так близко, будто кто-то прошептал мне прямо в затылок.',
    flickerDuration: 2.2,
    startleDuration: 0.35,
  },
];

export function createInitialHorrorState(): HorrorDirectorState {
  return {
    mood: 'calm',
    tension: 12,
    cooldown: 14,
    aftermathTimer: 0,
    roomDwellTime: 0,
    lastRoomId: null,
    triggeredAnomalies: [],
    flickerTimer: 0,
  };
}

export function trackVisitedRoom(state: GameState): string | null {
  if (state.player.zone !== 'house') return null;
  const room = HOUSE_ROOMS.find(
    (r) =>
      r.floor === state.player.floor &&
      state.player.x >= r.x &&
      state.player.x <= r.x + r.width
  );
  if (!room) return null;
  if (!state.visitedRooms.includes(room.id)) {
    state.visitedRooms.push(room.id);
  }
  return room.id;
}

function computeMood(state: GameState, tension: number, aftermathTimer: number): HorrorMood {
  if (state.finale.active) return 'peak';
  if (aftermathTimer > 0) return 'aftermath';
  if (state.shadowEncounter.active && state.shadowEncounter.floor === state.player.floor) {
    return 'threat';
  }
  if (tension >= 72) return 'suspense';
  if (tension >= 38) return 'unease';
  return 'calm';
}

export function updateHorrorDirector(
  state: GameState,
  dt: number,
  difficulty: DifficultyMode = 'standard'
): AnomalyTriggerResult | null {
  const h = state.horror;
  const tensionRateScale = difficulty === 'story' ? 0.72 : difficulty === 'tension' ? 1.25 : 1;
  const anomalyCooldown = difficulty === 'story' ? 36 : difficulty === 'tension' ? 21 : 28;
  if (h.flickerTimer > 0) {
    h.flickerTimer = Math.max(0, h.flickerTimer - dt);
  }

  if (state.player.zone !== 'house' || state.finale.active || state.activeOverlay !== 'none') {
    h.mood = computeMood(state, h.tension, h.aftermathTimer);
    return null;
  }

  const roomId = trackVisitedRoom(state);
  if (roomId !== h.lastRoomId) {
    h.lastRoomId = roomId;
    h.roomDwellTime = 0;
  } else if (roomId) {
    h.roomDwellTime += dt;
  }

  if (h.aftermathTimer > 0) {
    h.aftermathTimer = Math.max(0, h.aftermathTimer - dt);
    h.tension = Math.max(18, h.tension - dt * 6);
    h.mood = computeMood(state, h.tension, h.aftermathTimer);
    return null;
  }

  if (h.cooldown > 0) {
    h.cooldown = Math.max(0, h.cooldown - dt);
  }

  // Baseline tension scales smoothly with assembly progress, darkness, and basement/attic depth
  const installed = state.installedParts.length;
  const floorRisk = state.player.floor === 0 || state.player.floor === 4 ? 12 : 4;
  const lightRisk = state.player.flashlightOn ? 0 : 14;
  const targetTension = Math.min(92, 16 + installed * 9 + floorRisk + lightRisk);
  h.tension += (targetTension - h.tension) * Math.min(1, dt * 0.25 * tensionRateScale);

  // Never stack an anomaly on top of active dialogue or active shadow encounter
  const busy =
    Boolean(state.activeDialogue) ||
    (state.shadowEncounter.active && state.shadowEncounter.floor === state.player.floor);

  if (!busy && h.cooldown <= 0 && roomId && roomId !== 'f1_pantry') {
    const candidate = ANOMALY_CATALOG.find(
      (a) =>
        !h.triggeredAnomalies.includes(a.id) &&
        installed >= a.minInstalled &&
        a.floors.includes(state.player.floor) &&
        (!a.roomIds || a.roomIds.includes(roomId)) &&
        h.roomDwellTime >= a.minDwell
    );

    if (candidate) {
      h.triggeredAnomalies.push(candidate.id);
      h.cooldown = anomalyCooldown;
      h.aftermathTimer = 11;
      h.tension = Math.min(96, h.tension + 20);
      if (candidate.flickerDuration) {
        h.flickerTimer = Math.max(h.flickerTimer, candidate.flickerDuration);
      }
      if (candidate.startleDuration) {
        state.player.startledTimer = Math.max(
          state.player.startledTimer,
          candidate.startleDuration
        );
      }
      if (!state.journalObservations.includes(candidate.observation)) {
        state.journalObservations.push(candidate.observation);
      }
      h.mood = 'aftermath';
      return {
        anomalyId: candidate.id,
        sound: candidate.sound,
        pan: candidate.pan,
        dialogue: candidate.dialogue,
        observation: candidate.observation,
        flickerDuration: candidate.flickerDuration,
        startleDuration: candidate.startleDuration,
      };
    }
  }

  h.mood = computeMood(state, h.tension, h.aftermathTimer);
  return null;
}
