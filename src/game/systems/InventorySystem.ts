import { ALL_NOTES, LORE_NOTES } from '../content';
import { AudioTapeId, DialogueMessage, GameState } from '../types';

const VALID_NOTE_IDS = new Set<string>(ALL_NOTES.map((n) => n.id));
const CORE_NOTE_IDS = new Set<string>(LORE_NOTES.map((n) => n.id));

export function reloadFlashlightBattery(state: GameState): {
  reloaded: boolean;
  dialogue: DialogueMessage;
} {
  if (!state.player.hasFlashlight) {
    return {
      reloaded: false,
      dialogue: { speaker: 'thought', text: 'Сначала нужно найти фонарик.', duration: 2.2 },
    };
  }
  if (state.player.batteries <= 0) {
    return {
      reloaded: false,
      dialogue: {
        speaker: 'thought',
        text: 'Запасных батареек нет — поищи в ящиках и тумбочках.',
        duration: 2.6,
      },
    };
  }
  if (state.player.flashlightBattery >= 94) {
    return {
      reloaded: false,
      dialogue: { speaker: 'thought', text: 'Батарея фонарика почти полная.', duration: 2.0 },
    };
  }
  state.player.batteries -= 1;
  state.player.flashlightBattery = 100;
  return {
    reloaded: true,
    dialogue: {
      speaker: 'thought',
      text: `Вставлена новая батарейка (осталось запасных: ${state.player.batteries}).`,
      duration: 2.5,
    },
  };
}

export function countCoreNotes(collectedNotes: string[]): number {
  const seen = new Set<string>();
  for (const id of collectedNotes) {
    if (CORE_NOTE_IDS.has(id)) {
      seen.add(id);
    }
  }
  return seen.size;
}

export function countAllNotes(collectedNotes: string[]): number {
  const seen = new Set<string>();
  for (const id of collectedNotes) {
    if (VALID_NOTE_IDS.has(id)) {
      seen.add(id);
    }
  }
  return seen.size;
}

export function markNoteAsRead(state: GameState, noteId: string): boolean {
  if (!state.collectedNotes.includes(noteId) || state.readNoteIds.includes(noteId)) {
    return false;
  }
  state.readNoteIds.push(noteId);
  return true;
}

export function markTapeAsRead(state: GameState, tapeId: AudioTapeId): boolean {
  if (!state.collectedTapes.includes(tapeId) || state.readTapeIds.includes(tapeId)) {
    return false;
  }
  state.readTapeIds.push(tapeId);
  return true;
}

export function countUnreadJournalEntries(state: {
  collectedNotes: string[];
  readNoteIds: string[];
  collectedTapes: AudioTapeId[];
  readTapeIds: AudioTapeId[];
}): { notes: number; tapes: number; total: number } {
  const unreadNotes = state.collectedNotes.filter((id) => !state.readNoteIds.includes(id)).length;
  const unreadTapes = state.collectedTapes.filter((id) => !state.readTapeIds.includes(id)).length;
  return { notes: unreadNotes, tapes: unreadTapes, total: unreadNotes + unreadTapes };
}
