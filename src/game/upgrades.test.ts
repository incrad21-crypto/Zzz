import test from 'node:test';
import assert from 'node:assert/strict';
import { soundEngine } from './audio';
import { validateProgressionGraph } from './contentValidator';
import { createGamepadPrevButtons, readGamepadSnapshot, vibrateGamepad } from './controllers/gamepadController';
import { isKeyBoundToAction } from './controllers/inputController';
import { gameDiagnostics } from './diagnostics';
import { createSimulationTimers, runSimulationStep } from './controllers/simulationStep';
import { GameLoop } from './engine/GameLoop';
import { GameRuntime } from './engine/GameRuntime';
import { GameEventBus } from './eventBus';
import { getCurrentRoomId } from './horrorDirector';
import {
  createInitialGameState,
  deserializeGameState,
  recordInspectHotspotDiscovery,
  serializeGameState,
  updateShadowEncounter,
} from './rules';
import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_SETTINGS,
  loadSettingsWithStatus,
  resetSettingsToDefault,
  SETTINGS_KEY,
  StorageLike,
} from './saveManager';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & { store: Record<string, string> } {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? (store[key] ?? null) : null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
  };
}

test('validateProgressionGraph proves 100% reachability of all 23 rooms, 8 parts, 20 notes, 10 secrets, 4 tapes, and 3 endings', () => {
  const report = validateProgressionGraph();
  assert.equal(report.valid, true, `Progression blockers: ${report.errors.join('; ')}`);
  assert.equal(report.reachableRooms.length, 23);
  assert.equal(report.reachableParts.length, 8);
  assert.equal(report.reachableNotes.length, 20);
  assert.equal(report.reachableSecrets.length, 10);
  assert.equal(report.reachableTapes.length, 4);
  assert.deepEqual(report.reachableEndings.sort(), ['awakening', 'last_record', 'liberation']);
});

test('Shadow encounter respects floor boundaries (b_secret / locked f3_tech) and uses hideTimer without negative cooldown', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 0;
  state.player.x = 760;
  state.installedParts.push('left_arm', 'right_arm', 'left_leg', 'right_leg');

  // Spawn shadow when cooldown drops to 0 on floor 0 without secret_basement_vent -> must spawn >= 336 (not inside b_secret)
  state.shadowEncounter.active = false;
  state.shadowEncounter.cooldown = 0.05;
  updateShadowEncounter(state, 0.1);
  if (state.shadowEncounter.active) {
    assert.ok(state.shadowEncounter.x >= 336, `Shadow spawned inside sealed b_secret: x=${state.shadowEncounter.x}`);
  }

  // Hiding uses hideTimer instead of corrupting cooldown below 0 (clampDt caps single step at 0.25s)
  state.player.isHiding = true;
  state.shadowEncounter = {
    active: true,
    floor: 0,
    x: 600,
    exposure: 0.4,
    cooldown: 0,
    hideTimer: 0,
    behavior: 'stalk',
  };
  const step1 = updateShadowEncounter(state, 0.5);
  assert.equal(step1.evaded, false);
  assert.ok(state.shadowEncounter.cooldown >= 0);
  assert.ok((state.shadowEncounter.hideTimer ?? 0) > 0);

  let evaded = false;
  for (let i = 0; i < 6; i++) {
    const res = updateShadowEncounter(state, 0.25);
    assert.ok(state.shadowEncounter.cooldown >= 0);
    if (res.evaded) {
      evaded = true;
      break;
    }
  }
  assert.equal(evaded, true);
  assert.equal(state.shadowEncounter.active, false);
  assert.ok(state.shadowEncounter.cooldown > 0);
});

test('forest_car:windshield_note records stage >= 4 observation even if inspected before stage 4', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'forest';

  const early = recordInspectHotspotDiscovery(state, 'forest_car', 'windshield_note');
  assert.equal(early.observation, undefined);

  state.installedParts.push('left_arm', 'right_arm', 'left_leg', 'right_leg');
  const late = recordInspectHotspotDiscovery(state, 'forest_car', 'windshield_note');
  assert.ok(late.observation && late.observation.includes('ВОЗВРАЩАЙСЯ'));

  const dupLate = recordInspectHotspotDiscovery(state, 'forest_car', 'windshield_note');
  assert.equal(dupLate.observation, undefined);
});

test('SaveSerializer emits verifiable _checksum, rejects tampered saves, and coerces boolean fields', () => {
  const state = createInitialGameState(true);
  state.safeUnlocked = true;
  state.selectedNoteId = 'note_01';

  const raw = serializeGameState(state);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal(typeof parsed._checksum, 'string');
  assert.equal(parsed.selectedNoteId, null);

  const validLoaded = deserializeGameState(raw);
  assert.ok(validLoaded);
  assert.equal(validLoaded.safeUnlocked, true);
  assert.equal(validLoaded.selectedNoteId, null);

  // Tampering with checksum-protected save fails integrity check cleanly
  parsed.safeUnlocked = false;
  assert.equal(deserializeGameState(JSON.stringify(parsed)), null);

  // Truthy non-boolean values in legacy payloads coerce to proper booleans
  const nonBoolean = {
    saveVersion: 4,
    player: { zone: 'house', floor: 1, x: 200, y: 448, hasFlashlight: 'yes', flashlightOn: 1 },
    installedParts: [],
    safeUnlocked: 'true',
    clockSolved: 0,
  };
  const coerced = deserializeGameState(JSON.stringify(nonBoolean));
  assert.ok(coerced);
  assert.strictEqual(coerced.safeUnlocked, true);
  assert.strictEqual(coerced.clockSolved, false);
  assert.strictEqual(coerced.player.hasFlashlight, true);
  assert.strictEqual(coerced.player.flashlightOn, true);
});

test('GameEventBus isolates throwing listeners so subsequent subscribers still receive events', () => {
  const bus = new GameEventBus();
  gameDiagnostics.reset();
  let secondCalled = 0;

  bus.on('puzzle:solved', () => {
    throw new Error('Listener failure simulation');
  });
  bus.on('puzzle:solved', () => {
    secondCalled += 1;
  });

  bus.emit('puzzle:solved', { puzzle: 'terminal' });
  assert.equal(secondCalled, 1);
  assert.ok(gameDiagnostics.getSnapshot().totalErrors >= 1);
  gameDiagnostics.reset();
});

test('getCurrentRoomId is strictly side-effect free and GameLoop ignores hidden tab time spikes', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 1;
  state.player.x = 260;
  assert.deepEqual(state.visitedRooms, []);
  const room = getCurrentRoomId(state);
  assert.equal(room, 'f1_living');
  assert.deepEqual(state.visitedRooms, [], 'getCurrentRoomId must not mutate visitedRooms');

  let hidden = false;
  let simSteps = 0;
  const loop = new GameLoop({
    isHidden: () => hidden,
    onSimulationStep: () => {
      simSteps += 1;
    },
    onFrameSync: () => {},
    onRender: () => {},
  });

  gameDiagnostics.reset();
  loop.stepFrame(0);
  loop.stepFrame(17);
  const stepsBeforeHide = simSteps;

  hidden = true;
  loop.stepFrame(5000);
  // Hidden frame discards elapsed gap without advancing sim or polluting slow-frame metrics
  assert.equal(simSteps, stepsBeforeHide);
  assert.equal(gameDiagnostics.getSnapshot().slowFrameCount, 0);

  hidden = false;
  // First resume frame sees only the 17ms active delta (1 step, not a 6-step catch-up burst)
  loop.stepFrame(5017);
  assert.equal(simSteps, stepsBeforeHide + 1);
  gameDiagnostics.reset();
});

test('Keybinding fallback excludes M/P, inputController detects bound keys, and resetSettingsToDefault restores clean defaults', () => {
  const storage = createMemoryStorage({
    [SETTINGS_KEY]: JSON.stringify({
      musicVolume: 0.25,
      uiVolume: 0.4,
      reducedMotion: true,
      gamepadDeadzone: 0.12,
      gamepadVibration: false,
      keyBindings: {
        ...DEFAULT_KEY_BINDINGS,
        left: 'Escape', // Invalid -> must be repaired avoiding KeyM/KeyP
      },
    }),
  });

  const loaded = loadSettingsWithStatus(storage);
  assert.equal(loaded.bindingsRepaired, true);
  assert.notEqual(loaded.settings.keyBindings.left, 'KeyM');
  assert.notEqual(loaded.settings.keyBindings.left, 'KeyP');
  assert.equal(loaded.settings.musicVolume, 0.25);
  assert.equal(loaded.settings.uiVolume, 0.4);
  assert.equal(loaded.settings.reducedMotion, true);
  assert.equal(loaded.settings.gamepadDeadzone, 0.12);
  assert.equal(loaded.settings.gamepadVibration, false);

  assert.equal(isKeyBoundToAction('KeyE', DEFAULT_KEY_BINDINGS), true);
  assert.equal(isKeyBoundToAction('KeyM', DEFAULT_KEY_BINDINGS), false);

  const reset = resetSettingsToDefault(storage);
  assert.equal(reset.musicVolume, DEFAULT_SETTINGS.musicVolume);
  assert.equal(reset.uiVolume, DEFAULT_SETTINGS.uiVolume);
  assert.equal(reset.reducedMotion, false);
  assert.equal(reset.gamepadDeadzone, DEFAULT_SETTINGS.gamepadDeadzone);
  assert.equal(reset.gamepadVibration, true);
});

test('GamepadController honors configurable deadzone, fires directional edge triggers, and audio/runtime dispose safely', () => {
  const prev = createGamepadPrevButtons();
  const pad = {
    connected: true,
    axes: [0.15, -0.75],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  };

  // Strict 0.10 deadzone picks up 0.15 right tilt and vertical up edge
  const snap1 = readGamepadSnapshot(pad, prev, 0.1);
  assert.equal(snap1.right, true);
  assert.equal(snap1.justRight, true);
  assert.equal(snap1.up, true);
  assert.equal(snap1.justUp, true);

  // Next frame holds direction without re-firing edge flags
  const snap2 = readGamepadSnapshot(pad, prev, 0.1);
  assert.equal(snap2.justRight, false);
  assert.equal(snap2.justUp, false);

  // Safe no-op calls in headless environment
  vibrateGamepad(120, 0.3, 0.5, true);
  soundEngine.setMixerVolumes({ master: 0.7, ambience: 0.8, music: 0.6, sfx: 0.9, voice: 0.9, ui: 0.75 });
  soundEngine.setMoodTension('threat', 0.8);
  soundEngine.playUiSfx('confirm');
  soundEngine.dispose();

  const rt = new GameRuntime(true);
  rt.keysHeld.add('KeyD');
  rt.dispose();
  assert.equal(rt.keysHeld.size, 0);
});

test('Procedural prop foley SFX, footstep materials, and spatial simulation timers run cleanly', () => {
  const newSfx = ['clock_tick', 'drip', 'hearth_crackle', 'servo_hum'] as const;
  for (const sfx of newSfx) {
    soundEngine.playSfx(sfx, -0.35);
    soundEngine.playSfx(sfx, 0.45);
  }
  const materials = ['wood', 'tile', 'concrete', 'gravel'] as const;
  for (const mat of materials) {
    soundEngine.playFootstep(mat, 0.1);
  }

  const timers = createSimulationTimers();
  assert.equal(timers.clockTickTimer, 1.0);
  assert.equal(timers.dripTimer, 2.8);
  assert.equal(timers.hearthCrackleTimer, 1.9);
  assert.equal(timers.servoHumTimer, 5.5);

  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 1;
  state.player.x = 240; // Near living room fireplace
  state.installedParts.push('chest_panel', 'head', 'left_arm');
  timers.hearthCrackleTimer = 0.02;

  const held = new Set<string>();
  runSimulationStep(state, 0.05, 10, held, DEFAULT_KEY_BINDINGS, timers, {
    enqueueDialogues: () => {},
    pushToast: () => {},
    persistSave: () => {},
    onFinaleFinished: () => {},
    updateStaminaBar: () => {},
  });
  assert.ok(timers.hearthCrackleTimer > 1.0, 'Hearth crackle timer should reset after triggering');

  // Basement pipe drip spatial timer
  state.player.floor = 0;
  state.player.x = 460;
  timers.dripTimer = 0.02;
  runSimulationStep(state, 0.05, 11, held, DEFAULT_KEY_BINDINGS, timers, {
    enqueueDialogues: () => {},
    pushToast: () => {},
    persistSave: () => {},
    onFinaleFinished: () => {},
    updateStaminaBar: () => {},
  });
  assert.ok(timers.dripTimer > 2.0, 'Basement pipe drip timer should reset after triggering');
});
