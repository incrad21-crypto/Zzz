import { KeyAction, KeyBindings } from '../types';

const SECONDARY_CODES: Partial<Record<KeyAction, string[]>> = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  run: ['ShiftRight'],
  interact: ['Enter'],
};

/**
 * Checks whether a KeyboardEvent.code triggers a logical action under custom keyBindings.
 * Secondary aliases (arrows / ShiftRight / Enter) remain active unless explicitly bound to another action.
 */
export function matchesKeyAction(code: string, action: KeyAction, bindings: KeyBindings): boolean {
  if (bindings[action] === code) return true;
  const secondaries = SECONDARY_CODES[action];
  if (!secondaries || !secondaries.includes(code)) return false;

  // Do not fire secondary alias if the user explicitly bound that physical key to a different action.
  const boundElsewhere = (Object.keys(bindings) as KeyAction[]).some(
    (otherAction) => otherAction !== action && bindings[otherAction] === code
  );
  return !boundElsewhere;
}

/**
 * Checks whether any key matching the logical action is currently held.
 */
export function isActionHeld(
  heldKeys: ReadonlySet<string>,
  action: KeyAction,
  bindings: KeyBindings
): boolean {
  for (const code of heldKeys) {
    if (matchesKeyAction(code, action, bindings)) {
      return true;
    }
  }
  return false;
}

/**
 * Updates a single action binding cleanly, swapping with any colliding action so no key is duplicated.
 */
export function rebindKeyAction(
  bindings: KeyBindings,
  action: KeyAction,
  newCode: string
): KeyBindings {
  const next: KeyBindings = { ...bindings };
  const prevCode = bindings[action];
  for (const other of Object.keys(next) as KeyAction[]) {
    if (other !== action && next[other] === newCode) {
      next[other] = prevCode;
    }
  }
  next[action] = newCode;
  return next;
}

export function isKeyBoundToAction(code: string, bindings: KeyBindings): boolean {
  return (Object.values(bindings) as string[]).includes(code);
}
