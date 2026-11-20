export interface GamepadSnapshot {
  connected: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  run: boolean;
  justInteract: boolean;
  justFlashlight: boolean;
  justReload: boolean;
  justPause: boolean;
  justMap: boolean;
  justCancel: boolean;
  justUp: boolean;
  justDown: boolean;
  justLeft: boolean;
  justRight: boolean;
}

export interface GamepadButtonState {
  pressed: boolean;
}

export interface GamepadLike {
  connected: boolean;
  axes: readonly number[];
  buttons: readonly GamepadButtonState[];
}

export interface GamepadPrevButtons {
  interact: boolean;
  flashlight: boolean;
  reload: boolean;
  pause: boolean;
  map: boolean;
  cancel: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export function createGamepadPrevButtons(): GamepadPrevButtons {
  return {
    interact: false,
    flashlight: false,
    reload: false,
    pause: false,
    map: false,
    cancel: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };
}

const DEFAULT_STICK_DEADZONE = 0.28;

export function readGamepadSnapshot(
  pad: GamepadLike | null | undefined,
  prev: GamepadPrevButtons,
  deadzone = DEFAULT_STICK_DEADZONE
): GamepadSnapshot {
  if (!pad || !pad.connected) {
    prev.interact = false;
    prev.flashlight = false;
    prev.reload = false;
    prev.pause = false;
    prev.map = false;
    prev.cancel = false;
    prev.up = false;
    prev.down = false;
    prev.left = false;
    prev.right = false;
    return {
      connected: false,
      left: false,
      right: false,
      up: false,
      down: false,
      run: false,
      justInteract: false,
      justFlashlight: false,
      justReload: false,
      justPause: false,
      justMap: false,
      justCancel: false,
      justUp: false,
      justDown: false,
      justLeft: false,
      justRight: false,
    };
  }

  const dz = Number.isFinite(deadzone) ? Math.max(0.05, Math.min(0.85, deadzone)) : DEFAULT_STICK_DEADZONE;
  const verticalDz = Math.max(0.45, Math.min(0.85, dz + 0.22));
  const axisX = pad.axes[0] ?? 0;
  const axisY = pad.axes[1] ?? 0;
  const btn = (i: number) => Boolean(pad.buttons[i]?.pressed);

  const left = axisX < -dz || btn(14);
  const right = axisX > dz || btn(15);
  const up = axisY < -verticalDz || btn(12);
  const down = axisY > verticalDz || btn(13);
  const run = btn(1) || btn(4) || btn(5) || btn(6) || btn(7);

  const curInteract = btn(0);
  const curFlashlight = btn(2);
  const curReload = btn(3);
  const curPause = btn(9);
  const curMap = btn(8);
  const curCancel = btn(1);

  const snapshot: GamepadSnapshot = {
    connected: true,
    left,
    right,
    up,
    down,
    run,
    justInteract: curInteract && !prev.interact,
    justFlashlight: curFlashlight && !prev.flashlight,
    justReload: curReload && !prev.reload,
    justPause: curPause && !prev.pause,
    justMap: curMap && !prev.map,
    justCancel: curCancel && !prev.cancel,
    justUp: up && !prev.up,
    justDown: down && !prev.down,
    justLeft: left && !prev.left,
    justRight: right && !prev.right,
  };

  prev.interact = curInteract;
  prev.flashlight = curFlashlight;
  prev.reload = curReload;
  prev.pause = curPause;
  prev.map = curMap;
  prev.cancel = curCancel;
  prev.up = up;
  prev.down = down;
  prev.left = left;
  prev.right = right;

  return snapshot;
}

export function pollBrowserGamepad(
  prev: GamepadPrevButtons,
  deadzone = DEFAULT_STICK_DEADZONE
): GamepadSnapshot {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return readGamepadSnapshot(null, prev, deadzone);
    }
    const pads = navigator.getGamepads();
    const active = pads ? Array.from(pads).find((p) => p && p.connected) ?? null : null;
    return readGamepadSnapshot(active, prev, deadzone);
  } catch {
    return readGamepadSnapshot(null, prev, deadzone);
  }
}

export function vibrateGamepad(
  durationMs: number,
  weakMagnitude = 0.35,
  strongMagnitude = 0.55,
  enabled = true
): void {
  if (!enabled) return;
  try {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }
    const pads = navigator.getGamepads();
    const active = pads ? Array.from(pads).find((p) => p && p.connected) : undefined;
    const actuator = (active as unknown as {
      vibrationActuator?: {
        playEffect?: (
          type: string,
          params: { duration: number; weakMagnitude: number; strongMagnitude: number }
        ) => Promise<string>;
      };
    } | undefined)?.vibrationActuator;
    if (actuator && typeof actuator.playEffect === 'function') {
      void actuator
        .playEffect('dual-rumble', {
          duration: Math.max(40, Math.min(800, Math.round(durationMs))),
          weakMagnitude: Math.max(0, Math.min(1, weakMagnitude)),
          strongMagnitude: Math.max(0, Math.min(1, strongMagnitude)),
        })
        .catch(() => undefined);
    }
  } catch {
    // Ignore unsupported vibration APIs
  }
}
