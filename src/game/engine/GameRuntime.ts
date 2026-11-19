import { soundEngine } from '../audio';
import {
  advanceDialogue,
  clearDialogueRuntime,
  createDialogueRuntime,
  DialogueRuntime,
  enqueueDialogue,
  tickDialogue,
} from '../controllers/dialogueController';
import {
  createGamepadPrevButtons,
  GamepadPrevButtons,
  GamepadSnapshot,
  pollBrowserGamepad,
} from '../controllers/gamepadController';
import { createSimulationTimers, SimulationTimers } from '../controllers/simulationStep';
import { PixelWorldRenderer } from '../renderer';
import { createInitialGameState } from '../rules';
import { DialogueMessage, GameState, TextSpeed } from '../types';

export class GameRuntime {
  public state: GameState;
  private _renderer: PixelWorldRenderer | null = null;
  public readonly dialogue: DialogueRuntime;
  public timers: SimulationTimers;
  public readonly gamepadPrev: GamepadPrevButtons;
  public readonly keysHeld: Set<string>;
  public readonly keysJustPressed: Set<string>;
  public lastDucking = false;

  constructor(skipPrologue = false) {
    this.state = createInitialGameState(skipPrologue);
    this.dialogue = createDialogueRuntime();
    this.timers = createSimulationTimers();
    this.gamepadPrev = createGamepadPrevButtons();
    this.keysHeld = new Set<string>();
    this.keysJustPressed = new Set<string>();
  }

  public get renderer(): PixelWorldRenderer {
    if (!this._renderer) {
      this._renderer = new PixelWorldRenderer();
    }
    return this._renderer;
  }

  public resetSession(nextState: GameState): void {
    this.state = nextState;
    this._renderer?.resetCamera();
    this.keysHeld.clear();
    this.keysJustPressed.clear();
    clearDialogueRuntime(this.dialogue);
    this.timers = createSimulationTimers();
  }

  public clearInput(): void {
    this.keysHeld.clear();
    this.keysJustPressed.clear();
  }

  public enqueueDialogues(msgs: DialogueMessage[], interrupt = false): void {
    if (msgs.length === 0) return;
    if (interrupt) {
      clearDialogueRuntime(this.dialogue);
    }
    enqueueDialogue(this.dialogue, msgs);
    if (this.dialogue.active && this.dialogue.visibleChars === 0) {
      this.dialogue.visibleChars = 1;
    }
    this.state.activeDialogue = this.dialogue.active;
    this.state.dialogueQueue = this.dialogue.queue;
  }

  public advanceActiveDialogue(): boolean {
    if (!advanceDialogue(this.dialogue)) return false;
    if (this.dialogue.active && this.dialogue.visibleChars === 0) {
      this.dialogue.visibleChars = 1;
    }
    this.state.activeDialogue = this.dialogue.active;
    this.state.dialogueQueue = this.dialogue.queue;
    return true;
  }

  public clearDialogues(): void {
    clearDialogueRuntime(this.dialogue);
    this.state.activeDialogue = null;
    this.state.dialogueQueue = [];
  }

  public tickDialogueAndAudio(dt: number, textSpeed: TextSpeed): boolean {
    const st = this.state;
    const shouldDuck = Boolean(this.dialogue.active);
    if (shouldDuck !== this.lastDucking) {
      this.lastDucking = shouldDuck;
      soundEngine.setDialogueDucking(shouldDuck);
    }

    const dlgTick = tickDialogue(this.dialogue, dt, textSpeed);
    if (dlgTick.voiceBlipSpeaker) {
      soundEngine.playVoiceBlip(
        dlgTick.voiceBlipSpeaker,
        st.finale.active && st.finale.phase !== 'rising',
        st.installedParts.length
      );
    }
    if (dlgTick.changed) {
      st.activeDialogue = this.dialogue.active;
      st.dialogueQueue = this.dialogue.queue;
    }
    return dlgTick.changed;
  }

  public syncAmbience(): void {
    const st = this.state;
    if (st.screen === 'playing') {
      soundEngine.updateAmbience({
        playing: true,
        titleScreen: false,
        zone: st.player.zone,
        floor: st.player.floor,
        carSpeed: st.prologue.speed,
        installedParts: st.installedParts.length,
        rainPaused: this.timers.rainPauseTimer > 0,
        finaleActive: st.finale.active,
      });
    } else {
      if (this.lastDucking) {
        this.lastDucking = false;
        soundEngine.setDialogueDucking(false);
      }
      soundEngine.updateAmbience({
        playing: false,
        titleScreen: st.screen === 'title',
        zone: st.player.zone,
        floor: st.player.floor,
        carSpeed: 0,
        installedParts: 0,
        rainPaused: false,
        finaleActive: false,
      });
    }
  }

  public pollGamepad(): GamepadSnapshot {
    return pollBrowserGamepad(this.gamepadPrev);
  }
}
