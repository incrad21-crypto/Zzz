import { AudioTapeId, EndingId, InspectTargetId, PartId } from './types';

export interface GameEventMap {
  'room:entered': { roomId: string; floor: number };
  'part:collected': { partId: PartId };
  'part:installed': { partId: PartId; installedCount: number };
  'note:collected': { noteId: string };
  'tape:collected': { tapeId: AudioTapeId };
  'secret:discovered': { secretId: string };
  'puzzle:solved': { puzzle: 'clock' | 'safe' | 'terminal' | 'breaker' | 'radio' };
  'inspect:opened': { inspectId: InspectTargetId };
  'player:hide_changed': { isHiding: boolean; spotId: string | null };
  'shadow:event': { kind: 'spawned' | 'startled' | 'evaded' | 'guide'; floor: number };
  'ending:reached': { endingId: EndingId };
  'save:persisted': { timestamp: number };
}

type EventKey = keyof GameEventMap;
type EventListener<K extends EventKey> = (payload: GameEventMap[K]) => void;

const MAX_RECURSION_DEPTH = 8;

export class GameEventBus {
  private listeners = new Map<EventKey, Set<EventListener<EventKey>>>();
  private emitDepth = 0;

  public on<K extends EventKey>(event: K, listener: EventListener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as EventListener<EventKey>);
    return () => {
      set?.delete(listener as EventListener<EventKey>);
    };
  }

  public emit<K extends EventKey>(event: K, payload: GameEventMap[K]): void {
    if (this.emitDepth >= MAX_RECURSION_DEPTH) return;
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    this.emitDepth += 1;
    try {
      for (const listener of [...set]) {
        listener(payload);
      }
    } finally {
      this.emitDepth -= 1;
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const gameEventBus = new GameEventBus();
