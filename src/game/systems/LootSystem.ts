import { KEY_LABELS, LORE_NOTES, PART_BY_ID } from '../content';
import { DialogueMessage, GameState } from '../types';
import { WORLD_INTERACTABLES } from '../world';

export interface LootClaimResult {
  claimed: boolean;
  wasAlreadyLooted: boolean;
  partTaken?: string;
  keyTaken?: string;
  noteTakenId?: string;
  batteriesTaken: number;
  dialogues: DialogueMessage[];
}

export const LootSystem = {
  claim(state: GameState, containerId: string): LootClaimResult {
    const item = WORLD_INTERACTABLES.find((i) => i.id === containerId);
    if (!item) {
      return {
        claimed: false,
        wasAlreadyLooted: false,
        batteriesTaken: 0,
        dialogues: [],
      };
    }

    const wasAlreadyLooted = state.lootedContainers.includes(containerId);

    if (!state.openedContainers.includes(containerId)) {
      state.openedContainers.push(containerId);
    }
    if (!wasAlreadyLooted) {
      state.lootedContainers.push(containerId);
    }

    if (wasAlreadyLooted) {
      return {
        claimed: false,
        wasAlreadyLooted: true,
        batteriesTaken: 0,
        dialogues: [
          {
            speaker: 'thought',
            text: item.emptyText ?? 'Внутри уже пусто — всё полезное я забрал.',
            duration: 2.6,
          },
        ],
      };
    }

    const foundLabels: string[] = [];
    let partTaken: string | undefined;
    let keyTaken: string | undefined;
    let noteTakenId: string | undefined;
    let batteriesTaken = 0;

    if (
      item.partId &&
      !state.collectedParts.includes(item.partId) &&
      !state.installedParts.includes(item.partId)
    ) {
      const def = PART_BY_ID[item.partId];
      if (def) {
        state.collectedParts.push(item.partId);
        const obs = `Найдена деталь: ${def.name} (${def.locationHint}).`;
        if (!state.journalObservations.includes(obs)) {
          state.journalObservations.push(obs);
        }
        foundLabels.push(`деталь: ${def.name}`);
        partTaken = def.name;
      }
    }

    if (item.keyId && !state.collectedKeys.includes(item.keyId)) {
      state.collectedKeys.push(item.keyId);
      const kLabel = KEY_LABELS[item.keyId] ?? item.keyId;
      const obs = `Найден предмет: ${kLabel}.`;
      if (!state.journalObservations.includes(obs)) {
        state.journalObservations.push(obs);
      }
      foundLabels.push(kLabel.toLowerCase());
      keyTaken = kLabel;
    }

    if (item.noteId && !state.collectedNotes.includes(item.noteId)) {
      state.collectedNotes.push(item.noteId);
      const note = LORE_NOTES.find((n) => n.id === item.noteId);
      if (note) {
        const obs = `Прочитана записка №${note.number}: «${note.title}».`;
        if (!state.journalObservations.includes(obs)) {
          state.journalObservations.push(obs);
        }
        foundLabels.push(`записку №${note.number}`);
      }
      noteTakenId = item.noteId;
    }

    if (item.batteryCount && item.batteryCount > 0) {
      batteriesTaken = item.batteryCount;
      state.player.batteries += batteriesTaken;
      foundLabels.push(`батарейку (${batteriesTaken} шт.)`);
    }

    const dialogues: DialogueMessage[] =
      foundLabels.length > 0
        ? [
            {
              speaker: 'thought',
              text: `Забрано из «${item.label}»: ${foundLabels.join(', ')}.`,
              duration: 3.4,
            },
          ]
        : [
            {
              speaker: 'thought',
              text: item.emptyText ?? 'Внутри ничего полезного нет.',
              duration: 2.6,
            },
          ];

    return {
      claimed: foundLabels.length > 0,
      wasAlreadyLooted: false,
      partTaken,
      keyTaken,
      noteTakenId,
      batteriesTaken,
      dialogues,
    };
  },
};

export function collectContainerLoot(
  state: GameState,
  containerId: string
): LootClaimResult {
  return LootSystem.claim(state, containerId);
}
