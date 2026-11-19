import { DialogueMessage, TextSpeed } from '../types';

export interface DialogueRuntime {
  active: DialogueMessage | null;
  queue: DialogueMessage[];
  visibleChars: number;
  holdTimer: number;
  blipCooldown: number;
}

export function createDialogueRuntime(): DialogueRuntime {
  return {
    active: null,
    queue: [],
    visibleChars: 0,
    holdTimer: 0,
    blipCooldown: 0,
  };
}

export function clearDialogueRuntime(rt: DialogueRuntime): void {
  rt.active = null;
  rt.queue = [];
  rt.visibleChars = 0;
  rt.holdTimer = 0;
  rt.blipCooldown = 0;
}

export function getTextSpeedCharsPerSec(speed: TextSpeed): number {
  if (speed === 'slow') return 28;
  if (speed === 'fast') return 72;
  return 44;
}

export function enqueueDialogue(rt: DialogueRuntime, messages: DialogueMessage[]): boolean {
  if (messages.length === 0) return false;
  rt.queue.push(...messages);
  if (!rt.active) {
    rt.active = rt.queue.shift() ?? null;
    rt.visibleChars = 0;
    rt.holdTimer = rt.active?.duration ?? 3.4;
    rt.blipCooldown = 0;
    return true;
  }
  return false;
}

/**
 * Advances active dialogue: finishes typewriter first, or moves to next queued message.
 * Returns true if there was an active dialogue to advance.
 */
export function advanceDialogue(rt: DialogueRuntime): boolean {
  if (!rt.active) return false;
  if (rt.visibleChars < rt.active.text.length) {
    rt.visibleChars = rt.active.text.length;
    return true;
  }
  rt.active = rt.queue.shift() ?? null;
  rt.visibleChars = 0;
  rt.holdTimer = rt.active?.duration ?? 3.4;
  rt.blipCooldown = 0;
  return true;
}

export interface DialogueTickResult {
  changed: boolean;
  voiceBlipSpeaker: 'robot' | 'thought' | 'radio' | 'tape' | null;
}

export function tickDialogue(
  rt: DialogueRuntime,
  dt: number,
  textSpeed: TextSpeed
): DialogueTickResult {
  if (!rt.active) {
    return { changed: false, voiceBlipSpeaker: null };
  }

  let voiceBlipSpeaker: 'robot' | 'thought' | 'radio' | 'tape' | null = null;
  const fullLen = rt.active.text.length;

  if (rt.visibleChars < fullLen) {
    const prevInt = Math.floor(rt.visibleChars);
    rt.visibleChars = Math.min(fullLen, rt.visibleChars + getTextSpeedCharsPerSec(textSpeed) * dt);
    const nextInt = Math.floor(rt.visibleChars);
    rt.blipCooldown = Math.max(0, rt.blipCooldown - dt);
    if (nextInt > prevInt && rt.blipCooldown <= 0) {
      rt.blipCooldown = 0.065;
      if (rt.active.speaker !== 'system') {
        voiceBlipSpeaker = rt.active.speaker;
      }
    }
    return { changed: nextInt !== prevInt || rt.visibleChars >= fullLen, voiceBlipSpeaker };
  }

  rt.holdTimer -= dt;
  if (rt.holdTimer <= 0) {
    rt.active = rt.queue.shift() ?? null;
    rt.visibleChars = 0;
    rt.holdTimer = rt.active?.duration ?? 3.4;
    return { changed: true, voiceBlipSpeaker: null };
  }

  return { changed: false, voiceBlipSpeaker: null };
}
