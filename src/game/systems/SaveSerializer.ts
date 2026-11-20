import {
  ALL_NOTES,
  AUDIO_TAPES,
  KEY_LABELS,
  PART_BY_ID,
  ROOM_RADIO_SIGNALS,
  SECRETS,
} from '../content';
import { createInitialHorrorState } from '../horrorDirector';
import { CURRENT_SAVE_VERSION, migrateSavePayload } from '../saveMigration';
import { AudioTapeId, GameState, KeyItemId, PartId } from '../types';
import {
  FOREST_GROUND_Y,
  FOREST_MAX_X,
  FOREST_MIN_X,
  getFloorBounds,
  getHouseFloorY,
  HOUSE_ROOMS,
} from '../world';

const VALID_PART_IDS = new Set<string>(Object.keys(PART_BY_ID));
const VALID_NOTE_IDS = new Set<string>(ALL_NOTES.map((n) => n.id));
const VALID_TAPE_IDS = new Set<string>(AUDIO_TAPES.map((t) => t.id));
const VALID_KEY_IDS = new Set<string>(Object.keys(KEY_LABELS));
const VALID_SECRET_IDS = new Set<string>(SECRETS.map((s) => s.id));
const VALID_RADIO_SIGNAL_IDS = new Set<string>(ROOM_RADIO_SIGNALS.map((r) => r.id));
const VALID_ROOM_IDS = new Set<string>(HOUSE_ROOMS.map((r) => r.id));

export function createInitialGameState(skipPrologue = false): GameState {
  return {
    saveVersion: 4,
    screen: 'title',
    prologue: skipPrologue
      ? {
          phase: 'done',
          distance: 1,
          speed: 0,
          ignitionAttempts: 3,
          radioBroken: true,
          headlightFlicker: 0,
        }
      : {
          phase: 'driving',
          distance: 0,
          speed: 1,
          ignitionAttempts: 0,
          radioBroken: false,
          headlightFlicker: 0,
        },
    player: {
      zone: skipPrologue ? 'forest' : 'car_prologue',
      floor: 1,
      x: skipPrologue ? 105 : 140,
      y: FOREST_GROUND_Y,
      vx: 0,
      facing: 1,
      stamina: 100,
      exhausted: false,
      flashlightOn: false,
      hasFlashlight: false,
      flashlightBattery: 100,
      batteries: 1,
      walkCycle: 0,
      isRunning: false,
      isCrouching: false,
      isHiding: false,
      hidingSpotId: null,
      interactAnimTimer: 0,
      startledTimer: 0,
    },
    collectedParts: [],
    installedParts: [],
    collectedNotes: [],
    readNoteIds: [],
    collectedKeys: [],
    collectedTapes: [],
    readTapeIds: [],
    discoveredRadioSignals: [],
    discoveredSecrets: [],
    visitedRooms: [],
    seenDialogues: [],
    inspectedObjects: [],
    openedContainers: [],
    lootedContainers: [],
    safeUnlocked: false,
    clockSolved: false,
    terminalSolved: false,
    phoneListened: false,
    breakerFixed: false,
    radioTunedSecret: false,
    shadowEncounter: {
      active: false,
      floor: 2,
      x: 600,
      exposure: 0,
      cooldown: 12,
      behavior: 'stalk',
    },
    horror: createInitialHorrorState(),
    journalObservations: skipPrologue
      ? ['Машина заглохла на лесной дороге. Вдали виден слабый свет.']
      : [],
    atmospheric: {
      forestSilhouetteSeen: false,
      rainPausedTriggered: false,
      tvStaticTriggered: false,
      portraitChanged: false,
      mannequinMoved: false,
      hallwaySilhouetteSeen: false,
      doorRelockedOnce: false,
    },
    finale: {
      active: false,
      phase: 'rising',
      timer: 0,
      redOverlay: 0,
      blueOverlay: 0,
      blackOverlay: 0,
      robotOffsetX: 0,
      selectedEnding: null,
    },
    playTimeSeconds: 0,
    robotFirstMet: false,
    activeDialogue: null,
    dialogueQueue: [],
    activeOverlay: 'none',
    activeContainerId: null,
    activeInspectId: null,
    selectedNoteId: null,
    lastSaveTimestamp: null,
  };
}

function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function serializeGameState(state: GameState): string {
  const snapshot: Record<string, unknown> = {
    ...state,
    saveVersion: CURRENT_SAVE_VERSION,
    screen: 'playing',
    activeOverlay: 'none',
    activeContainerId: null,
    activeInspectId: null,
    selectedNoteId: null,
    activeDialogue: null,
    dialogueQueue: [],
    lastSaveTimestamp: Date.now(),
  };
  delete snapshot._checksum;
  const body = JSON.stringify(snapshot);
  snapshot._checksum = fnv1aHash(body);
  return JSON.stringify(snapshot);
}

function finiteOr(val: unknown, fallback: number, min?: number, max?: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  let out = val;
  if (min !== undefined && out < min) out = min;
  if (max !== undefined && out > max) out = max;
  return out;
}

function uniqueValidStrings<T extends string>(val: unknown, allowlist?: ReadonlySet<string>): T[] {
  if (!Array.isArray(val)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of val) {
    if (typeof item !== 'string') continue;
    if (allowlist && !allowlist.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item as T);
  }
  return out;
}

export function deserializeGameState(raw: string): GameState | null {
  try {
    const rawParsed = JSON.parse(raw) as unknown;
    if (
      rawParsed &&
      typeof rawParsed === 'object' &&
      !Array.isArray(rawParsed) &&
      typeof (rawParsed as { _checksum?: unknown })._checksum === 'string'
    ) {
      const { _checksum, ...withoutChecksum } = rawParsed as Record<string, unknown>;
      if (fnv1aHash(JSON.stringify(withoutChecksum)) !== _checksum) {
        return null;
      }
    }
    const migrated = migrateSavePayload(rawParsed);
    if (!migrated) {
      return null;
    }
    const parsed = migrated.payload as Partial<GameState> & { _checksum?: unknown };
    if (!parsed || !parsed.player || !Array.isArray(parsed.installedParts)) {
      return null;
    }
    const base = createInitialGameState(true);
    const zone =
      parsed.player.zone === 'car_prologue' ||
      parsed.player.zone === 'forest' ||
      parsed.player.zone === 'house'
        ? parsed.player.zone
        : base.player.zone;
    const rawFloor = finiteOr(parsed.player.floor, base.player.floor, 0, 4);
    const floor = Math.round(rawFloor) as GameState['player']['floor'];
    const facing = parsed.player.facing === -1 || parsed.player.facing === 1 ? parsed.player.facing : 1;

    const floorBounds = getFloorBounds(floor);
    const minValidX = zone === 'house' ? floorBounds.minX : FOREST_MIN_X;
    const maxValidX = zone === 'house' ? floorBounds.maxX : FOREST_MAX_X;
    const defaultY = zone === 'house' ? getHouseFloorY(floor) : FOREST_GROUND_Y;

    const shadowBehavior =
      parsed.shadowEncounter?.behavior === 'stalk' ||
      parsed.shadowEncounter?.behavior === 'observe' ||
      parsed.shadowEncounter?.behavior === 'light_react' ||
      parsed.shadowEncounter?.behavior === 'guide'
        ? parsed.shadowEncounter.behavior
        : 'stalk';

    const prologuePhase =
      parsed.prologue?.phase === 'driving' ||
      parsed.prologue?.phase === 'sputtering' ||
      parsed.prologue?.phase === 'stalled' ||
      parsed.prologue?.phase === 'trunk_opened' ||
      parsed.prologue?.phase === 'done'
        ? parsed.prologue.phase
        : base.prologue.phase;

    const horrorMood =
      parsed.horror?.mood === 'calm' ||
      parsed.horror?.mood === 'unease' ||
      parsed.horror?.mood === 'suspense' ||
      parsed.horror?.mood === 'threat' ||
      parsed.horror?.mood === 'peak' ||
      parsed.horror?.mood === 'aftermath'
        ? parsed.horror.mood
        : base.horror.mood;

    const installedParts = uniqueValidStrings<PartId>(parsed.installedParts, VALID_PART_IDS);
    const installedSet = new Set<string>(installedParts);
    const collectedParts = uniqueValidStrings<PartId>(parsed.collectedParts, VALID_PART_IDS).filter(
      (id) => !installedSet.has(id)
    );
    const collectedNotes = uniqueValidStrings<string>(parsed.collectedNotes, VALID_NOTE_IDS);
    const collectedNotesSet = new Set<string>(collectedNotes);
    const readNoteIds = uniqueValidStrings<string>(parsed.readNoteIds, VALID_NOTE_IDS).filter((id) =>
      collectedNotesSet.has(id)
    );
    const collectedTapes = uniqueValidStrings<AudioTapeId>(parsed.collectedTapes, VALID_TAPE_IDS);
    const collectedTapesSet = new Set<string>(collectedTapes);
    const readTapeIds = uniqueValidStrings<AudioTapeId>(parsed.readTapeIds, VALID_TAPE_IDS).filter((id) =>
      collectedTapesSet.has(id)
    );
    const rawObs = uniqueValidStrings<string>(parsed.journalObservations);
    const journalObservations = rawObs.slice(-80);
    const discoveredSecrets = uniqueValidStrings<string>(parsed.discoveredSecrets, VALID_SECRET_IDS);

    const breakerFixed =
      Boolean(parsed.breakerFixed) || discoveredSecrets.includes('secret_basement_vent');

    const sanitized: GameState = {
      ...base,
      ...parsed,
      saveVersion: CURRENT_SAVE_VERSION,
      safeUnlocked: Boolean(parsed.safeUnlocked),
      clockSolved: Boolean(parsed.clockSolved),
      terminalSolved: Boolean(parsed.terminalSolved),
      phoneListened: Boolean(parsed.phoneListened),
      breakerFixed,
      radioTunedSecret: Boolean(parsed.radioTunedSecret),
      robotFirstMet: Boolean(parsed.robotFirstMet),
      playTimeSeconds: finiteOr(parsed.playTimeSeconds, 0, 0),
      player: {
        ...base.player,
        ...parsed.player,
        zone,
        floor,
        x: finiteOr(parsed.player.x, zone === 'house' ? floorBounds.minX + 60 : base.player.x, minValidX, maxValidX),
        y: zone === 'house' ? defaultY : finiteOr(parsed.player.y, defaultY, 0, 1200),
        vx: 0,
        facing,
        stamina: finiteOr(parsed.player.stamina, 100, 0, 100),
        flashlightBattery: finiteOr(parsed.player.flashlightBattery, 100, 0, 100),
        batteries: Math.max(0, Math.round(finiteOr(parsed.player.batteries, base.player.batteries, 0, 99))),
        hasFlashlight: Boolean(parsed.player.hasFlashlight),
        flashlightOn: Boolean(parsed.player.flashlightOn) && Boolean(parsed.player.hasFlashlight),
        isCrouching: false,
        isRunning: false,
        isHiding: false,
        hidingSpotId: null,
        interactAnimTimer: finiteOr(parsed.player.interactAnimTimer, 0, 0, 5),
        startledTimer: finiteOr(parsed.player.startledTimer, 0, 0, 5),
        exhausted: Boolean(parsed.player.exhausted),
        walkCycle: 0,
      },
      prologue: {
        ...base.prologue,
        ...(parsed.prologue ?? {}),
        phase: prologuePhase,
        distance: finiteOr(parsed.prologue?.distance, base.prologue.distance, 0, 1),
        speed: finiteOr(parsed.prologue?.speed, 0, 0, 300),
        ignitionAttempts: Math.max(0, Math.round(finiteOr(parsed.prologue?.ignitionAttempts, 0, 0))),
        radioBroken: Boolean(parsed.prologue?.radioBroken),
        headlightFlicker: finiteOr(parsed.prologue?.headlightFlicker, 1, 0, 1),
      },
      atmospheric: {
        forestSilhouetteSeen: Boolean(parsed.atmospheric?.forestSilhouetteSeen),
        rainPausedTriggered: Boolean(parsed.atmospheric?.rainPausedTriggered),
        tvStaticTriggered: Boolean(parsed.atmospheric?.tvStaticTriggered),
        portraitChanged: Boolean(parsed.atmospheric?.portraitChanged),
        mannequinMoved: Boolean(parsed.atmospheric?.mannequinMoved),
        hallwaySilhouetteSeen: Boolean(parsed.atmospheric?.hallwaySilhouetteSeen),
        doorRelockedOnce: Boolean(parsed.atmospheric?.doorRelockedOnce),
      },
      shadowEncounter: {
        ...base.shadowEncounter,
        ...(parsed.shadowEncounter ?? {}),
        active: Boolean(parsed.shadowEncounter?.active),
        x: finiteOr(parsed.shadowEncounter?.x, base.shadowEncounter.x, 0, 2000),
        floor: Math.round(finiteOr(parsed.shadowEncounter?.floor, 1, 0, 4)),
        exposure: finiteOr(parsed.shadowEncounter?.exposure, 0, 0, 1),
        cooldown: finiteOr(parsed.shadowEncounter?.cooldown, 18, 0),
        hideTimer: finiteOr(parsed.shadowEncounter?.hideTimer, 0, 0),
        behavior: shadowBehavior,
      },
      horror: {
        ...base.horror,
        ...(parsed.horror ?? {}),
        mood: horrorMood,
        tension: finiteOr(parsed.horror?.tension, 0, 0, 100),
        cooldown: finiteOr(parsed.horror?.cooldown, 12, 0),
        aftermathTimer: finiteOr(parsed.horror?.aftermathTimer, 0, 0),
        roomDwellTime: finiteOr(parsed.horror?.roomDwellTime, 0, 0),
        flickerTimer: finiteOr(parsed.horror?.flickerTimer, 0, 0),
        triggeredAnomalies: uniqueValidStrings<string>(parsed.horror?.triggeredAnomalies),
        recentAnomalies: uniqueValidStrings<string>(parsed.horror?.recentAnomalies),
      },
      finale: {
        ...base.finale,
        ...(parsed.finale ?? {}),
        active: false,
        phase: 'rising',
        timer: 0,
        robotOffsetX: 0,
        redOverlay: 0,
        blueOverlay: 0,
        blackOverlay: 0,
      },
      collectedParts,
      installedParts,
      collectedKeys: uniqueValidStrings<KeyItemId>(parsed.collectedKeys, VALID_KEY_IDS),
      collectedNotes,
      discoveredSecrets,
      journalObservations,
      visitedRooms: uniqueValidStrings<string>(parsed.visitedRooms, VALID_ROOM_IDS),
      seenDialogues: uniqueValidStrings<string>(parsed.seenDialogues),
      collectedTapes,
      readNoteIds,
      readTapeIds,
      discoveredRadioSignals: uniqueValidStrings<string>(
        parsed.discoveredRadioSignals,
        VALID_RADIO_SIGNAL_IDS
      ),
      inspectedObjects: uniqueValidStrings<string>(parsed.inspectedObjects),
      openedContainers: uniqueValidStrings<string>(parsed.openedContainers),
      lootedContainers: uniqueValidStrings<string>(parsed.lootedContainers),
      screen: 'playing',
      activeOverlay: 'none',
      activeContainerId: null,
      activeInspectId: null,
      selectedNoteId: null,
      activeDialogue: null,
      dialogueQueue: [],
    };
    delete (sanitized as GameState & { _checksum?: unknown })._checksum;
    return sanitized;
  } catch {
    return null;
  }
}
