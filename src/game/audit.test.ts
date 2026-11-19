import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_NOTES } from './content';
import { validateGameContent } from './contentValidator';
import { gameDiagnostics } from './diagnostics';
import { gameEventBus } from './eventBus';
import { GameLoop } from './engine/GameLoop';
import { GameRuntime } from './engine/GameRuntime';
import { createSeededRng, hashStringToSeed, seededRange } from './rng';
import {
  buildRunSummary,
  collectContainerLoot,
  countAllNotes,
  createInitialGameState,
  deserializeGameState,
  LootSystem,
  serializeGameState,
  triggerInteraction,
} from './rules';
import { WORLD_INTERACTABLES } from './world';
import {
  buildSaveSummary,
  deleteSaveSlot,
  exportSavePayload,
  importSavePayload,
  listSaveSlots,
  loadFromSlot,
  loadSaveWithRecovery,
  loadSettingsWithStatus,
  SAVE_KEY,
  SAVE_PRE_MIGRATION_BACKUP_KEY,
  saveToSlot,
  SETTINGS_KEY,
  StorageLike,
  validateAndRepairKeyBindings,
  writeSaveWithBackup,
} from './saveManager';
import { CURRENT_SAVE_VERSION, migrateSavePayload } from './saveMigration';
import { registerGameEventListeners } from './systems/eventListeners';

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

test('validateGameContent passes with zero integrity errors across all content catalogs', () => {
  const report = validateGameContent();
  assert.equal(report.valid, true, `Content errors: ${report.errors.join('; ')}`);
  assert.equal(report.stats.rooms, 23);
  assert.equal(report.stats.coreNotes, 12);
  assert.equal(report.stats.totalNotes, 20);
  assert.equal(report.stats.parts, 8);
  assert.equal(report.stats.secrets, 10);
  assert.equal(report.stats.tapes, 4);
  assert.equal(report.stats.radioSignals, 4);

  const leftArm = WORLD_INTERACTABLES.find((i) => i.id === 'f2_part_left_arm');
  assert.equal(leftArm?.x, 862);
  assert.equal(leftArm?.visualY, 336 - 28);

  const boilerNote = WORLD_INTERACTABLES.find((i) => i.id === 'b_note_11');
  assert.equal(boilerNote?.x, 805);
  assert.equal(boilerNote?.visualY, 560 - 56);
});

test('BUG-001: countAllNotes, buildSaveSummary, and buildRunSummary count all 20 notes without truncation', () => {
  const state = createInitialGameState(true);
  state.collectedNotes = ALL_NOTES.map((n) => n.id);
  state.collectedNotes.push('note_01', 'note_20', 'nonexistent_note_99');

  assert.equal(countAllNotes(state.collectedNotes), 20);

  const summary = buildSaveSummary(state);
  assert.equal(summary.notesFound, 12);
  assert.equal(summary.totalNotesFound, 20);
  assert.equal(summary.totalNotes, 20);

  const runSummary = buildRunSummary(state);
  assert.equal(runSummary.notesFound, 12);
  assert.equal(runSummary.totalNotesFound, 20);
  assert.equal(runSummary.totalNotes, 20);
});

test('BUG-006: sequential v1->v2->v3->v4 SaveMigrationManager & pre-migration backup work cleanly', () => {
  const legacyV1 = {
    saveVersion: 1,
    player: {
      zone: 'house',
      floor: 2,
      x: 500,
      y: 336,
      facing: 1,
      hasFlashlight: true,
      flashlightOn: true,
    },
    installedParts: ['left_arm'],
    collectedParts: ['right_arm'],
    collectedNotes: ['note_01', 'note_15'],
    collectedTapes: ['tape_01'],
  };

  const report = migrateSavePayload(legacyV1);
  assert.ok(report);
  assert.equal(report.migratedFrom, 1);
  assert.equal(report.migratedTo, CURRENT_SAVE_VERSION);
  assert.deepEqual(report.stepsApplied, ['v1->v2', 'v2->v3', 'v3->v4']);
  assert.deepEqual(report.payload.readNoteIds, ['note_01', 'note_15']);
  assert.deepEqual(report.payload.readTapeIds, ['tape_01']);

  const storage = createMemoryStorage({
    [SAVE_KEY]: JSON.stringify(legacyV1),
  });
  const loaded = loadSaveWithRecovery(storage);
  assert.ok(loaded.state);
  assert.equal(loaded.migratedFrom, 1);
  assert.equal(loaded.recoveredFromBackup, false);
  assert.ok(storage.getItem(SAVE_PRE_MIGRATION_BACKUP_KEY));
  assert.equal(loaded.state.saveVersion, 4);
});

test('deserializeGameState enforces zone/floor bounds and impossible-state guards', () => {
  const brokenPayload = {
    saveVersion: 4,
    player: {
      zone: 'house',
      floor: 4,
      x: 99999,
      y: -500,
      facing: 1,
      hasFlashlight: false,
      flashlightOn: true,
    },
    installedParts: ['left_arm', 'invalid_part'],
    collectedParts: ['left_arm', 'right_arm'],
    collectedNotes: ['note_01'],
    readNoteIds: ['note_01', 'note_09'],
    discoveredSecrets: ['secret_basement_vent'],
    breakerFixed: false,
  };

  const repaired = deserializeGameState(JSON.stringify(brokenPayload));
  assert.ok(repaired);
  assert.ok(repaired.player.x <= 984 && repaired.player.x >= 160);
  assert.equal(repaired.player.y, 112);
  assert.equal(repaired.player.flashlightOn, false);
  assert.deepEqual(repaired.installedParts, ['left_arm']);
  assert.deepEqual(repaired.collectedParts, ['right_arm']);
  assert.deepEqual(repaired.readNoteIds, ['note_01']);
  assert.equal(repaired.breakerFixed, true);
});

test('writeSaveWithBackup returns explicit SaveResult on storage failure and quota exceeded', () => {
  const state = createInitialGameState(true);
  const noStorage = writeSaveWithBackup(state, null);
  assert.equal(noStorage.success, false);
  if (!noStorage.success) {
    assert.equal(noStorage.error, 'no_storage');
  }

  const quotaStorage: StorageLike = {
    getItem: () => null,
    setItem: () => {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    },
  };
  const quotaRes = writeSaveWithBackup(state, quotaStorage);
  assert.equal(quotaRes.success, false);
  if (!quotaRes.success) {
    assert.equal(quotaRes.error, 'quota_exceeded');
    assert.ok(quotaRes.message.length > 0);
  }
});

test('multi-slot save/load/delete and JSON export/import round-trip safely', () => {
  const storage = createMemoryStorage();
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 2;
  state.player.x = 420;
  state.installedParts.push('left_arm', 'right_arm');
  state.collectedNotes.push('note_01', 'note_16');

  const saveRes = saveToSlot('slot_2', state, storage);
  assert.equal(saveRes.success, true);

  const slots = listSaveSlots(storage);
  assert.equal(slots.length, 3);
  assert.equal(slots[0]?.summary, null);
  assert.equal(slots[1]?.summary?.partsInstalled, 2);
  assert.equal(slots[1]?.summary?.totalNotesFound, 2);

  const loadedSlot = loadFromSlot('slot_2', storage);
  assert.ok(loadedSlot.state);
  assert.equal(loadedSlot.corrupted, false);
  assert.equal(loadedSlot.state.player.floor, 2);
  assert.deepEqual(loadedSlot.state.collectedNotes, ['note_01', 'note_16']);

  const exported = exportSavePayload(state);
  const imported = importSavePayload(exported);
  assert.ok(imported.state);
  assert.equal(imported.migratedFrom, null);
  assert.deepEqual(imported.state.installedParts, ['left_arm', 'right_arm']);

  const badImport = importSavePayload('{bad-json');
  assert.equal(badImport.state, null);
  assert.ok(badImport.error);

  deleteSaveSlot('slot_2', storage);
  const afterDelete = listSaveSlots(storage);
  assert.equal(afterDelete[1]?.summary, null);
});

test('validateAndRepairKeyBindings detects duplicate codes and repairs with unique valid keys', () => {
  const repaired = validateAndRepairKeyBindings({
    left: 'KeyA',
    right: 'KeyA', // Duplicate conflict with left
    interact: 'Escape', // Reserved invalid bind
    map: 'KeyK',
  });

  assert.equal(repaired.repaired, true);
  assert.ok(repaired.conflicts.includes('right'));
  assert.ok(repaired.conflicts.includes('interact'));

  const values = Object.values(repaired.bindings);
  assert.equal(new Set(values).size, values.length, 'Repaired keybindings must all be unique');
  assert.equal(repaired.bindings.left, 'KeyA');
  assert.equal(repaired.bindings.map, 'KeyK');
});

test('GameDiagnostics deduplicates errors, tracks slow frames, and wires into GameEventBus listeners', () => {
  gameDiagnostics.reset();

  gameDiagnostics.recordError('frame_loop', new Error('Canvas transient glitch'));
  gameDiagnostics.recordError('frame_loop', new Error('Canvas transient glitch'));
  gameDiagnostics.recordFrameDuration(14.5);
  gameDiagnostics.recordFrameDuration(64.2);

  const unregister = registerGameEventListeners();
  gameEventBus.emit('note:collected', { noteId: 'note_13' });
  gameEventBus.emit('puzzle:solved', { puzzle: 'safe' });
  unregister();

  const snap = gameDiagnostics.getSnapshot();
  assert.equal(snap.totalErrors, 2);
  assert.equal(snap.entries.length, 1);
  assert.equal(snap.entries[0]?.repeatCount, 2);
  assert.equal(snap.slowFrameCount, 1);
  assert.equal(snap.maxFrameMs, 64.2);
  assert.equal(snap.eventsTraceCount, 2);
  gameDiagnostics.reset();
});

test('deterministic seeded PRNG produces reproducible sequences', () => {
  const seed = hashStringToSeed('quiet_voice_rain_layer');
  const rngA = createSeededRng(seed);
  const rngB = createSeededRng(seed);

  const seqA = Array.from({ length: 8 }, () => seededRange(rngA, 0, 100));
  const seqB = Array.from({ length: 8 }, () => seededRange(rngB, 0, 100));
  assert.deepEqual(seqA, seqB);
});

test('P0 LootSystem: repeated container loot cannot duplicate batteries, keys, notes, or observations', () => {
  const state = createInitialGameState(true);
  const initialBatteries = state.player.batteries;

  const first = collectContainerLoot(state, 'f1_pantry_tools');
  assert.equal(first.claimed, true);
  assert.equal(first.wasAlreadyLooted, false);
  assert.equal(first.batteriesTaken, 1);
  assert.equal(state.player.batteries, initialBatteries + 1);
  assert.ok(state.lootedContainers.includes('f1_pantry_tools'));

  const second = collectContainerLoot(state, 'f1_pantry_tools');
  assert.equal(second.claimed, false);
  assert.equal(second.wasAlreadyLooted, true);
  assert.equal(second.batteriesTaken, 0);
  assert.equal(state.player.batteries, initialBatteries + 1);

  const kitchenFirst = LootSystem.claim(state, 'f1_kitchen_cabinet');
  assert.equal(kitchenFirst.claimed, true);
  assert.equal(kitchenFirst.batteriesTaken, 1);
  assert.ok(state.collectedKeys.includes('fuse'));
  const obsCountAfterFirst = state.journalObservations.length;

  const kitchenSecond = LootSystem.claim(state, 'f1_kitchen_cabinet');
  assert.equal(kitchenSecond.claimed, false);
  assert.equal(kitchenSecond.wasAlreadyLooted, true);
  assert.equal(kitchenSecond.batteriesTaken, 0);
  assert.equal(state.player.batteries, initialBatteries + 2);
  assert.equal(state.collectedKeys.filter((k) => k === 'fuse').length, 1);
  assert.equal(state.journalObservations.length, obsCountAfterFirst);

  // Verify looted state persists cleanly across save/load serialization
  const reloaded = deserializeGameState(serializeGameState(state));
  assert.ok(reloaded);
  assert.ok(reloaded.lootedContainers.includes('f1_pantry_tools'));
  assert.ok(reloaded.lootedContainers.includes('f1_kitchen_cabinet'));
  const afterReload = collectContainerLoot(reloaded, 'f1_pantry_tools');
  assert.equal(afterReload.claimed, false);
  assert.equal(afterReload.wasAlreadyLooted, true);
  assert.equal(afterReload.batteriesTaken, 0);
  assert.equal(reloaded.player.batteries, initialBatteries + 2);
});

test('P0 InteractionSystem: one-shot pickups and car_trunk enforce idempotency guards', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'forest';

  const trunkItem = WORLD_INTERACTABLES.find((i) => i.id === 'forest_car_trunk');
  assert.ok(trunkItem);
  const batteriesBefore = state.player.batteries;

  const trunkFirst = triggerInteraction(state, trunkItem);
  assert.equal(trunkFirst.sfx, 'pickup');
  assert.equal(trunkFirst.shouldSave, true);
  assert.equal(state.player.hasFlashlight, true);
  assert.ok(state.collectedKeys.includes('flashlight'));
  assert.equal(state.player.batteries, batteriesBefore);

  const trunkSecond = triggerInteraction(state, trunkItem);
  assert.equal(trunkSecond.sfx, 'none');
  assert.equal(trunkSecond.shouldSave, false);
  assert.equal(state.collectedKeys.filter((k) => k === 'flashlight').length, 1);

  const paintingSecret = WORLD_INTERACTABLES.find((i) => i.id === 'f1_secret_painting');
  assert.ok(paintingSecret);
  state.player.zone = paintingSecret.zone;
  state.player.floor = paintingSecret.floor ?? 1;
  const secFirst = triggerInteraction(state, paintingSecret);
  assert.equal(secFirst.shouldSave, true);
  assert.equal(state.player.batteries, batteriesBefore + 1);
  const secSecond = triggerInteraction(state, paintingSecret);
  assert.equal(secSecond.sfx, 'none');
  assert.equal(secSecond.shouldSave, false);
  assert.equal(state.player.batteries, batteriesBefore + 1);

  const armItem = WORLD_INTERACTABLES.find((i) => i.kind === 'part' && i.partId === 'left_arm');
  assert.ok(armItem);
  state.player.zone = armItem.zone;
  state.player.floor = armItem.floor ?? 1;
  if (armItem.requiresKey) {
    state.collectedKeys.push(armItem.requiresKey);
  }
  if (armItem.requiresSecret) {
    state.discoveredSecrets.push(armItem.requiresSecret);
  }
  if (armItem.requiresBreaker) {
    state.breakerFixed = true;
  }
  state.installedParts.push('left_arm');
  const armRetry = triggerInteraction(state, armItem);
  assert.equal(armRetry.sfx, 'none');
  assert.equal(state.collectedParts.includes('left_arm'), false);
});

test('P1 GameDiagnostics computes FPS, low 1% FPS, min FPS, and sim/render phase timings', () => {
  gameDiagnostics.reset();
  for (let i = 0; i < 99; i++) {
    gameDiagnostics.recordFrameInterval(16);
  }
  gameDiagnostics.recordFrameInterval(100);
  gameDiagnostics.recordPhaseTimings(2.4, 5.6);
  gameDiagnostics.recordPhaseTimings(3.6, 4.4);

  const snap = gameDiagnostics.getSnapshot();
  assert.ok(snap.fps > 55 && snap.fps < 65, `Expected ~59.4 FPS, got ${snap.fps}`);
  assert.equal(snap.minFps, 10);
  assert.equal(snap.low1PercentFps, 10);
  assert.equal(snap.lastSimMs, 3.6);
  assert.equal(snap.lastRenderMs, 4.4);
  assert.equal(snap.avgSimMs, 3);
  assert.equal(snap.avgRenderMs, 5);
  gameDiagnostics.reset();
});

test('P1 GameLoop enforces fixed-timestep simulation, render FPS cap, and hidden tab pause', () => {
  let simCount = 0;
  let renderCount = 0;
  let hidden = false;

  const loop = new GameLoop(
    {
      isHidden: () => hidden,
      onSimulationStep: () => {
        simCount += 1;
      },
      onFrameSync: () => {},
      onRender: () => {
        renderCount += 1;
      },
    },
    30
  );

  // Start at t=0 via internal lastTimeMs alignment (stepFrame 0 initializes baseline delta)
  loop.stepFrame(0);
  const baseSim = simCount;
  const baseRender = renderCount;

  // Two 16.7ms frames (~33.4ms total): ~2 fixed sim steps, 1 capped render at 30 FPS
  loop.stepFrame(17);
  loop.stepFrame(34);
  assert.equal(simCount - baseSim, 2);
  assert.equal(renderCount - baseRender, 1);

  // Hidden tab skips simulation and rendering
  hidden = true;
  loop.stepFrame(51);
  assert.equal(simCount - baseSim, 2);
  assert.equal(renderCount - baseRender, 1);
});

test('GameRuntime manages dialogue queue, input clearing, and session reset cleanly', () => {
  const runtime = new GameRuntime(true);
  assert.equal(runtime.state.player.zone, 'forest');

  runtime.keysHeld.add('KeyD');
  runtime.keysJustPressed.add('KeyE');
  runtime.enqueueDialogues(
    [
      { speaker: 'thought', text: 'Первая реплика.', duration: 2 },
      { speaker: 'system', text: 'Вторая реплика.', duration: 2 },
    ],
    true
  );
  assert.equal(runtime.dialogue.active?.text, 'Первая реплика.');
  assert.equal(runtime.state.activeDialogue?.text, 'Первая реплика.');
  assert.equal(runtime.state.dialogueQueue.length, 1);

  // First advance completes typewriter reveal, second moves to queued line
  assert.equal(runtime.advanceActiveDialogue(), true);
  assert.equal(runtime.advanceActiveDialogue(), true);
  assert.equal(runtime.dialogue.active?.text, 'Вторая реплика.');

  runtime.clearInput();
  assert.equal(runtime.keysHeld.size, 0);
  assert.equal(runtime.keysJustPressed.size, 0);

  const nextState = createInitialGameState(false);
  nextState.screen = 'playing';
  runtime.resetSession(nextState);
  assert.equal(runtime.state.player.zone, 'car_prologue');
  assert.equal(runtime.dialogue.active, null);
});

test('loadSettingsWithStatus sanitizes renderFpsCap values safely', () => {
  const invalidStorage = createMemoryStorage({
    [SETTINGS_KEY]: JSON.stringify({ renderFpsCap: 75 }),
  });
  const invalidLoaded = loadSettingsWithStatus(invalidStorage);
  assert.equal(invalidLoaded.settings.renderFpsCap, 0);

  const validStorage = createMemoryStorage({
    [SETTINGS_KEY]: JSON.stringify({ renderFpsCap: 60 }),
  });
  const validLoaded = loadSettingsWithStatus(validStorage);
  assert.equal(validLoaded.settings.renderFpsCap, 60);
});
