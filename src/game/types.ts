export type AppScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type WorldZone = 'car_prologue' | 'forest' | 'house';

export type PartId =
  | 'left_arm'
  | 'right_arm'
  | 'left_leg'
  | 'right_leg'
  | 'chest_panel'
  | 'head'
  | 'face_panel'
  | 'power_core';

export type KeyItemId = 'flashlight' | 'basement_key' | 'tech_key' | 'attic_crowbar' | 'fuse';

export type AudioTapeId = 'tape_01' | 'tape_02' | 'tape_03' | 'tape_04';

export type InspectTargetId =
  | 'mirror'
  | 'phone_tape'
  | 'tv_screen'
  | 'portrait'
  | 'attic_mannequin'
  | 'forest_car';

export type RobotState =
  | 'disassembled'
  | 'partial'
  | 'almost'
  | 'assembled'
  | 'red_mode';

export type SubtitleSize = 'small' | 'medium' | 'large';
export type TextSpeed = 'slow' | 'normal' | 'fast';
export type UiScale = 'compact' | 'normal' | 'large';
export type TouchSize = 'small' | 'medium' | 'large';
export type TouchLayout = 'standard' | 'swapped';
export type DifficultyMode = 'story' | 'standard' | 'tension';
export type RenderFpsCap = 0 | 30 | 60 | 120;

export type KeyAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'run'
  | 'interact'
  | 'flashlight'
  | 'reload'
  | 'inventory'
  | 'journal'
  | 'map';

export type KeyBindings = Record<KeyAction, string>;

export type EndingId = 'awakening' | 'liberation' | 'last_record';

export type HorrorMood = 'calm' | 'unease' | 'suspense' | 'threat' | 'peak' | 'aftermath';

export type ShadowBehavior = 'stalk' | 'observe' | 'light_react' | 'guide';

export interface HorrorDirectorState {
  mood: HorrorMood;
  tension: number; // 0..100
  cooldown: number;
  aftermathTimer: number;
  roomDwellTime: number;
  lastRoomId: string | null;
  triggeredAnomalies: string[];
  flickerTimer: number;
  lastCategoryCooldowns?: Record<string, number>;
  recentAnomalies?: string[];
}

export interface GameSettings {
  muted: boolean;
  masterVolume: number; // 0..1
  ambienceVolume: number; // 0..1
  sfxVolume: number; // 0..1
  voiceVolume: number; // 0..1
  musicVolume?: number; // 0..1
  uiVolume?: number; // 0..1
  subtitleSize: SubtitleSize;
  subtitleBg: boolean;
  textSpeed: TextSpeed;
  uiScale: UiScale;
  screenShake: boolean;
  reduceFlashes: boolean;
  reducedMotion?: boolean;
  visualNoise: boolean;
  soundCaptions: boolean;
  difficulty: DifficultyMode;
  touchControls: boolean;
  touchSize: TouchSize;
  touchLayout: TouchLayout;
  gamepadDeadzone?: number; // 0.08..0.5
  gamepadVibration?: boolean;
  renderFpsCap?: RenderFpsCap;
  keyBindings: KeyBindings;
}

export interface ToastNotification {
  id: number;
  kind:
    | 'note'
    | 'part'
    | 'secret'
    | 'puzzle'
    | 'observation'
    | 'key'
    | 'tape'
    | 'radio'
    | 'caption'
    | 'save_ok'
    | 'save_error';
  title: string;
  detail?: string;
}

export interface RoomRadioSignalDefinition {
  id: string;
  floor: number;
  roomId: string;
  roomLabel: string;
  x: number;
  radius: number;
  freqLabel: string;
  title: string;
  transcript: string;
  requiresMinInstalled?: number;
  requiresBreaker?: boolean;
}

export interface InspectCatalogEntry {
  id: InspectTargetId;
  title: string;
  locationLabel: string;
  summary: string;
  hotspots: { id: string; label: string }[];
}

export interface PartDefinition {
  id: PartId;
  order: number;
  name: string;
  locationHint: string;
  description: string;
}

export interface NoteDefinition {
  id: string;
  number: number;
  title: string;
  locationLabel: string;
  body: string;
  isBonus?: boolean;
}

export interface AudioTapeDefinition {
  id: AudioTapeId;
  number: number;
  title: string;
  timestamp: string;
  locationLabel: string;
  durationLabel: string;
  transcript: string;
  clueLink: string;
}

export interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  unlockByNote?: string;
  unlockByTape?: AudioTapeId;
  unlockByPuzzle?: 'phone' | 'clock' | 'safe' | 'terminal' | 'breaker' | 'radio';
  unlockByInstalled?: number;
}

export interface SecretDefinition {
  id: string;
  name: string;
  floorLabel: string;
  description: string;
}

export interface DialogueMessage {
  speaker: 'thought' | 'robot' | 'system' | 'radio' | 'tape';
  text: string;
  duration?: number;
}

export type InteractableKind =
  | 'part'
  | 'note'
  | 'key'
  | 'audio_tape'
  | 'container'
  | 'safe'
  | 'clock_puzzle'
  | 'terminal_puzzle'
  | 'breaker_puzzle'
  | 'radio_tuner'
  | 'secret_trigger'
  | 'hiding_spot'
  | 'door_transition'
  | 'stairs'
  | 'robot_workbench'
  | 'inspect'
  | 'car_trunk'
  | 'car_exit'
  | 'house_entrance';

export interface Interactable {
  id: string;
  zone: 'forest' | 'house';
  floor?: number; // 0=basement, 1=1F, 2=2F, 3=3F, 4=attic
  x: number;
  y: number;
  visualY?: number; // Optional elevated Y for items resting on tables/desks/shelves
  width: number;
  kind: InteractableKind;
  label: string;
  promptLabel: string;
  partId?: PartId;
  noteId?: string;
  keyId?: KeyItemId;
  tapeId?: AudioTapeId;
  inspectId?: InspectTargetId;
  batteryCount?: number;
  lootFlavor?: string;
  emptyText?: string;
  secretId?: string;
  requiresKey?: KeyItemId;
  requiresSecret?: string;
  requiresBreaker?: boolean;
  targetFloor?: number;
  targetX?: number;
  targetY?: number;
  targetZone?: 'forest' | 'house';
  inspectText?: string;
  inspectTextAfterStage?: { minInstalled: number; text: string };
}

export interface RoomDef {
  id: string;
  floor: number;
  name: string;
  x: number;
  width: number;
  wallColor: string;
  trimColor: string;
  floorMaterial: 'wood' | 'tile' | 'carpet' | 'concrete';
  isSecret?: boolean;
  secretId?: string;
  hasWindow?: boolean;
  windowX?: number;
  lampX?: number;
  minLampStage?: number;
}

export interface PropDef {
  id: string;
  floor: number;
  x: number;
  type:
    | 'coat_rack'
    | 'mirror'
    | 'phone'
    | 'key_shelf'
    | 'sofa'
    | 'fireplace'
    | 'tv'
    | 'bookshelf'
    | 'photos'
    | 'fridge'
    | 'kitchen_table'
    | 'sink'
    | 'cabinet'
    | 'painting'
    | 'bed'
    | 'desk'
    | 'safe'
    | 'wardrobe'
    | 'bathtub'
    | 'boxes'
    | 'workbench_tools'
    | 'monitors'
    | 'hatch_frame'
    | 'mannequin'
    | 'toys'
    | 'radio_station'
    | 'boiler'
    | 'pipes'
    | 'breaker_panel'
    | 'vent_grate'
    | 'archive_cabinets'
    | 'grandfather_clock'
    | 'exit_door'
    | 'cellar_door'
    | 'side_table'
    | 'storage_rack'
    | 'floor_hatch'
    | 'pipe_valve'
    | 'kitchen_counter';
  label?: string;
  containerId?: string;
}

export interface AtmosphericEventState {
  forestSilhouetteSeen: boolean;
  rainPausedTriggered: boolean;
  tvStaticTriggered: boolean;
  portraitChanged: boolean;
  mannequinMoved: boolean;
  hallwaySilhouetteSeen: boolean;
  doorRelockedOnce: boolean;
}

export interface ShadowEncounterState {
  active: boolean;
  floor: number;
  x: number;
  exposure: number; // 0..1 when shining bright light while standing
  cooldown: number;
  behavior: ShadowBehavior;
  hideTimer?: number;
  guideTargetX?: number;
  guideHintShown?: boolean;
}

export interface PrologueState {
  phase: 'driving' | 'sputtering' | 'stalled' | 'trunk_opened' | 'done';
  distance: number; // 0..1
  speed: number;
  ignitionAttempts: number;
  radioBroken: boolean;
  headlightFlicker: number;
}

export interface FinaleState {
  active: boolean;
  phase:
    | 'rising'
    | 'eye_shift'
    | 'dialogue_1'
    | 'dialogue_2'
    | 'choice'
    | 'approach'
    | 'fade'
    | 'credits';
  timer: number;
  redOverlay: number; // 0..1
  blueOverlay: number; // 0..1
  blackOverlay: number; // 0..1
  robotOffsetX: number;
  selectedEnding: EndingId | null;
}

export interface PlayerState {
  zone: WorldZone;
  floor: number;
  x: number;
  y: number;
  vx: number;
  facing: 1 | -1;
  stamina: number; // 0..100
  exhausted: boolean;
  flashlightOn: boolean;
  hasFlashlight: boolean;
  flashlightBattery: number; // 0..100
  batteries: number; // spare battery cells
  walkCycle: number;
  isRunning: boolean;
  isCrouching: boolean;
  isHiding: boolean;
  hidingSpotId: string | null;
  interactAnimTimer: number;
  startledTimer: number;
}

export interface GameState {
  saveVersion: number;
  screen: AppScreenState;
  prologue: PrologueState;
  player: PlayerState;
  collectedParts: PartId[];
  installedParts: PartId[];
  collectedNotes: string[];
  readNoteIds: string[];
  collectedKeys: KeyItemId[];
  collectedTapes: AudioTapeId[];
  readTapeIds: AudioTapeId[];
  discoveredRadioSignals: string[];
  discoveredSecrets: string[];
  visitedRooms: string[];
  seenDialogues: string[];
  inspectedObjects: string[];
  openedContainers: string[];
  lootedContainers: string[];
  safeUnlocked: boolean;
  clockSolved: boolean;
  terminalSolved: boolean;
  phoneListened: boolean;
  breakerFixed: boolean;
  radioTunedSecret: boolean;
  shadowEncounter: ShadowEncounterState;
  horror: HorrorDirectorState;
  journalObservations: string[];
  atmospheric: AtmosphericEventState;
  finale: FinaleState;
  playTimeSeconds: number;
  robotFirstMet: boolean;
  activeDialogue: DialogueMessage | null;
  dialogueQueue: DialogueMessage[];
  activeOverlay:
    | 'none'
    | 'inventory'
    | 'journal'
    | 'map'
    | 'assembly'
    | 'safe'
    | 'clock'
    | 'terminal'
    | 'breaker'
    | 'radio'
    | 'container'
    | 'inspect';
  activeContainerId: string | null;
  activeInspectId: InspectTargetId | null;
  selectedNoteId: string | null;
  lastSaveTimestamp: number | null;
}

export interface RunSummary {
  playTimeSeconds: number;
  partsInstalled: number;
  notesFound: number;
  totalNotesFound?: number;
  totalNotes?: number;
  secretsFound: number;
  tapesFound: number;
  roomsVisited: number;
  totalRooms: number;
  endingId: EndingId;
}
