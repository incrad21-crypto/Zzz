import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRunSummary,
  chooseFinaleEnding,
  collectContainerLoot,
  countCoreNotes,
  countUnreadJournalEntries,
  createInitialGameState,
  deserializeGameState,
  detectNearbyRoomRadioSignal,
  findNearestInteractable,
  getCurrentObjective,
  getHorizontalBounds,
  getLightingStage,
  getRobotState,
  installPartOnRobot,
  isTimelineEntryUnlocked,
  markNoteAsRead,
  markTapeAsRead,
  recordInspectHotspotDiscovery,
  reloadFlashlightBattery,
  serializeGameState,
  solveBreakerPuzzle,
  solveClockPuzzle,
  solveTerminalPuzzle,
  startFinale,
  submitSafeCode,
  toggleHidingSpot,
  triggerInteraction,
  updateFinale,
  updatePlayerMovement,
  updatePrologue,
  updateShadowEncounter,
} from './rules';
import {
  buildClueChains,
  canUnlockLastRecordEnding,
  selectContextualRobotDialogue,
} from './dialogueDirector';
import {
  advanceDialogue,
  createDialogueRuntime,
  enqueueDialogue,
  tickDialogue,
} from './controllers/dialogueController';
import { isActionHeld, matchesKeyAction, rebindKeyAction } from './controllers/inputController';
import { GameEventBus } from './eventBus';
import { trackVisitedRoom, updateHorrorDirector } from './horrorDirector';
import {
  DEFAULT_KEY_BINDINGS,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  StorageLike,
  formatKeyCode,
  loadSaveWithRecovery,
  loadSettings,
  saveSettings,
  writeSaveWithBackup,
} from './saveManager';
import {
  ALL_NOTES,
  BONUS_NOTES,
  INSPECT_OBJECT_CATALOG,
  LORE_NOTES,
  ROOM_RADIO_SIGNALS,
  SECRETS,
  TIMELINE_ENTRIES,
} from './content';
import { WORLD_INTERACTABLES } from './world';
import { PartId } from './types';

test('lighting stage and robot state progress accurately across 0..8 installed parts', () => {
  assert.equal(getLightingStage(0), 0);
  assert.equal(getLightingStage(1), 1);
  assert.equal(getLightingStage(2), 1);
  assert.equal(getLightingStage(3), 2);
  assert.equal(getLightingStage(4), 2);
  assert.equal(getLightingStage(5), 3);
  assert.equal(getLightingStage(6), 3);
  assert.equal(getLightingStage(7), 4);
  assert.equal(getLightingStage(8), 5);

  assert.equal(getRobotState(0, false), 'disassembled');
  assert.equal(getRobotState(2, false), 'partial');
  assert.equal(getRobotState(6, false), 'almost');
  assert.equal(getRobotState(8, false), 'assembled');
  assert.equal(getRobotState(8, true, 'eye_shift'), 'red_mode');
});

test('prologue driving transitions from driving to sputtering to stalled', () => {
  const state = createInitialGameState(false);
  assert.equal(state.prologue.phase, 'driving');

  for (let i = 0; i < 600; i++) {
    updatePrologue(state, { left: false, right: true, brake: false }, 0.05);
  }
  assert.equal(state.prologue.phase, 'stalled');
  assert.equal(state.prologue.radioBroken, true);
  assert.equal(state.prologue.speed, 0);
});

test('movement applies inertia, stamina drain on run, flashlight battery drain, and reload', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 1;
  state.player.x = 100;
  state.player.hasFlashlight = true;
  state.player.flashlightOn = true;

  updatePlayerMovement(state, { left: false, right: true, run: true, crouch: false }, 0.1);
  assert.ok(state.player.vx > 0);
  assert.ok(state.player.x > 100);
  assert.ok(state.player.stamina < 100);
  assert.ok(state.player.flashlightBattery < 100);

  // Release movement -> velocity decays smoothly (inertia) rather than snapping to 0 in 1ms
  const vxBeforeRelease = state.player.vx;
  updatePlayerMovement(state, { left: false, right: false, run: false, crouch: false }, 0.02);
  assert.ok(state.player.vx > 0 && state.player.vx < vxBeforeRelease);

  // Drain battery down to emergency reserve (never below 12%) with realistic dt ticks and test spare battery reload
  for (let i = 0; i < 800; i++) {
    updatePlayerMovement(state, { left: false, right: false, run: false, crouch: false }, 0.25);
  }
  assert.equal(state.player.flashlightBattery, 12);
  const reloaded = reloadFlashlightBattery(state);
  assert.equal(reloaded.reloaded, true);
  assert.equal(state.player.flashlightBattery, 100);
  assert.equal(state.player.batteries, 0);
});

test('locked rooms block access until key or secret vent is used', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 3;
  state.player.x = 680;

  // Without tech_key, player cannot walk past x=712 into tech room
  const boundsLocked = getHorizontalBounds(state);
  assert.equal(boundsLocked.maxX, 712);

  // Solving Study Safe (code 0419) grants tech_key and unlocks tech room
  const safeItem = WORLD_INTERACTABLES.find((i) => i.id === 'f2_study_safe')!;
  state.player.floor = 2;
  state.player.x = safeItem.x;
  const resOverlay = triggerInteraction(state, safeItem);
  assert.equal(resOverlay.openOverlay, 'safe');

  const wrong = submitSafeCode(state, '1234');
  assert.equal(wrong.success, false);
  assert.equal(state.safeUnlocked, false);

  const ok = submitSafeCode(state, '0419');
  assert.equal(ok.success, true);
  assert.equal(state.safeUnlocked, true);
  assert.ok(state.collectedKeys.includes('tech_key'));

  state.player.floor = 3;
  state.player.x = 680;
  const boundsUnlocked = getHorizontalBounds(state);
  assert.equal(boundsUnlocked.maxX, 1052);
});

test('answering machine, grandfather clock puzzle, and CRT terminal unlock clues & keys', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';

  // 1F Phone tape clue
  const phone = WORLD_INTERACTABLES.find((i) => i.id === 'f1_phone')!;
  state.player.floor = 1;
  state.player.x = phone.x;
  const phoneRes = triggerInteraction(state, phone);
  assert.equal(phoneRes.sfx, 'tape');
  assert.equal(state.phoneListened, true);

  // 2F Grandfather clock puzzle grants basement_key + spare battery
  const clockItem = WORLD_INTERACTABLES.find((i) => i.id === 'f2_clock_puzzle')!;
  state.player.floor = 2;
  state.player.x = clockItem.x;
  const clockOpen = triggerInteraction(state, clockItem);
  assert.equal(clockOpen.openOverlay, 'clock');

  const clockDone = solveClockPuzzle(state);
  assert.equal(clockDone.alreadySolved, false);
  assert.equal(state.clockSolved, true);
  assert.ok(state.collectedKeys.includes('basement_key'));
  assert.equal(state.player.batteries, 2);

  // 3F Terminal puzzle
  const termItem = WORLD_INTERACTABLES.find((i) => i.id === 'f3_terminal')!;
  state.player.floor = 3;
  state.player.x = termItem.x;
  const termOpen = triggerInteraction(state, termItem);
  assert.equal(termOpen.openOverlay, 'terminal');
  solveTerminalPuzzle(state);
  assert.equal(state.terminalSolved, true);
  assert.ok(getCurrentObjective(state).length > 5);
});

test('all 8 parts can be collected (including container drawer loot) and installed, triggering finale', () => {
  const state = createInitialGameState(true);
  // Give keys & secrets needed to reach all 8 parts
  state.collectedKeys.push('basement_key', 'tech_key', 'attic_crowbar', 'fuse');
  state.breakerFixed = true;
  state.discoveredSecrets.push('secret_wardrobe', 'secret_bathroom_mirror', 'secret_basement_vent');

  const partIds: PartId[] = [
    'left_arm',
    'right_arm',
    'left_leg',
    'right_leg',
    'chest_panel',
    'head',
    'face_panel',
    'power_core',
  ];

  for (const partId of partIds) {
    const item = WORLD_INTERACTABLES.find((i) => i.partId === partId)!;
    assert.ok(item, `Interactable missing for ${partId}`);
    state.player.zone = item.zone;
    state.player.floor = item.floor ?? 1;
    state.player.x = item.x;
    const nearest = findNearestInteractable(state);
    assert.equal(nearest?.partId, partId);
    const res = triggerInteraction(state, item);
    if (res.openOverlay === 'container' && res.activeContainerId) {
      collectContainerLoot(state, res.activeContainerId);
    }
    assert.ok(state.collectedParts.includes(partId));
  }

  assert.equal(state.collectedParts.length, 8);

  // Install 7 parts -> no finale yet
  for (let i = 0; i < 7; i++) {
    const pid = partIds[i];
    assert.ok(pid);
    const res = installPartOnRobot(state, pid);
    assert.equal(res.success, true);
    assert.equal(res.triggeredFinale, false);
  }
  assert.equal(state.installedParts.length, 7);
  assert.equal(state.atmospheric.tvStaticTriggered, true);
  assert.equal(state.atmospheric.portraitChanged, true);
  assert.equal(state.atmospheric.mannequinMoved, true);

  // Install 8th part -> finale triggers, pauses at choice phase, and progresses to gameover once chosen
  const lastPart = partIds[7];
  assert.ok(lastPart);
  const finalInstall = installPartOnRobot(state, lastPart);
  assert.equal(finalInstall.triggeredFinale, true);
  assert.equal(state.finale.active, true);

  let reachedChoice = false;
  let finished = false;
  for (let i = 0; i < 400; i++) {
    const step = updateFinale(state, 0.05);
    if (state.finale.phase === 'choice' && !reachedChoice) {
      reachedChoice = true;
      const choiceMsg = chooseFinaleEnding(state, 'awakening');
      assert.equal(choiceMsg.speaker, 'robot');
    }
    if (step.finished) {
      finished = true;
      break;
    }
  }
  assert.equal(reachedChoice, true);
  assert.equal(finished, true);
  assert.equal(state.screen, 'gameover');
  assert.equal(buildRunSummary(state).endingId, 'awakening');
});

test('breaker puzzle gates basement vent and shadow encounter reacts to flashlight vs crouching', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 0;
  const vent = WORLD_INTERACTABLES.find((i) => i.id === 'b_vent_in')!;
  state.player.x = vent.x;

  // Blocked until breaker puzzle is solved
  const lockedVent = triggerInteraction(state, vent);
  assert.equal(lockedVent.sfx, 'locked');
  assert.equal(state.discoveredSecrets.includes('secret_basement_vent'), false);

  solveBreakerPuzzle(state);
  assert.equal(state.breakerFixed, true);
  const unlockedVent = triggerInteraction(state, vent);
  assert.equal(unlockedVent.sfx, 'secret');
  assert.ok(state.discoveredSecrets.includes('secret_basement_vent'));

  // Shadow encounter triggers startle when shining flashlight while standing
  state.installedParts.push('left_arm', 'right_arm', 'left_leg', 'right_leg');
  state.player.floor = 2;
  state.player.x = 400;
  state.player.facing = 1;
  state.player.hasFlashlight = true;
  state.player.flashlightOn = true;
  state.player.isCrouching = false;
  state.shadowEncounter = {
    active: true,
    floor: 2,
    x: 490,
    exposure: 0.9,
    cooldown: 0,
    behavior: 'light_react',
    guideTargetX: undefined,
    guideHintShown: false,
  };

  const startledStep = updateShadowEncounter(state, 0.25);
  assert.equal(startledStep.startled, true);
  assert.ok(state.player.startledTimer > 0);
});

test('save and load preserves collected parts, notes, secrets, and puzzle progress', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 2;
  state.player.x = 340;
  state.collectedNotes.push('note_01', 'note_02');
  state.installedParts.push('left_arm');
  state.discoveredSecrets.push('secret_painting');
  state.openedContainers.push('f1_kitchen_cabinet');
  state.lootedContainers.push('f1_kitchen_cabinet');
  state.safeUnlocked = true;
  state.clockSolved = true;
  state.terminalSolved = true;
  state.phoneListened = true;

  const raw = serializeGameState(state);
  const loaded = deserializeGameState(raw);
  assert.ok(loaded);
  assert.equal(loaded.player.zone, 'house');
  assert.equal(loaded.player.floor, 2);
  assert.equal(loaded.player.x, 340);
  assert.deepEqual(loaded.collectedNotes, ['note_01', 'note_02']);
  assert.deepEqual(loaded.installedParts, ['left_arm']);
  assert.deepEqual(loaded.discoveredSecrets, ['secret_painting']);
  assert.deepEqual(loaded.openedContainers, ['f1_kitchen_cabinet']);
  assert.deepEqual(loaded.lootedContainers, ['f1_kitchen_cabinet']);
  assert.equal(loaded.safeUnlocked, true);
  assert.equal(loaded.clockSolved, true);
  assert.equal(loaded.terminalSolved, true);
  assert.equal(loaded.phoneListened, true);
});

test('discovered one-shot secrets hide so parts stay focusable, secrets grant batteries, and objective tracks puzzles cleanly', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.robotFirstMet = true;

  // Before phone/clock, carrying 1 part doesn't erase phone/clock guidance
  state.collectedParts.push('left_leg');
  assert.match(getCurrentObjective(state), /автоответчик/i);

  state.phoneListened = true;
  assert.match(getCurrentObjective(state), /23:45/);

  // Painting secret grants a spare battery and then hides from findNearestInteractable
  const painting = WORLD_INTERACTABLES.find((i) => i.id === 'f1_secret_painting')!;
  const initialBatteries = state.player.batteries;
  state.player.floor = 1;
  state.player.x = painting.x;
  const paintRes = triggerInteraction(state, painting);
  assert.equal(paintRes.sfx, 'secret');
  assert.equal(state.player.batteries, initialBatteries + 1);
  assert.notEqual(findNearestInteractable(state)?.id, 'f1_secret_painting');

  // Wardrobe secret hides after opening so right_arm becomes immediately focusable
  const wardrobe = WORLD_INTERACTABLES.find((i) => i.id === 'f2_secret_wardrobe')!;
  state.player.floor = 2;
  state.player.x = wardrobe.x;
  assert.equal(findNearestInteractable(state)?.id, 'f2_secret_wardrobe');
  triggerInteraction(state, wardrobe);
  assert.equal(findNearestInteractable(state)?.id, 'f2_part_right_arm');
});

test('all 8 parts collected objective and stage>=7 front door lock reaction work without soft-locking', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 1;
  state.robotFirstMet = true;
  state.installedParts.push(
    'left_arm',
    'right_arm',
    'left_leg',
    'right_leg',
    'chest_panel',
    'head',
    'face_panel'
  );
  state.collectedParts.push('power_core');

  assert.equal(
    getCurrentObjective(state),
    'Вернуться к верстаку — все 8 деталей собраны (1 с собой)'
  );

  const exitDoor = WORLD_INTERACTABLES.find((i) => i.id === 'f1_exit_door')!;
  state.player.x = exitDoor.x;

  // First attempt at stage >= 7 locks once with startle + whisper
  const firstTry = triggerInteraction(state, exitDoor);
  assert.equal(firstTry.sfx, 'locked');
  assert.equal(state.atmospheric.doorRelockedOnce, true);
  assert.ok(state.player.startledTimer > 0);
  assert.equal(state.player.zone, 'house');

  // Second attempt allows exiting freely without soft-locking
  const secondTry = triggerInteraction(state, exitDoor);
  assert.equal(secondTry.sfx, 'door');
  assert.equal(state.player.zone, 'forest');
});

test('horror director tracks visited rooms, triggers non-repeating spatial anomaly, and enters aftermath breather', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 1;
  state.player.x = 260; // f1_living
  state.installedParts.push('left_arm');
  state.horror.cooldown = 0;

  const roomId = trackVisitedRoom(state);
  assert.equal(roomId, 'f1_living');
  assert.ok(state.visitedRooms.includes('f1_living'));

  // Dwell in living room long enough for anom_steps_above_1f (minDwell 5.5s)
  let triggered = null;
  for (let i = 0; i < 70; i++) {
    const res = updateHorrorDirector(state, 0.1);
    if (res) {
      triggered = res;
      break;
    }
  }
  assert.ok(triggered, 'Expected spatial anomaly to trigger in f1_living');
  assert.equal(triggered.anomalyId, 'anom_steps_above_1f');
  assert.equal(triggered.sound, 'steps_above');
  assert.equal(state.horror.mood, 'aftermath');
  assert.ok(state.horror.aftermathTimer > 0);
  assert.ok(state.horror.triggeredAnomalies.includes('anom_steps_above_1f'));

  // Even after clearing aftermath & cooldown, same anomaly never repeats
  state.horror.aftermathTimer = 0;
  state.horror.cooldown = 0;
  state.horror.roomDwellTime = 10;
  const repeat = updateHorrorDirector(state, 0.1);
  assert.equal(repeat, null);
});

test('contextual Echo-4 dialogue prioritizes discovered lore and never repeats seen lines', () => {
  const state = createInitialGameState(true);
  state.installedParts.push('left_arm', 'right_arm');
  state.collectedNotes.push('note_12');
  state.terminalSolved = true;

  const first = selectContextualRobotDialogue(state);
  assert.match(first.text, /последнее письмо/i);
  assert.ok(state.seenDialogues.includes('ctx_note12_confront'));

  const second = selectContextualRobotDialogue(state);
  assert.match(second.text, /шины терминала/i);
  assert.ok(state.seenDialogues.includes('ctx_terminal_react'));
  assert.notEqual(second.text, first.text);
});

test('all 3 endings, secret last_record gating, clue chains, and v1->v2 save migration work cleanly', () => {
  const state = createInitialGameState(true);
  assert.equal(canUnlockLastRecordEnding(state), false);

  state.terminalSolved = true;
  state.radioTunedSecret = true;
  state.collectedNotes.push('note_01', 'note_02', 'note_03', 'note_04', 'note_05', 'note_12');
  state.discoveredSecrets.push('secret_painting', 'secret_wardrobe', 'secret_basement_vent');
  assert.equal(canUnlockLastRecordEnding(state), true);

  const chains = buildClueChains(state);
  assert.equal(chains.length, 4);
  const truthChain = chains.find((c) => c.id === 'chain_truth')!;
  assert.equal(truthChain.steps.every((s) => s.done), true);

  // Test liberation ending path
  startFinale(state);
  state.finale.phase = 'choice';
  const libMsg = chooseFinaleEnding(state, 'liberation');
  assert.match(libMsg.text, /тишина/i);
  let finished = false;
  for (let i = 0; i < 200; i++) {
    const step = updateFinale(state, 0.05);
    if (step.finished) {
      finished = true;
      break;
    }
  }
  assert.equal(finished, true);
  assert.equal(buildRunSummary(state).endingId, 'liberation');

  // Test last_record true ending path
  startFinale(state);
  state.finale.phase = 'choice';
  const recMsg = chooseFinaleEnding(state, 'last_record');
  assert.match(recMsg.text, /104\.8/);
  finished = false;
  for (let i = 0; i < 200; i++) {
    const step = updateFinale(state, 0.05);
    if (step.finished) {
      finished = true;
      break;
    }
  }
  assert.equal(finished, true);
  assert.equal(buildRunSummary(state).endingId, 'last_record');

  // Test backward-compatible v1 -> v3 save migration
  const legacyV1Payload = JSON.stringify({
    player: { zone: 'house', floor: 2, x: 310, y: 344, hasFlashlight: true },
    installedParts: ['left_arm', 'right_arm'],
    collectedParts: ['head'],
    collectedNotes: ['note_01'],
    safeUnlocked: true,
  });
  const migrated = deserializeGameState(legacyV1Payload);
  assert.ok(migrated);
  assert.equal(migrated.saveVersion, 4);
  assert.deepEqual(migrated.visitedRooms, []);
  assert.deepEqual(migrated.seenDialogues, []);
  assert.deepEqual(migrated.collectedTapes, []);
  assert.deepEqual(migrated.inspectedObjects, []);
  assert.equal(migrated.player.isHiding, false);
  assert.equal(migrated.horror.mood, 'calm');
  assert.equal(migrated.finale.selectedEnding, null);
  assert.equal(migrated.safeUnlocked, true);
});

test('GameEventBus dispatches typed events, supports unsubscribe, and prevents infinite recursion', () => {
  const bus = new GameEventBus();
  const seen: string[] = [];
  const off = bus.on('note:collected', ({ noteId }) => {
    seen.push(noteId);
  });

  bus.emit('note:collected', { noteId: 'note_01' });
  off();
  bus.emit('note:collected', { noteId: 'note_02' });
  assert.deepEqual(seen, ['note_01']);

  // Recursion guard caps nested re-emits at MAX_RECURSION_DEPTH (8)
  let recursiveHits = 0;
  bus.on('save:persisted', ({ timestamp }) => {
    recursiveHits += 1;
    bus.emit('save:persisted', { timestamp: timestamp + 1 });
  });
  bus.emit('save:persisted', { timestamp: 1 });
  assert.equal(recursiveHits, 8);
});

test('saveManager maintains backup slot and recovers cleanly from primary save corruption', () => {
  const store = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };

  const state1 = createInitialGameState(true);
  state1.player.zone = 'house';
  state1.installedParts.push('left_arm');
  state1.collectedTapes.push('tape_01');
  writeSaveWithBackup(state1, mockStorage);

  // Second save promotes state1 into backup slot
  const state2 = createInitialGameState(true);
  state2.player.zone = 'house';
  state2.installedParts.push('left_arm', 'right_arm');
  state2.collectedTapes.push('tape_01', 'tape_02');
  writeSaveWithBackup(state2, mockStorage);
  assert.ok(store.has(SAVE_BACKUP_KEY));

  // Corrupt primary save -> recovery restores backup automatically
  store.set(SAVE_KEY, '{corrupted_json');
  const recovered = loadSaveWithRecovery(mockStorage);
  assert.equal(recovered.recoveredFromBackup, true);
  assert.ok(recovered.state);
  assert.deepEqual(recovered.state.installedParts, ['left_arm']);
  assert.deepEqual(recovered.state.collectedTapes, ['tape_01']);

  // Settings mixer persistence & clamping
  const defaults = loadSettings(mockStorage);
  saveSettings({ ...defaults, masterVolume: 0.45, visualNoise: false, touchControls: true }, mockStorage);
  const reloadedSettings = loadSettings(mockStorage);
  assert.equal(reloadedSettings.masterVolume, 0.45);
  assert.equal(reloadedSettings.visualNoise, false);
  assert.equal(reloadedSettings.touchControls, true);
});

test('hiding spots lock movement, safely evade hostile shadows, and guide shadow stays non-hostile', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 1;
  const spot = WORLD_INTERACTABLES.find((i) => i.id === 'f1_hide_niche')!;
  state.player.x = spot.x;

  const enterRes = toggleHidingSpot(state, spot.id);
  assert.equal(enterRes.isHiding, true);
  assert.equal(state.player.isHiding, true);
  assert.equal(state.player.flashlightOn, false);

  // Movement stays locked while hidden
  const xBefore = state.player.x;
  updatePlayerMovement(state, { left: false, right: true, run: true, crouch: false }, 0.2);
  assert.equal(state.player.x, xBefore);
  assert.equal(state.player.vx, 0);

  // Hostile shadow on same floor dissipates safely while hiding
  state.installedParts.push('left_arm', 'right_arm', 'left_leg', 'right_leg');
  state.shadowEncounter = {
    active: true,
    floor: 1,
    x: spot.x + 80,
    exposure: 0.7,
    cooldown: 0,
    behavior: 'stalk',
    guideTargetX: undefined,
    guideHintShown: false,
  };
  let evaded = false;
  for (let i = 0; i < 20; i++) {
    const step = updateShadowEncounter(state, 0.15);
    assert.equal(step.startled, false);
    if (step.evaded) {
      evaded = true;
      break;
    }
  }
  assert.equal(evaded, true);

  // Exit hiding spot
  const exitRes = toggleHidingSpot(state, spot.id);
  assert.equal(exitRes.isHiding, false);
  assert.equal(state.player.isHiding, false);

  // Non-hostile guide shadow dissolves peacefully without startling player
  state.player.flashlightOn = true;
  state.shadowEncounter = {
    active: true,
    floor: 1,
    x: state.player.x + 40,
    exposure: 0,
    cooldown: 0,
    behavior: 'guide',
    guideTargetX: state.player.x + 40,
    guideHintShown: true,
  };
  const guideStep = updateShadowEncounter(state, 0.2);
  assert.equal(guideStep.startled, false);
  assert.equal(state.shadowEncounter.active, false);
});

test('close-up inspection hotspots, audio tapes, bonus notes, and chronology timeline unlock properly', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 1;

  // Mirror close-up opens 'inspect' overlay and reveals hidden secret on frame_scratch
  const mirror = WORLD_INTERACTABLES.find((i) => i.id === 'f1_mirror')!;
  state.player.x = mirror.x;
  const openMirror = triggerInteraction(state, mirror);
  assert.equal(openMirror.openOverlay, 'inspect');
  assert.equal(openMirror.activeInspectId, 'mirror');

  const scratch = recordInspectHotspotDiscovery(state, 'mirror', 'frame_scratch');
  assert.equal(scratch.discoveredSecretId, 'secret_mirror_whisper');
  assert.ok(state.discoveredSecrets.includes('secret_mirror_whisper'));

  // Attic mannequin collar_badge unlocks secret_attic_badge
  const badge = recordInspectHotspotDiscovery(state, 'attic_mannequin', 'collar_badge');
  assert.equal(badge.discoveredSecretId, 'secret_attic_badge');

  // Phone answering machine cassette_play saves tape_01 and unlocks timeline entry
  const tape1 = recordInspectHotspotDiscovery(state, 'phone_tape', 'cassette_play');
  assert.equal(tape1.collectedTapeId, 'tape_01');
  assert.ok(state.collectedTapes.includes('tape_01'));

  // Collectible world audio cassette (tape_02)
  const tapeItem = WORLD_INTERACTABLES.find((i) => i.id === 'f2_tape_02')!;
  state.player.floor = 2;
  state.player.x = tapeItem.x;
  const tapeRes = triggerInteraction(state, tapeItem);
  assert.equal(tapeRes.sfx, 'tape');
  assert.ok(state.collectedTapes.includes('tape_02'));

  // Bonus notes (note_13..16) do not inflate the 12 core notes counter
  state.collectedNotes.push('note_01', 'note_02', 'note_13', 'note_14');
  assert.equal(countCoreNotes(state.collectedNotes), 2);
  assert.equal(buildRunSummary(state).notesFound, 2);
  assert.equal(buildRunSummary(state).tapesFound, 2);

  // Timeline unlocks entries matching collected notes / tapes / puzzles
  const unlockedCount = TIMELINE_ENTRIES.filter((entry) => isTimelineEntryUnlocked(state, entry)).length;
  assert.ok(unlockedCount >= 2);
});

test('inputController resolves custom key bindings, handles swaps, and respects secondary aliases', () => {
  const bindings = { ...DEFAULT_KEY_BINDINGS };
  assert.equal(matchesKeyAction('KeyE', 'interact', bindings), true);
  assert.equal(matchesKeyAction('ArrowLeft', 'left', bindings), true);

  // Rebind interact to KeyQ and swap if colliding with flashlight (KeyF)
  const swapped = rebindKeyAction(bindings, 'interact', 'KeyF');
  assert.equal(swapped.interact, 'KeyF');
  assert.equal(swapped.flashlight, 'KeyE');
  assert.equal(matchesKeyAction('KeyF', 'interact', swapped), true);
  assert.equal(matchesKeyAction('KeyE', 'flashlight', swapped), true);

  // If user binds ArrowLeft to inventory, ArrowLeft should no longer trigger left movement
  const arrowBound = rebindKeyAction(bindings, 'inventory', 'ArrowLeft');
  assert.equal(matchesKeyAction('ArrowLeft', 'inventory', arrowBound), true);
  assert.equal(matchesKeyAction('ArrowLeft', 'left', arrowBound), false);

  const held = new Set<string>(['KeyF']);
  assert.equal(isActionHeld(held, 'interact', swapped), true);
  assert.equal(formatKeyCode('Space'), 'Пробел');
  assert.equal(formatKeyCode('KeyJ'), 'J');
});

test('dialogueController handles queueing, typewriter ticking, voice blips, and manual advance', () => {
  const rt = createDialogueRuntime();
  enqueueDialogue(rt, [
    { speaker: 'robot', text: 'Привет', duration: 2.0 },
    { speaker: 'thought', text: 'Второй', duration: 2.0 },
  ]);
  assert.equal(rt.active?.text, 'Привет');

  // Tick enough to advance partial text and emit voice blip
  const tick1 = tickDialogue(rt, 0.08, 'normal');
  assert.equal(tick1.changed, true);
  assert.equal(tick1.voiceBlipSpeaker, 'robot');

  // First advance completes active line, second advance shifts to next queued line
  assert.equal(advanceDialogue(rt), true);
  assert.equal(rt.visibleChars, 'Привет'.length);
  assert.equal(advanceDialogue(rt), true);
  assert.equal(rt.active?.text, 'Второй');
});

test('room-based radio signal investigation detects proximity, respects gates, and archives signals', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 1;
  state.player.x = 560; // Exact spot of sig_kitchen_92

  const kitchenSig = detectNearbyRoomRadioSignal(state);
  assert.equal(kitchenSig.active?.id, 'sig_kitchen_92');
  assert.ok(kitchenSig.strength >= 0.99);
  assert.equal(kitchenSig.newlyDiscovered?.id, 'sig_kitchen_92');
  assert.ok(state.discoveredRadioSignals.includes('sig_kitchen_92'));

  // Calling again does not re-trigger newlyDiscovered
  const secondCheck = detectNearbyRoomRadioSignal(state);
  assert.equal(secondCheck.newlyDiscovered, null);

  // Basement signal requires breakerFixed
  state.player.floor = 0;
  state.player.x = 780;
  assert.equal(detectNearbyRoomRadioSignal(state).active, null);
  state.breakerFixed = true;
  const basementSig = detectNearbyRoomRadioSignal(state);
  assert.equal(basementSig.active?.id, 'sig_basement_104');
  assert.equal(basementSig.newlyDiscovered?.id, 'sig_basement_104');
});

test('content caps (12 core + 8 bonus notes, 10 secrets, 6 inspect objects, 4 radio signals) and unread badges work', () => {
  assert.equal(LORE_NOTES.length, 12);
  assert.equal(BONUS_NOTES.length, 8);
  assert.equal(ALL_NOTES.length, 20);
  assert.equal(SECRETS.length, 10);
  assert.equal(INSPECT_OBJECT_CATALOG.length, 6);
  assert.equal(ROOM_RADIO_SIGNALS.length, 4);

  const state = createInitialGameState(true);
  state.collectedNotes.push('note_01', 'note_17', 'note_20');
  state.collectedTapes.push('tape_01');
  assert.equal(countCoreNotes(state.collectedNotes), 1);
  assert.deepEqual(countUnreadJournalEntries(state), { notes: 3, tapes: 1, total: 4 });

  assert.equal(markNoteAsRead(state, 'note_01'), true);
  assert.equal(markNoteAsRead(state, 'note_01'), false); // idempotent
  assert.equal(markTapeAsRead(state, 'tape_01'), true);
  assert.deepEqual(countUnreadJournalEntries(state), { notes: 2, tapes: 0, total: 2 });

  // Settings persistence for uiScale, touchSize, touchLayout, keyBindings
  const mem = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
  };
  const customSettings = {
    ...loadSettings(storage),
    uiScale: 'large' as const,
    touchSize: 'small' as const,
    touchLayout: 'swapped' as const,
    keyBindings: rebindKeyAction(DEFAULT_KEY_BINDINGS, 'journal', 'KeyN'),
  };
  saveSettings(customSettings, storage);
  const reloaded = loadSettings(storage);
  assert.equal(reloaded.uiScale, 'large');
  assert.equal(reloaded.touchSize, 'small');
  assert.equal(reloaded.touchLayout, 'swapped');
  assert.equal(reloaded.keyBindings.journal, 'KeyN');
});

test('deserializeGameState recovers safely from NaN, out-of-range coordinates, invalid floor/zone, and corrupt arrays', () => {
  const corruptPayload = JSON.stringify({
    saveVersion: 4,
    installedParts: [],
    player: {
      x: null,
      y: 999999,
      floor: 99,
      zone: 'void_dimension',
      facing: 42,
      stamina: -500,
      flashlightBattery: 9999,
      batteries: -4,
      isHiding: true,
    },
    collectedNotes: 'corrupt_string',
    visitedRooms: null,
    activeOverlay: 'terminal',
    finale: { active: true, phase: 'fade', timer: 3 },
    shadowEncounter: { active: true, floor: -9, x: NaN, behavior: 'invalid_mode' },
    playTimeSeconds: -120,
  });

  const restored = deserializeGameState(corruptPayload);
  assert.ok(restored !== null);
  assert.equal(Number.isFinite(restored.player.x), true);
  assert.ok(restored.player.x >= 0 && restored.player.x <= 3000);
  assert.ok(restored.player.y >= 0 && restored.player.y <= 1200);
  assert.ok(restored.player.floor >= 0 && restored.player.floor <= 4);
  assert.equal(restored.player.zone, 'forest');
  assert.equal(restored.player.facing, 1);
  assert.equal(restored.player.stamina, 0);
  assert.equal(restored.player.flashlightBattery, 100);
  assert.equal(restored.player.batteries, 0);
  assert.equal(restored.player.isHiding, false);
  assert.equal(restored.activeOverlay, 'none');
  assert.equal(restored.finale.active, false);
  assert.deepEqual(restored.collectedNotes, []);
  assert.deepEqual(restored.visitedRooms, []);
  assert.equal(restored.shadowEncounter.behavior, 'stalk');
  assert.equal(restored.shadowEncounter.floor, 0);
  assert.equal(restored.playTimeSeconds, 0);
});

test('deserializeGameState filters unknown IDs, enforces disjoint installed/collected parts, and caps journal observations', () => {
  const dirtyPayload = JSON.stringify({
    saveVersion: 4,
    player: { zone: 'house', floor: 1, x: 100, y: 448 },
    installedParts: ['left_arm', 'left_arm', 'bogus_part'],
    collectedParts: ['left_arm', 'head', 'unknown_module'],
    collectedNotes: ['note_01', 'note_999', 'note_01'],
    readNoteIds: ['note_01', 'note_02'],
    collectedTapes: ['tape_01', 'tape_bad'],
    readTapeIds: ['tape_01', 'tape_04'],
    collectedKeys: ['fuse', 'magic_key'],
    discoveredSecrets: ['secret_painting', 'fake_secret'],
    discoveredRadioSignals: ['sig_kitchen_92', 'sig_fake'],
    visitedRooms: ['f1_pantry', 'nonexistent_room'],
    journalObservations: Array.from({ length: 120 }, (_, idx) => `Наблюдение #${idx + 1}`),
  });

  const clean = deserializeGameState(dirtyPayload);
  assert.ok(clean);
  assert.deepEqual(clean.installedParts, ['left_arm']);
  assert.deepEqual(clean.collectedParts, ['head']);
  assert.deepEqual(clean.collectedNotes, ['note_01']);
  assert.deepEqual(clean.readNoteIds, ['note_01']);
  assert.deepEqual(clean.collectedTapes, ['tape_01']);
  assert.deepEqual(clean.readTapeIds, ['tape_01']);
  assert.deepEqual(clean.collectedKeys, ['fuse']);
  assert.deepEqual(clean.discoveredSecrets, ['secret_painting']);
  assert.deepEqual(clean.discoveredRadioSignals, ['sig_kitchen_92']);
  assert.deepEqual(clean.visitedRooms, ['f1_pantry']);
  assert.equal(clean.journalObservations.length, 80);
  assert.equal(clean.journalObservations[0], 'Наблюдение #41');
  assert.equal(clean.journalObservations[79], 'Наблюдение #120');
});

test('simulation update functions clamp NaN, Infinity, and negative dt without corrupting coordinates', () => {
  const s = createInitialGameState(false);
  updatePrologue(s, { left: false, right: true, brake: false }, Number.NaN);
  updatePrologue(s, { left: false, right: true, brake: false }, -5);
  updatePrologue(s, { left: false, right: true, brake: false }, Number.POSITIVE_INFINITY);
  assert.equal(Number.isFinite(s.prologue.speed), true);
  assert.equal(Number.isFinite(s.prologue.distance), true);

  s.player.zone = 'house';
  s.player.floor = 1;
  s.player.x = 500;
  updatePlayerMovement(s, { left: false, right: true, run: true, crouch: false }, Number.NaN);
  updatePlayerMovement(s, { left: true, right: false, run: false, crouch: false }, -1);
  updatePlayerMovement(s, { left: false, right: true, run: false, crouch: false }, Number.POSITIVE_INFINITY);
  assert.equal(Number.isFinite(s.player.x), true);
  assert.equal(Number.isFinite(s.player.vx), true);
  assert.equal(Number.isFinite(s.player.stamina), true);

  updateShadowEncounter(s, Number.NaN);
  updateShadowEncounter(s, -3);
  assert.equal(Number.isFinite(s.shadowEncounter.cooldown), true);

  startFinale(s);
  updateFinale(s, Number.NaN);
  updateFinale(s, -2);
  assert.equal(Number.isFinite(s.finale.timer), true);
});

test('all WORLD_INTERACTABLES references match valid notes, secrets, and parts', () => {
  const noteIds = new Set(ALL_NOTES.map((n) => n.id));
  const secretIds = new Set(SECRETS.map((s) => s.id));
  const partIds = new Set(['left_arm', 'right_arm', 'left_leg', 'right_leg', 'chest_panel', 'head', 'face_panel', 'power_core']);

  for (const item of WORLD_INTERACTABLES) {
    if (item.partId) {
      assert.ok(partIds.has(item.partId), `Invalid partId on ${item.id}: ${item.partId}`);
    }
    if (item.noteId) {
      assert.ok(noteIds.has(item.noteId), `Invalid noteId on ${item.id}: ${item.noteId}`);
    }
    if (item.secretId) {
      assert.ok(secretIds.has(item.secretId), `Invalid secretId on ${item.id}: ${item.secretId}`);
    }
    if (item.requiresSecret) {
      assert.ok(secretIds.has(item.requiresSecret), `Invalid requiresSecret on ${item.id}: ${item.requiresSecret}`);
    }
  }
});
