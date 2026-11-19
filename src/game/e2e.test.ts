import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_NOTES, AUDIO_TAPES, ROBOT_PARTS, ROOM_RADIO_SIGNALS, SECRETS } from './content';
import {
  createGamepadPrevButtons,
  GamepadLike,
  readGamepadSnapshot,
} from './controllers/gamepadController';
import { canUnlockLastRecordEnding } from './dialogueDirector';
import {
  formatDirectionalSoundCaption,
  trackVisitedRoom,
  updateHorrorDirector,
} from './horrorDirector';
import {
  buildRunSummary,
  chooseFinaleEnding,
  collectContainerLoot,
  countAllNotes,
  countCoreNotes,
  createInitialGameState,
  detectNearbyRoomRadioSignal,
  findNearestInteractable,
  getHorizontalBounds,
  getInteractableEffectiveX,
  installPartOnRobot,
  recordInspectHotspotDiscovery,
  recordRadioSecret,
  solveBreakerPuzzle,
  solveClockPuzzle,
  solveTerminalPuzzle,
  submitSafeCode,
  triggerInteraction,
  updateFinale,
  updatePlayerMovement,
  updatePrologue,
  updateShadowEncounter,
} from './rules';
import {
  deleteSaveSlot,
  exportSavePayload,
  formatSaveTimestamp,
  importSavePayload,
  listSaveSlots,
  loadFromSlot,
  loadSettingsWithStatus,
  saveToSlot,
  SETTINGS_KEY,
  StorageLike,
} from './saveManager';
import { GameState, Interactable, PartId } from './types';
import {
  FLOOR_BOUNDS,
  FOREST_GROUND_Y,
  FOREST_MAX_X,
  getHouseFloorY,
  HOUSE_PROPS,
  HOUSE_ROOMS,
  WORLD_INTERACTABLES,
} from './world';

function findItem(id: string): Interactable {
  const item = WORLD_INTERACTABLES.find((entry) => entry.id === id);
  assert.ok(item, `Missing interactable: ${id}`);
  return item;
}

function moveAndTrigger(state: GameState, id: string) {
  const item = findItem(id);
  state.player.zone = item.zone;
  if (item.floor !== undefined) {
    state.player.floor = item.floor as GameState['player']['floor'];
    state.player.y = getHouseFloorY(item.floor);
  } else {
    state.player.y = FOREST_GROUND_Y;
  }
  state.player.x = item.x;
  trackVisitedRoom(state);
  return triggerInteraction(state, item);
}

test('E2E walkthrough: prologue -> forest -> 23 rooms -> 6 puzzles -> 10 secrets -> 20 notes -> 4 tapes -> 4 radio signals -> 3 endings + negative guards', () => {
  const state = createInitialGameState(false);

  // 1. Prologue car sequence
  assert.equal(state.player.zone, 'car_prologue');
  for (let i = 0; i < 65; i++) {
    updatePrologue(state, { left: false, right: true, brake: false }, 0.25);
  }
  assert.equal(state.prologue.phase, 'stalled');

  // Exit car to forest road
  state.player.zone = 'forest';
  state.player.x = 105;
  state.player.y = FOREST_GROUND_Y;
  assert.equal(state.player.hasFlashlight, false);

  // Trunk grants flashlight & advances prologue phase
  const trunkRes = moveAndTrigger(state, 'forest_car_trunk');
  assert.equal(state.player.hasFlashlight, true);
  assert.equal(state.player.flashlightOn, true);
  assert.ok(trunkRes.dialogues.length > 0);

  // Enter house from forest road
  const enterRes = moveAndTrigger(state, 'forest_house_door');
  assert.equal(state.player.zone, 'house');
  assert.equal(state.player.floor, 1);
  assert.equal(enterRes.shouldSave, true);

  // 2. Negative checks before collecting keys / solving puzzles
  const lockedBasement = moveAndTrigger(state, 'f1_basement_door');
  assert.equal(lockedBasement.sfx, 'locked');
  assert.equal(state.player.floor, 1);

  state.player.floor = 3;
  state.player.x = 680;
  assert.equal(getHorizontalBounds(state).maxX, 712);

  const lockedAttic = moveAndTrigger(state, 'f3_attic_hatch');
  assert.equal(lockedAttic.sfx, 'locked');
  assert.equal(state.player.floor, 3);

  const lockedVent = moveAndTrigger(state, 'b_vent_in');
  assert.equal(lockedVent.sfx, 'locked');
  assert.equal(state.player.floor, 0);

  const wrongSafe = submitSafeCode(state, '9999');
  assert.equal(wrongSafe.success, false);
  assert.equal(state.safeUnlocked, false);

  const missingInstall = installPartOnRobot(state, 'power_core');
  assert.equal(missingInstall.success, false);

  // 3. Floor 1 full exploration & pantry workbench
  moveAndTrigger(state, 'f1_mirror');
  const mirrorSecret = recordInspectHotspotDiscovery(state, 'mirror', 'frame_scratch');
  assert.equal(mirrorSecret.discoveredSecretId, 'secret_mirror_whisper');

  moveAndTrigger(state, 'f1_phone');
  recordInspectHotspotDiscovery(state, 'phone_tape', 'cassette_play');
  assert.ok(state.collectedTapes.includes('tape_01'));
  assert.equal(state.phoneListened, true);

  moveAndTrigger(state, 'f1_note_13');
  moveAndTrigger(state, 'f1_note_01');
  moveAndTrigger(state, 'f1_note_17');

  const kitchenCab = moveAndTrigger(state, 'f1_kitchen_cabinet');
  assert.equal(kitchenCab.openOverlay, 'container');
  collectContainerLoot(state, 'f1_kitchen_cabinet');
  assert.ok(state.collectedKeys.includes('fuse'));
  // Duplicate loot guard
  const dupKitchen = collectContainerLoot(state, 'f1_kitchen_cabinet');
  assert.equal(dupKitchen.keyTaken, undefined);

  // Kitchen radio signal (92.4 MHz)
  state.player.floor = 1;
  state.player.x = 560;
  const sigKitchen = detectNearbyRoomRadioSignal(state);
  assert.equal(sigKitchen.newlyDiscovered?.id, 'sig_kitchen_92');

  moveAndTrigger(state, 'f1_secret_stairs');
  assert.ok(state.collectedKeys.includes('attic_crowbar'));
  moveAndTrigger(state, 'f1_secret_painting');

  moveAndTrigger(state, 'f1_pantry_tools');
  collectContainerLoot(state, 'f1_pantry_tools');

  // Visit living/hall rooms & meet Echo-4
  state.player.x = 260;
  trackVisitedRoom(state);
  moveAndTrigger(state, 'f1_robot_workbench');
  assert.equal(state.robotFirstMet, true);

  // 4. Floor 2 exploration + clock + safe + bedroom/bathroom/storage
  moveAndTrigger(state, 'f1_stairs_up');
  assert.equal(state.player.floor, 2);

  moveAndTrigger(state, 'f2_secret_wardrobe');
  moveAndTrigger(state, 'f2_part_right_arm');
  assert.ok(state.collectedParts.includes('right_arm'));

  const clockRes = solveClockPuzzle(state);
  assert.equal(clockRes.alreadySolved, false);
  assert.ok(state.collectedKeys.includes('basement_key'));

  moveAndTrigger(state, 'f2_tape_02');
  moveAndTrigger(state, 'f2_nightstand_key');
  collectContainerLoot(state, 'f2_nightstand_key'); // note_05

  // Bedroom radio signal (98.6 MHz)
  state.player.floor = 2;
  state.player.x = 150;
  trackVisitedRoom(state);
  const sigBedroom = detectNearbyRoomRadioSignal(state);
  assert.equal(sigBedroom.newlyDiscovered?.id, 'sig_bedroom_98');

  moveAndTrigger(state, 'f2_secret_blueprint');
  moveAndTrigger(state, 'f2_note_02');
  const safeRes = submitSafeCode(state, '0419');
  assert.equal(safeRes.success, true);
  assert.ok(state.collectedKeys.includes('tech_key'));
  moveAndTrigger(state, 'f2_note_03');

  moveAndTrigger(state, 'f2_secret_bathroom');
  moveAndTrigger(state, 'f2_part_left_arm');
  moveAndTrigger(state, 'f2_note_14');
  moveAndTrigger(state, 'f2_note_18');
  moveAndTrigger(state, 'f2_storage_crate');
  collectContainerLoot(state, 'f2_storage_crate'); // note_04

  // Install 2 collected parts on workbench to reach minInstalled >= 2 (required for lab signal)
  assert.equal(installPartOnRobot(state, 'right_arm').success, true);
  assert.equal(installPartOnRobot(state, 'left_arm').success, true);

  // 5. Floor 3 exploration + terminal + tech room + crate
  moveAndTrigger(state, 'f2_stairs_up');
  assert.equal(state.player.floor, 3);

  moveAndTrigger(state, 'f3_part_left_leg');
  moveAndTrigger(state, 'f3_note_19');
  moveAndTrigger(state, 'f3_secret_workshop');
  solveTerminalPuzzle(state);
  assert.equal(state.terminalSolved, true);

  // Lab radio signal (104.8 MHz)
  state.player.floor = 3;
  state.player.x = 470;
  trackVisitedRoom(state);
  const sigLab = detectNearbyRoomRadioSignal(state);
  assert.equal(sigLab.newlyDiscovered?.id, 'sig_lab_104');

  moveAndTrigger(state, 'f3_note_06');
  moveAndTrigger(state, 'f3_note_07');
  moveAndTrigger(state, 'f3_tape_03');

  // With tech_key we can cross into f3_tech
  assert.ok(getHorizontalBounds(state).maxX > 900);
  moveAndTrigger(state, 'f3_part_right_leg');
  moveAndTrigger(state, 'f3_note_08');

  moveAndTrigger(state, 'f3_crate_chest');
  collectContainerLoot(state, 'f3_crate_chest'); // chest_panel
  moveAndTrigger(state, 'f3_note_15');

  // 6. Floor 4 (Attic) exploration + mannequin secret + radio 104.8
  moveAndTrigger(state, 'f3_attic_hatch');
  assert.equal(state.player.floor, 4);

  moveAndTrigger(state, 'f4_attic_chest');
  collectContainerLoot(state, 'f4_attic_chest'); // head
  moveAndTrigger(state, 'f4_secret_floorboard');
  const badgeRes = recordInspectHotspotDiscovery(state, 'attic_mannequin', 'collar_badge');
  assert.equal(badgeRes.discoveredSecretId, 'secret_attic_badge');

  recordRadioSecret(state);
  assert.equal(state.radioTunedSecret, true);
  moveAndTrigger(state, 'f4_note_09');
  moveAndTrigger(state, 'f4_note_20');
  moveAndTrigger(state, 'f4_east_trunk');
  collectContainerLoot(state, 'f4_east_trunk'); // note_10

  // Visit west/center/east attic rooms
  state.player.x = 200;
  trackVisitedRoom(state);
  state.player.x = 520;
  trackVisitedRoom(state);

  // 7. Floor 0 (Basement) exploration + breaker + vent + secret room + archive
  moveAndTrigger(state, 'f1_basement_door');
  assert.equal(state.player.floor, 0);

  moveAndTrigger(state, 'b_note_11');
  moveAndTrigger(state, 'b_note_16');
  moveAndTrigger(state, 'b_tape_04');
  moveAndTrigger(state, 'b_storage_crate');
  collectContainerLoot(state, 'b_storage_crate'); // face_panel

  solveBreakerPuzzle(state);
  assert.equal(state.breakerFixed, true);

  // Basement boiler radio signal (104.8 MHz after breakerFixed)
  state.player.floor = 0;
  state.player.x = 780;
  trackVisitedRoom(state);
  const sigBasement = detectNearbyRoomRadioSignal(state);
  assert.equal(sigBasement.newlyDiscovered?.id, 'sig_basement_104');

  // Crawl through unlocked vent into creator's secret room
  const ventRes = moveAndTrigger(state, 'b_vent_in');
  assert.equal(ventRes.sfx, 'secret');
  assert.equal(state.player.x, 270);
  trackVisitedRoom(state);
  moveAndTrigger(state, 'b_part_power');
  moveAndTrigger(state, 'b_note_12');
  state.player.x = 120;
  trackVisitedRoom(state);

  // Visit every remaining room in HOUSE_ROOMS
  for (const room of HOUSE_ROOMS) {
    state.player.floor = room.floor as GameState['player']['floor'];
    state.player.x = room.x + Math.floor(room.width / 2);
    trackVisitedRoom(state);
  }

  // Verify 100% collection counts before final assembly
  assert.equal(countCoreNotes(state.collectedNotes), 12);
  assert.equal(countAllNotes(state.collectedNotes), ALL_NOTES.length);
  assert.equal(state.collectedTapes.length, AUDIO_TAPES.length);
  assert.equal(state.discoveredRadioSignals.length, ROOM_RADIO_SIGNALS.length);
  assert.equal(state.discoveredSecrets.length, SECRETS.length);
  assert.equal(state.visitedRooms.length, HOUSE_ROOMS.length);
  assert.equal(state.installedParts.length + state.collectedParts.length, 8);

  // Install remaining 6 parts sequentially
  const remainingParts: PartId[] = [
    'left_leg',
    'right_leg',
    'chest_panel',
    'head',
    'face_panel',
    'power_core',
  ];
  for (let i = 0; i < remainingParts.length; i++) {
    const partId = remainingParts[i];
    assert.ok(partId);
    const res = installPartOnRobot(state, partId);
    assert.equal(res.success, true);
    if (i < remainingParts.length - 1) {
      assert.equal(res.triggeredFinale, false);
    } else {
      assert.equal(res.triggeredFinale, true);
    }
  }

  assert.equal(state.installedParts.length, 8);
  assert.equal(state.finale.active, true);
  assert.equal(canUnlockLastRecordEnding(state), true);

  // Advance finale into interactive choice phase
  for (let i = 0; i < 120 && state.finale.phase !== 'choice'; i++) {
    updateFinale(state, 0.25);
  }
  assert.equal(state.finale.phase, 'choice');

  // Verify negative last_record gating on restricted clone
  const restricted: GameState = JSON.parse(JSON.stringify(state));
  restricted.radioTunedSecret = false;
  assert.equal(canUnlockLastRecordEnding(restricted), false);
  chooseFinaleEnding(restricted, 'last_record');
  assert.equal(restricted.finale.selectedEnding, 'awakening');

  // Verify all 3 valid endings finish cleanly with complete summary metrics
  for (const ending of ['awakening', 'liberation', 'last_record'] as const) {
    const branch: GameState = JSON.parse(JSON.stringify(state));
    chooseFinaleEnding(branch, ending);
    let finResult = updateFinale(branch, 0.25);
    for (let step = 0; step < 50 && !finResult.finished; step++) {
      finResult = updateFinale(branch, 0.25);
    }
    assert.equal(finResult.finished, true);
    const summary = buildRunSummary(branch);
    assert.equal(summary.endingId, ending);
    assert.equal(summary.partsInstalled, 8);
    assert.equal(summary.totalNotesFound, 20);
    assert.equal(summary.tapesFound, 4);
    assert.equal(summary.secretsFound, 10);
    assert.equal(summary.roomsVisited, 23);
  }
});

test('DifficultyMode scales stamina drain/recovery, shadow exposure, and HorrorDirector cooldowns cleanly', () => {
  const storyState = createInitialGameState(true);
  const tensionState = createInitialGameState(true);
  storyState.player.zone = 'house';
  storyState.player.floor = 1;
  storyState.player.x = 500;
  tensionState.player.zone = 'house';
  tensionState.player.floor = 1;
  tensionState.player.x = 500;

  updatePlayerMovement(storyState, { left: false, right: true, run: true, crouch: false }, 0.25, 'story');
  updatePlayerMovement(tensionState, { left: false, right: true, run: true, crouch: false }, 0.25, 'tension');
  assert.ok(storyState.player.stamina > tensionState.player.stamina);

  // Shadow exposure comparison
  const makeShadowState = () => {
    const s = createInitialGameState(true);
    s.player.zone = 'house';
    s.player.floor = 2;
    s.player.x = 400;
    s.player.facing = 1;
    s.player.hasFlashlight = true;
    s.player.flashlightOn = true;
    s.installedParts = ['left_arm', 'right_arm', 'left_leg', 'right_leg'];
    s.shadowEncounter = {
      active: true,
      x: 490,
      floor: 2,
      exposure: 0,
      cooldown: 0,
      behavior: 'observe',
      guideHintShown: false,
      guideTargetX: undefined,
    };
    return s;
  };
  const sStory = makeShadowState();
  const sTension = makeShadowState();
  updateShadowEncounter(sStory, 0.25, 'story');
  updateShadowEncounter(sTension, 0.25, 'tension');
  assert.ok(sTension.shadowEncounter.exposure > sStory.shadowEncounter.exposure);

  // HorrorDirector anomaly cooldowns scale by difficulty
  const hStory = createInitialGameState(true);
  const hTension = createInitialGameState(true);
  for (const st of [hStory, hTension]) {
    st.player.zone = 'house';
    st.player.floor = 1;
    st.player.x = 300;
    st.installedParts = ['left_arm'];
    st.horror.cooldown = 0;
    st.horror.lastRoomId = 'f1_living';
    st.horror.roomDwellTime = 6.5;
  }
  const anomStory = updateHorrorDirector(hStory, 0.1, 'story');
  const anomTension = updateHorrorDirector(hTension, 0.1, 'tension');
  assert.ok(anomStory && anomTension);
  assert.equal(hStory.horror.cooldown, 36);
  assert.equal(hTension.horror.cooldown, 21);
});

test('GamepadController applies stick deadzone, edge-triggered actions, and disconnect reset', () => {
  const prev = createGamepadPrevButtons();
  const makePad = (axisX: number, pressedIndices: number[]): GamepadLike => ({
    connected: true,
    axes: [axisX, 0],
    buttons: Array.from({ length: 16 }, (_, idx) => ({ pressed: pressedIndices.includes(idx) })),
  });

  // Drift below deadzone ignored
  const driftSnap = readGamepadSnapshot(makePad(0.18, []), prev);
  assert.equal(driftSnap.connected, true);
  assert.equal(driftSnap.left, false);
  assert.equal(driftSnap.right, false);

  // Active stick + button press edge trigger
  const frame1 = readGamepadSnapshot(makePad(0.8, [0, 2, 9]), prev);
  assert.equal(frame1.right, true);
  assert.equal(frame1.justInteract, true);
  assert.equal(frame1.justFlashlight, true);
  assert.equal(frame1.justPause, true);

  // Holding same buttons on next frame must NOT re-trigger just* flags
  const frame2 = readGamepadSnapshot(makePad(0.8, [0, 2, 9]), prev);
  assert.equal(frame2.right, true);
  assert.equal(frame2.justInteract, false);
  assert.equal(frame2.justFlashlight, false);
  assert.equal(frame2.justPause, false);

  // Disconnecting resets previous latch cleanly
  const disconnected = readGamepadSnapshot(null, prev);
  assert.equal(disconnected.connected, false);
  const reconnected = readGamepadSnapshot(makePad(-0.7, [0]), prev);
  assert.equal(reconnected.left, true);
  assert.equal(reconnected.justInteract, true);
});

test('Directional sound captions, save timestamps, and difficulty/soundCaptions settings sanitize cleanly', () => {
  assert.equal(formatDirectionalSoundCaption('knock', -0.7), '[Звук слева: глухой стук]');
  assert.equal(formatDirectionalSoundCaption('whisper', 0.65), '[Звук справа: тихий шёпот]');
  assert.equal(formatDirectionalSoundCaption('creak', 0.05), '[Звук рядом: скрип дерева]');

  const sampleTs = new Date(2026, 10, 19, 8, 5).getTime();
  assert.equal(formatSaveTimestamp(sampleTs), '19.11 · 08:05');
  assert.equal(formatSaveTimestamp(undefined), null);

  const storage: StorageLike = {
    getItem: (k) =>
      k === SETTINGS_KEY
        ? JSON.stringify({ difficulty: 'invalid_mode', soundCaptions: false })
        : null,
    setItem: () => {},
  };
  const loaded = loadSettingsWithStatus(storage);
  assert.equal(loaded.settings.difficulty, 'standard');
  assert.equal(loaded.settings.soundCaptions, false);
});

test('World geometry invariants: all props, interactables, radio signals, and items stay inside valid room & floor bounds', () => {
  for (const prop of HOUSE_PROPS) {
    const bounds = (FLOOR_BOUNDS as Record<number, { minX: number; maxX: number }>)[prop.floor];
    assert.ok(bounds, `Missing FLOOR_BOUNDS for prop ${prop.id}`);
    assert.ok(prop.x >= bounds.minX && prop.x <= bounds.maxX, `Prop ${prop.id} out of floor bounds: ${prop.x}`);
    const room = HOUSE_ROOMS.find((r) => r.floor === prop.floor && prop.x >= r.x && prop.x <= r.x + r.width);
    assert.ok(room, `Prop ${prop.id} at x=${prop.x} not inside any room on floor ${prop.floor}`);
  }

  for (const item of WORLD_INTERACTABLES) {
    if (item.zone === 'house') {
      assert.ok(item.floor !== undefined, `House interactable missing floor: ${item.id}`);
      const bounds = (FLOOR_BOUNDS as Record<number, { minX: number; maxX: number }>)[item.floor];
      assert.ok(bounds, `Missing FLOOR_BOUNDS for interactable ${item.id}`);
      assert.ok(item.x >= bounds.minX && item.x <= bounds.maxX, `Interactable ${item.id} out of bounds: ${item.x}`);
      const room = HOUSE_ROOMS.find((r) => r.floor === item.floor && item.x >= r.x && item.x <= r.x + r.width);
      assert.ok(room, `Interactable ${item.id} at x=${item.x} not inside any room on floor ${item.floor}`);
    } else if (item.zone === 'forest') {
      assert.ok(item.x >= 0 && item.x <= FOREST_MAX_X, `Forest interactable ${item.id} out of bounds: ${item.x}`);
    }
  }

  for (const part of ROBOT_PARTS) {
    assert.ok(WORLD_INTERACTABLES.some((i) => i.partId === part.id), `Missing world placement for part ${part.id}`);
  }
  for (const sig of ROOM_RADIO_SIGNALS) {
    const room = HOUSE_ROOMS.find((r) => r.id === sig.roomId);
    assert.ok(room && room.floor === sig.floor && sig.x >= room.x && sig.x <= room.x + room.width, `Invalid radio signal room: ${sig.id}`);
  }
});

test('QA regressions: moved attic mannequin coordinates sync with interaction reach and portrait lore name stays consistent', () => {
  const state = createInitialGameState(true);
  state.player.zone = 'house';
  state.player.floor = 4;
  const mannequin = findItem('f4_mannequin');

  // Before stage 5: centered at base x=372
  assert.equal(getInteractableEffectiveX(state, mannequin), 372);
  state.player.x = 372;
  assert.equal(findNearestInteractable(state)?.id, 'f4_mannequin');

  // After stage >= 5: shifted +42px to x=414, still interactable directly beside it at x=435
  state.atmospheric.mannequinMoved = true;
  assert.equal(getInteractableEffectiveX(state, mannequin), 414);
  state.player.x = 435;
  assert.equal(findNearestInteractable(state)?.id, 'f4_mannequin');

  // Portrait inscription lore matches Marina consistently
  const obsRes = recordInspectHotspotDiscovery(state, 'portrait', 'back_inscription');
  assert.match(obsRes.observation ?? '', /Марина/);
  assert.doesNotMatch(obsRes.observation ?? '', /Анна/);
});

test('Save slot CRUD, JSON export/import round-trip, and corruption rejection work cleanly', () => {
  const store = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };

  const st = createInitialGameState(true);
  st.player.zone = 'house';
  st.player.floor = 3;
  st.collectedNotes.push('note_01', 'note_15');
  st.installedParts.push('left_arm', 'right_arm');

  const saved = saveToSlot('slot_2', st, storage);
  assert.equal(saved.success, true);

  const slots = listSaveSlots(storage);
  assert.equal(slots.find((s) => s.slotId === 'slot_2')?.summary?.partsInstalled, 2);
  assert.equal(slots.find((s) => s.slotId === 'slot_2')?.summary?.totalNotesFound, 2);

  const loaded = loadFromSlot('slot_2', storage);
  assert.equal(loaded.corrupted, false);
  assert.deepEqual(loaded.state?.collectedNotes, ['note_01', 'note_15']);

  const exported = exportSavePayload(st);
  const imported = importSavePayload(exported);
  assert.ok(imported.state);
  assert.deepEqual(imported.state.installedParts, ['left_arm', 'right_arm']);

  const invalidImport = importSavePayload('{not-valid-json');
  assert.equal(invalidImport.state, null);
  assert.ok(invalidImport.error);

  deleteSaveSlot('slot_2', storage);
  assert.equal(listSaveSlots(storage).find((s) => s.slotId === 'slot_2')?.summary, null);
});

