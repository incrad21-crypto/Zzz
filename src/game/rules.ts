export {
  checkInteractableRequirements,
  findNearestInteractable,
  getInteractableEffectiveX,
  isInteractableAvailable,
  triggerInteraction,
  updateShadowEncounter,
} from './systems/InteractionSystem';
export type { InteractionResult, RequirementCheckResult } from './systems/InteractionSystem';

export {
  countAllNotes,
  countCoreNotes,
  countUnreadJournalEntries,
  markNoteAsRead,
  markTapeAsRead,
  reloadFlashlightBattery,
} from './systems/InventorySystem';

export { LootSystem, collectContainerLoot } from './systems/LootSystem';
export type { LootClaimResult } from './systems/LootSystem';

export {
  ACCEL_RATE,
  BRAKE_RATE,
  RUN_SPEED,
  STAMINA_DRAIN,
  STAMINA_RECOVER,
  WALK_SPEED,
  detectNearbyRoomRadioSignal,
  getCurrentRoomName,
  getDifficultyProfile,
  getHorizontalBounds,
  toggleHidingSpot,
  updatePlayerMovement,
  updatePrologue,
} from './systems/MovementSystem';
export type { DifficultyProfile, RoomRadioDetectionResult } from './systems/MovementSystem';

export {
  buildRunSummary,
  chooseFinaleEnding,
  getCurrentObjective,
  getLightingStage,
  getRobotState,
  installPartOnRobot,
  startFinale,
  updateFinale,
} from './systems/ProgressionSystem';

export {
  CLOCK_TARGET_HOUR,
  CLOCK_TARGET_MINUTE,
  STUDY_SAFE_CODE,
  isTimelineEntryUnlocked,
  recordInspectHotspotDiscovery,
  recordRadioSecret,
  solveBreakerPuzzle,
  solveClockPuzzle,
  solveTerminalPuzzle,
  submitSafeCode,
} from './systems/PuzzleSystem';

export {
  createInitialGameState,
  deserializeGameState,
  serializeGameState,
} from './systems/SaveSerializer';
