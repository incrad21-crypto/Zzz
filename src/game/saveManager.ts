import { ALL_NOTES } from './content';
import { gameDiagnostics } from './diagnostics';
import {
  countAllNotes,
  countCoreNotes,
  deserializeGameState,
  getCurrentRoomName,
  serializeGameState,
} from './rules';
import { CURRENT_SAVE_VERSION, migrateSavePayload } from './saveMigration';
import {
  DifficultyMode,
  EndingId,
  GameSettings,
  GameState,
  KeyAction,
  KeyBindings,
  RenderFpsCap,
  TouchLayout,
  TouchSize,
  UiScale,
} from './types';

export const SAVE_KEY = 'quiet_voice_save_v1';
export const SAVE_BACKUP_KEY = 'quiet_voice_save_backup_v1';
export const SAVE_PRE_MIGRATION_BACKUP_KEY = 'quiet_voice_save_pre_migration_v1';
export const SETTINGS_KEY = 'quiet_voice_settings_v1';
export const ENDINGS_KEY = 'quiet_voice_endings_v1';

export type SaveSlotId = 'slot_1' | 'slot_2' | 'slot_3';
export const SAVE_SLOTS: { id: SaveSlotId; label: string }[] = [
  { id: 'slot_1', label: 'Слот 1' },
  { id: 'slot_2', label: 'Слот 2' },
  { id: 'slot_3', label: 'Слот 3' },
];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface SaveSummaryMeta {
  partsInstalled: number;
  notesFound: number;
  totalNotesFound: number;
  totalNotes: number;
  roomName: string;
  playMinutes: number;
  timestamp?: number;
}

export type SaveErrorCode = 'no_storage' | 'quota_exceeded' | 'write_failed' | 'corrupted';

export type SaveResult =
  | { success: true; timestamp: number; summary: SaveSummaryMeta }
  | { success: false; error: SaveErrorCode; message: string; summary: SaveSummaryMeta };

export interface SaveLoadOutcome {
  state: GameState | null;
  recoveredFromBackup: boolean;
  corruptedPrimary: boolean;
  migratedFrom: number | null;
}

export interface SaveSlotInfo {
  slotId: SaveSlotId;
  label: string;
  summary: SaveSummaryMeta | null;
}

export interface KeyBindingValidationResult {
  bindings: KeyBindings;
  repaired: boolean;
  conflicts: KeyAction[];
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  left: 'KeyA',
  right: 'KeyD',
  up: 'KeyW',
  down: 'KeyS',
  run: 'ShiftLeft',
  interact: 'KeyE',
  flashlight: 'KeyF',
  reload: 'KeyR',
  inventory: 'Tab',
  journal: 'KeyJ',
  map: 'KeyK',
};

const FALLBACK_KEY_POOL = [
  'KeyQ',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
  'KeyG',
  'KeyH',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'Digit1',
  'Digit2',
  'Digit3',
];

export const KEY_ACTION_LABELS: Record<KeyAction, string> = {
  left: 'Идти влево',
  right: 'Идти вправо',
  up: 'Лестница вверх',
  down: 'Присесть / вниз',
  run: 'Бег',
  interact: 'Взаимодействие',
  flashlight: 'Фонарик',
  reload: 'Сменить батарейку',
  inventory: 'Инвентарь',
  journal: 'Журнал',
  map: 'Схема дома',
};

export const KEY_ACTIONS_ORDER: KeyAction[] = [
  'left',
  'right',
  'up',
  'down',
  'run',
  'interact',
  'flashlight',
  'reload',
  'inventory',
  'journal',
  'map',
];

export function formatKeyCode(code: string): string {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  switch (code) {
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'Shift';
    case 'ControlLeft':
    case 'ControlRight':
      return 'Ctrl';
    case 'AltLeft':
    case 'AltRight':
      return 'Alt';
    case 'Space':
      return 'Пробел';
    case 'Tab':
      return 'Tab';
    case 'Enter':
      return 'Enter';
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    default:
      return code.slice(0, 6);
  }
}

export const DEFAULT_SETTINGS: GameSettings = {
  muted: false,
  masterVolume: 0.78,
  ambienceVolume: 0.82,
  sfxVolume: 0.9,
  voiceVolume: 0.92,
  subtitleSize: 'medium',
  subtitleBg: true,
  textSpeed: 'normal',
  uiScale: 'normal',
  screenShake: true,
  reduceFlashes: false,
  visualNoise: true,
  soundCaptions: true,
  difficulty: 'standard',
  touchControls: false,
  touchSize: 'medium',
  touchLayout: 'standard',
  renderFpsCap: 0,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function clampUnit(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function sanitizeUiScale(value: unknown): UiScale {
  return value === 'compact' || value === 'normal' || value === 'large' ? value : 'normal';
}

function sanitizeTouchSize(value: unknown): TouchSize {
  return value === 'small' || value === 'medium' || value === 'large' ? value : 'medium';
}

function sanitizeTouchLayout(value: unknown): TouchLayout {
  return value === 'standard' || value === 'swapped' ? value : 'standard';
}

function sanitizeDifficulty(value: unknown): DifficultyMode {
  return value === 'story' || value === 'standard' || value === 'tension' ? value : 'standard';
}

function sanitizeRenderFpsCap(value: unknown): RenderFpsCap {
  return value === 0 || value === 30 || value === 60 || value === 120 ? value : 0;
}

function isValidKeyCodeFormat(val: unknown): val is string {
  return (
    typeof val === 'string' &&
    val.length > 0 &&
    val.length <= 24 &&
    val !== 'Escape' &&
    val !== 'MetaLeft' &&
    val !== 'MetaRight'
  );
}

/**
 * Centralized keybinding validator: rejects duplicate codes, preserves valid custom bindings,
 * repairs conflicts with unused defaults/fallbacks, and reports whether auto-repair occurred.
 */
export function validateAndRepairKeyBindings(raw: unknown): KeyBindingValidationResult {
  const result: KeyBindings = { ...DEFAULT_KEY_BINDINGS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { bindings: result, repaired: false, conflicts: [] };
  }

  const obj = raw as Record<string, unknown>;
  const usedCodes = new Set<string>();
  const needsRepair: KeyAction[] = [];

  for (const action of KEY_ACTIONS_ORDER) {
    const val = obj[action];
    if (isValidKeyCodeFormat(val) && !usedCodes.has(val)) {
      result[action] = val;
      usedCodes.add(val);
    } else {
      needsRepair.push(action);
    }
  }

  const conflicts: KeyAction[] = [];
  for (const action of needsRepair) {
    const rawVal = obj[action];
    if (rawVal !== undefined) {
      conflicts.push(action);
    }
    const defaultCode = DEFAULT_KEY_BINDINGS[action];
    if (!usedCodes.has(defaultCode)) {
      result[action] = defaultCode;
      usedCodes.add(defaultCode);
    } else {
      const replacement = FALLBACK_KEY_POOL.find((code) => !usedCodes.has(code)) ?? defaultCode;
      result[action] = replacement;
      usedCodes.add(replacement);
    }
  }

  return {
    bindings: result,
    repaired: conflicts.length > 0,
    conflicts,
  };
}

export function detectCoarsePointer(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function loadSettingsWithStatus(storage: StorageLike | null = getDefaultStorage()): {
  settings: GameSettings;
  bindingsRepaired: boolean;
  repairedActions: KeyAction[];
} {
  const autoTouch = detectCoarsePointer();
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        settings: {
          ...DEFAULT_SETTINGS,
          touchControls: autoTouch,
          keyBindings: { ...DEFAULT_KEY_BINDINGS },
        },
        bindingsRepaired: false,
        repairedActions: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const kbValidation = validateAndRepairKeyBindings(parsed.keyBindings);
    const settings: GameSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      masterVolume: clampUnit(parsed.masterVolume, DEFAULT_SETTINGS.masterVolume),
      ambienceVolume: clampUnit(parsed.ambienceVolume, DEFAULT_SETTINGS.ambienceVolume),
      sfxVolume: clampUnit(parsed.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      voiceVolume: clampUnit(parsed.voiceVolume, DEFAULT_SETTINGS.voiceVolume),
      uiScale: sanitizeUiScale(parsed.uiScale),
      touchControls:
        typeof parsed.touchControls === 'boolean' ? parsed.touchControls : autoTouch,
      touchSize: sanitizeTouchSize(parsed.touchSize),
      touchLayout: sanitizeTouchLayout(parsed.touchLayout),
      visualNoise:
        typeof parsed.visualNoise === 'boolean' ? parsed.visualNoise : DEFAULT_SETTINGS.visualNoise,
      soundCaptions:
        typeof parsed.soundCaptions === 'boolean'
          ? parsed.soundCaptions
          : DEFAULT_SETTINGS.soundCaptions,
      difficulty: sanitizeDifficulty(parsed.difficulty),
      renderFpsCap: sanitizeRenderFpsCap(parsed.renderFpsCap),
      keyBindings: kbValidation.bindings,
    };
    if (kbValidation.repaired) {
      saveSettings(settings, storage);
    }
    return {
      settings,
      bindingsRepaired: kbValidation.repaired,
      repairedActions: kbValidation.conflicts,
    };
  } catch (err) {
    gameDiagnostics.recordError('saveManager.loadSettings', err, 'warn');
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        touchControls: autoTouch,
        keyBindings: { ...DEFAULT_KEY_BINDINGS },
      },
      bindingsRepaired: false,
      repairedActions: [],
    };
  }
}

export function loadSettings(storage: StorageLike | null = getDefaultStorage()): GameSettings {
  return loadSettingsWithStatus(storage).settings;
}

export function saveSettings(
  settings: GameSettings,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  try {
    if (!storage) return false;
    const validatedKb = validateAndRepairKeyBindings(settings.keyBindings).bindings;
    storage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, keyBindings: validatedKb }));
    return true;
  } catch (err) {
    gameDiagnostics.recordError('saveManager.saveSettings', err, 'warn');
    return false;
  }
}

export function loadUnlockedEndings(storage: StorageLike | null = getDefaultStorage()): EndingId[] {
  try {
    const raw = storage?.getItem(ENDINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is EndingId => id === 'awakening' || id === 'liberation' || id === 'last_record'
    );
  } catch {
    return [];
  }
}

export function saveUnlockedEndings(
  endings: EndingId[],
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(ENDINGS_KEY, JSON.stringify(endings));
    return true;
  } catch (err) {
    gameDiagnostics.recordError('saveManager.saveUnlockedEndings', err, 'warn');
    return false;
  }
}

export function formatSaveTimestamp(timestamp?: number): string | null {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  try {
    const d = new Date(timestamp);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm} · ${hh}:${min}`;
  } catch {
    return null;
  }
}

export function buildSaveSummary(state: GameState, timestamp?: number): SaveSummaryMeta {
  return {
    partsInstalled: state.installedParts.length,
    notesFound: countCoreNotes(state.collectedNotes),
    totalNotesFound: countAllNotes(state.collectedNotes),
    totalNotes: ALL_NOTES.length,
    roomName: getCurrentRoomName(state),
    playMinutes: Math.max(1, Math.round(state.playTimeSeconds / 60)),
    timestamp: timestamp ?? state.lastSaveTimestamp ?? undefined,
  };
}

function classifyStorageError(err: unknown): { code: SaveErrorCode; message: string } {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (
    err instanceof Error &&
    (err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      /quota/i.test(msg))
  ) {
    return {
      code: 'quota_exceeded',
      message: 'Недостаточно памяти хранилища браузера для сохранения',
    };
  }
  return {
    code: 'write_failed',
    message: 'Хранилище браузера недоступно (проверьте приватный режим)',
  };
}

/**
 * Atomic-style save with previous snapshot preserved in backup slot
 * and explicit SaveResult status returned to callers.
 */
export function writeSaveWithBackup(
  state: GameState,
  storage: StorageLike | null = getDefaultStorage()
): SaveResult {
  const serialized = serializeGameState(state);
  const now = Date.now();
  const summary = buildSaveSummary(state, now);

  if (!storage) {
    return {
      success: false,
      error: 'no_storage',
      message: 'Хранилище localStorage недоступно в текущей среде',
      summary,
    };
  }

  try {
    const prev = storage.getItem(SAVE_KEY);
    if (prev && deserializeGameState(prev)) {
      storage.setItem(SAVE_BACKUP_KEY, prev);
    }
    storage.setItem(SAVE_KEY, serialized);
    return { success: true, timestamp: now, summary };
  } catch (err) {
    gameDiagnostics.recordError('saveManager.writeSave', err, 'error');
    const classified = classifyStorageError(err);
    return {
      success: false,
      error: classified.code,
      message: classified.message,
      summary,
    };
  }
}

/**
 * Loads primary save with explicit sequential migration, pre-migration backup preservation,
 * and automatic backup recovery if primary save is corrupted.
 */
export function loadSaveWithRecovery(storage: StorageLike | null = getDefaultStorage()): SaveLoadOutcome {
  if (!storage) {
    return { state: null, recoveredFromBackup: false, corruptedPrimary: false, migratedFrom: null };
  }
  let corruptedPrimary = false;

  try {
    const primaryRaw = storage.getItem(SAVE_KEY);
    if (primaryRaw) {
      let parsedVersion: number | null = null;
      try {
        const rawObj = JSON.parse(primaryRaw) as { saveVersion?: unknown } | null;
        if (rawObj && typeof rawObj === 'object') {
          parsedVersion =
            typeof rawObj.saveVersion === 'number' && Number.isFinite(rawObj.saveVersion)
              ? Math.floor(rawObj.saveVersion)
              : 1;
        }
      } catch {
        corruptedPrimary = true;
      }

      const primary = deserializeGameState(primaryRaw);
      if (primary) {
        let migratedFrom: number | null = null;
        if (parsedVersion !== null && parsedVersion < CURRENT_SAVE_VERSION) {
          migratedFrom = parsedVersion;
          try {
            storage.setItem(SAVE_PRE_MIGRATION_BACKUP_KEY, primaryRaw);
            storage.setItem(SAVE_KEY, serializeGameState(primary));
          } catch {
            // Non-fatal if migration backup write fails
          }
        }
        return {
          state: primary,
          recoveredFromBackup: false,
          corruptedPrimary: false,
          migratedFrom,
        };
      }
      corruptedPrimary = true;
    }

    const backupRaw = storage.getItem(SAVE_BACKUP_KEY);
    if (backupRaw) {
      const backup = deserializeGameState(backupRaw);
      if (backup) {
        try {
          storage.setItem(SAVE_KEY, backupRaw);
        } catch {
          // Ignore heal write failure
        }
        return {
          state: backup,
          recoveredFromBackup: true,
          corruptedPrimary,
          migratedFrom: null,
        };
      }
    }
  } catch (err) {
    gameDiagnostics.recordError('saveManager.loadSave', err, 'error');
  }
  return { state: null, recoveredFromBackup: false, corruptedPrimary, migratedFrom: null };
}

export function readSaveSummary(storage: StorageLike | null = getDefaultStorage()): SaveSummaryMeta | null {
  const { state } = loadSaveWithRecovery(storage);
  if (!state) return null;
  return buildSaveSummary(state);
}

function slotStorageKey(slotId: SaveSlotId): string {
  return `quiet_voice_${slotId}_v1`;
}

export function listSaveSlots(storage: StorageLike | null = getDefaultStorage()): SaveSlotInfo[] {
  return SAVE_SLOTS.map(({ id, label }) => {
    if (!storage) return { slotId: id, label, summary: null };
    try {
      const raw = storage.getItem(slotStorageKey(id));
      if (!raw) return { slotId: id, label, summary: null };
      const parsed = deserializeGameState(raw);
      return {
        slotId: id,
        label,
        summary: parsed ? buildSaveSummary(parsed) : null,
      };
    } catch {
      return { slotId: id, label, summary: null };
    }
  });
}

export function saveToSlot(
  slotId: SaveSlotId,
  state: GameState,
  storage: StorageLike | null = getDefaultStorage()
): SaveResult {
  const serialized = serializeGameState(state);
  const now = Date.now();
  const summary = buildSaveSummary(state, now);

  if (!storage) {
    return {
      success: false,
      error: 'no_storage',
      message: 'Хранилище браузера недоступно',
      summary,
    };
  }
  try {
    storage.setItem(slotStorageKey(slotId), serialized);
    return { success: true, timestamp: now, summary };
  } catch (err) {
    gameDiagnostics.recordError(`saveManager.saveSlot:${slotId}`, err, 'error');
    const classified = classifyStorageError(err);
    return {
      success: false,
      error: classified.code,
      message: classified.message,
      summary,
    };
  }
}

export function loadFromSlot(
  slotId: SaveSlotId,
  storage: StorageLike | null = getDefaultStorage()
): { state: GameState | null; corrupted: boolean } {
  if (!storage) return { state: null, corrupted: false };
  try {
    const raw = storage.getItem(slotStorageKey(slotId));
    if (!raw) return { state: null, corrupted: false };
    const state = deserializeGameState(raw);
    return { state, corrupted: state === null };
  } catch (err) {
    gameDiagnostics.recordError(`saveManager.loadSlot:${slotId}`, err, 'error');
    return { state: null, corrupted: true };
  }
}

export function deleteSaveSlot(
  slotId: SaveSlotId,
  storage: StorageLike | null = getDefaultStorage()
): void {
  try {
    storage?.removeItem?.(slotStorageKey(slotId));
  } catch {
    // Ignore delete failure
  }
}

export function exportSavePayload(state: GameState): string {
  return serializeGameState(state);
}

export function importSavePayload(rawJson: string): {
  state: GameState | null;
  migratedFrom: number | null;
  error?: string;
} {
  if (!rawJson || typeof rawJson !== 'string') {
    return { state: null, migratedFrom: null, error: 'Пустой файл сохранения' };
  }
  try {
    const rawObj = JSON.parse(rawJson) as unknown;
    const report = migrateSavePayload(rawObj);
    if (!report) {
      return { state: null, migratedFrom: null, error: 'Неверный формат файла сохранения' };
    }
    const state = deserializeGameState(rawJson);
    if (!state) {
      return { state: null, migratedFrom: null, error: 'Повреждённая структура сохранения' };
    }
    return {
      state,
      migratedFrom: report.migratedFrom < CURRENT_SAVE_VERSION ? report.migratedFrom : null,
    };
  } catch {
    return { state: null, migratedFrom: null, error: 'Файл не является корректным JSON' };
  }
}
