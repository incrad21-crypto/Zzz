import { soundEngine } from '../audio';
import { gameDiagnostics } from '../diagnostics';
import { gameEventBus } from '../eventBus';

export interface EventListenersHooks {
  onMilestone?: (label: string) => void;
}

/**
 * Connects real game systems (diagnostics trace, reactive milestone audio cues)
 * to GameEventBus events so the bus drives real cross-cutting reactions.
 */
export function registerGameEventListeners(hooks: EventListenersHooks = {}): () => void {
  const unsubscribers: Array<() => void> = [];

  unsubscribers.push(
    gameEventBus.on('room:entered', () => {
      gameDiagnostics.recordEventTrace();
    })
  );

  unsubscribers.push(
    gameEventBus.on('part:collected', ({ partId }) => {
      gameDiagnostics.recordEventTrace();
      hooks.onMilestone?.(`part:collected:${partId}`);
    })
  );

  unsubscribers.push(
    gameEventBus.on('part:installed', ({ partId, installedCount }) => {
      gameDiagnostics.recordEventTrace();
      if (installedCount === 4 || installedCount === 7) {
        soundEngine.playSfx('unlock');
      }
      hooks.onMilestone?.(`part:installed:${partId}:${installedCount}`);
    })
  );

  unsubscribers.push(
    gameEventBus.on('note:collected', ({ noteId }) => {
      gameDiagnostics.recordEventTrace();
      hooks.onMilestone?.(`note:collected:${noteId}`);
    })
  );

  unsubscribers.push(
    gameEventBus.on('tape:collected', ({ tapeId }) => {
      gameDiagnostics.recordEventTrace();
      hooks.onMilestone?.(`tape:collected:${tapeId}`);
    })
  );

  unsubscribers.push(
    gameEventBus.on('secret:discovered', ({ secretId }) => {
      gameDiagnostics.recordEventTrace();
      hooks.onMilestone?.(`secret:discovered:${secretId}`);
    })
  );

  unsubscribers.push(
    gameEventBus.on('puzzle:solved', ({ puzzle }) => {
      gameDiagnostics.recordEventTrace();
      hooks.onMilestone?.(`puzzle:solved:${puzzle}`);
    })
  );

  unsubscribers.push(
    gameEventBus.on('shadow:event', () => {
      gameDiagnostics.recordEventTrace();
    })
  );

  unsubscribers.push(
    gameEventBus.on('save:persisted', () => {
      gameDiagnostics.recordEventTrace();
    })
  );

  unsubscribers.push(
    gameEventBus.on('ending:reached', ({ endingId }) => {
      gameDiagnostics.recordEventTrace();
      hooks.onMilestone?.(`ending:reached:${endingId}`);
    })
  );

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}
