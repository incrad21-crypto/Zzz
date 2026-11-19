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
}

export function createGamepadPrevButtons(): GamepadPrevButtons {
  return {
    interact: false,
    flashlight: false,
    reload: false,
    pause: false,
    map: false,
    cancel: false,
  };
}

const STICK_DEADZONE = 0.28;

export function readGamepadSnapshot(
  pad: GamepadLike | null | undefined,
  prev: GamepadPrevButtons
): GamepadSnapshot {
  if (!pad || !pad.connected) {
    prev.interact = false;
    prev.flashlight = false;
    prev.reload = false;
    prev.pause = false;
    prev.map = false;
    prev.cancel = false;
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
    };
  }

  const axisX = pad.axes[0] ?? 0;
  const axisY = pad.axes[1] ?? 0;
  const btn = (i: number) => Boolean(pad.buttons[i]?.pressed);

  const left = axisX < -STICK_DEADZONE || btn(14);
  const right = axisX > STICK_DEADZONE || btn(15);
  const up = axisY < -0.55 || btn(12);
  const down = axisY > 0.55 || btn(13);
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
  };

  prev.interact = curInteract;
  prev.flashlight = curFlashlight;
  prev.reload = curReload;
  prev.pause = curPause;
  prev.map = curMap;
  prev.cancel = curCancel;

  return snapshot;
}

export function pollBrowserGamepad(prev: GamepadPrevButtons): GamepadSnapshot {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return readGamepadSnapshot(null, prev);
    }
    const pads = navigator.getGamepads();
    const active = pads ? Array.from(pads).find((p) => p && p.connected) ?? null : null;
    return readGamepadSnapshot(active, prev);
  } catch {
    return readGamepadSnapshot(null, prev);
  }
}
