export const CURRENT_SAVE_VERSION = 4;

export interface SaveMigrationReport {
  payload: Record<string, unknown>;
  migratedFrom: number;
  migratedTo: number;
  stepsApplied: string[];
  warnings: string[];
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === 'string');
}

function migrateV1ToV2(data: Record<string, unknown>, warnings: string[]): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data, saveVersion: 2 };
  if (!Array.isArray(next.discoveredSecrets)) {
    next.discoveredSecrets = [];
  }
  if (!Array.isArray(next.visitedRooms)) {
    next.visitedRooms = [];
  }
  if (!Array.isArray(next.seenDialogues)) {
    next.seenDialogues = [];
  }
  if (!Array.isArray(next.journalObservations)) {
    next.journalObservations = [];
  }
  if (!next.horror || typeof next.horror !== 'object') {
    next.horror = {
      mood: 'calm',
      tension: 12,
      cooldown: 10,
      aftermathTimer: 0,
      roomDwellTime: 0,
      lastRoomId: null,
      triggeredAnomalies: [],
      flickerTimer: 0,
    };
  }
  if (typeof next.breakerFixed !== 'boolean') {
    next.breakerFixed = false;
  }
  if (typeof next.radioTunedSecret !== 'boolean') {
    next.radioTunedSecret = false;
  }
  // Legacy v1 saves sometimes had notes in notesFound without collectedNotes array normalization
  if (!Array.isArray(next.collectedNotes)) {
    next.collectedNotes = [];
    warnings.push('v1->v2: initialized missing collectedNotes');
  }
  return next;
}

function migrateV2ToV3(data: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data, saveVersion: 3 };
  if (!Array.isArray(next.collectedTapes)) {
    next.collectedTapes = [];
  }
  if (!Array.isArray(next.inspectedObjects)) {
    next.inspectedObjects = [];
  }
  if (!Array.isArray(next.openedContainers)) {
    next.openedContainers = [];
  }
  if (!Array.isArray(next.lootedContainers)) {
    next.lootedContainers = [];
  }
  if (!next.atmospheric || typeof next.atmospheric !== 'object') {
    next.atmospheric = {
      forestSilhouetteSeen: false,
      rainPausedTriggered: false,
      tvStaticTriggered: false,
      portraitChanged: false,
      mannequinMoved: false,
      hallwaySilhouetteSeen: false,
      doorRelockedOnce: false,
    };
  }
  return next;
}

function migrateV3ToV4(data: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data, saveVersion: 4 };
  if (!Array.isArray(next.readNoteIds)) {
    // Existing collected notes in v3 are marked read to prevent phantom unread badges after upgrade
    next.readNoteIds = asStringArray(next.collectedNotes);
  }
  if (!Array.isArray(next.readTapeIds)) {
    next.readTapeIds = asStringArray(next.collectedTapes);
  }
  if (!Array.isArray(next.discoveredRadioSignals)) {
    next.discoveredRadioSignals = [];
  }
  return next;
}

/**
 * Runs explicit sequential migrations from any legacy version (v1..v4) up to CURRENT_SAVE_VERSION.
 */
export function migrateSavePayload(raw: unknown): SaveMigrationReport | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.player || typeof obj.player !== 'object' || !Array.isArray(obj.installedParts)) {
    return null;
  }

  const rawVersion =
    typeof obj.saveVersion === 'number' && Number.isFinite(obj.saveVersion)
      ? Math.max(1, Math.floor(obj.saveVersion))
      : 1;

  let current: Record<string, unknown> = { ...obj };
  const stepsApplied: string[] = [];
  const warnings: string[] = [];

  let version = rawVersion;
  if (version > CURRENT_SAVE_VERSION) {
    warnings.push(`Future save version v${version} clamped to v${CURRENT_SAVE_VERSION}`);
    version = CURRENT_SAVE_VERSION;
  }

  if (version < 2) {
    current = migrateV1ToV2(current, warnings);
    stepsApplied.push('v1->v2');
    version = 2;
  }
  if (version < 3) {
    current = migrateV2ToV3(current);
    stepsApplied.push('v2->v3');
    version = 3;
  }
  if (version < 4) {
    current = migrateV3ToV4(current);
    stepsApplied.push('v3->v4');
    version = 4;
  }

  current.saveVersion = CURRENT_SAVE_VERSION;
  return {
    payload: current,
    migratedFrom: rawVersion,
    migratedTo: CURRENT_SAVE_VERSION,
    stepsApplied,
    warnings,
  };
}
