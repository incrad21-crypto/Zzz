import { soundEngine } from '../audio';
import { gameEventBus } from '../eventBus';
import { formatDirectionalSoundCaption, updateHorrorDirector } from '../horrorDirector';
import {
  buildRunSummary,
  detectNearbyRoomRadioSignal,
  updateFinale,
  updatePlayerMovement,
  updatePrologue,
  updateShadowEncounter,
} from '../rules';
import {
  DialogueMessage,
  DifficultyMode,
  GameState,
  KeyBindings,
  RunSummary,
  ToastNotification,
} from '../types';
import { HOUSE_ROOMS } from '../world';
import { isActionHeld } from './inputController';

export interface SimulationStepOptions {
  difficulty?: DifficultyMode;
  soundCaptions?: boolean;
  gamepadHeld?: {
    left: boolean;
    right: boolean;
    run: boolean;
    crouch: boolean;
  };
}

export interface ActiveRadioSignalSnapshot {
  id: string;
  freqLabel: string;
  title: string;
  strength: number; // 0..100 integer
  discovered: boolean;
}

export interface SimulationTimers {
  footstepTimer: number;
  rainPauseTimer: number;
  thunderCycle: number;
  sparkSfxCooldown: number;
  tvStaticCooldown: number;
  heartbeatTimer: number;
  houseCreakTimer: number;
  radioBlipCooldown: number;
  activeRadioSignal: ActiveRadioSignalSnapshot | null;
}

export function createSimulationTimers(): SimulationTimers {
  return {
    footstepTimer: 0,
    rainPauseTimer: 0,
    thunderCycle: -1,
    sparkSfxCooldown: 0,
    tvStaticCooldown: 0,
    heartbeatTimer: 0,
    houseCreakTimer: 9.5,
    radioBlipCooldown: 0,
    activeRadioSignal: null,
  };
}

export interface SimulationCallbacks {
  enqueueDialogues: (msgs: DialogueMessage[], interrupt?: boolean) => void;
  pushToast: (kind: ToastNotification['kind'], title: string, detail?: string) => void;
  persistSave: (st: GameState) => void;
  onFinaleFinished: (summary: RunSummary) => void;
  updateStaminaBar: (stamina: number, exhausted: boolean) => void;
}

export function runSimulationStep(
  st: GameState,
  rawStepDt: number,
  timeSec: number,
  heldKeys: ReadonlySet<string>,
  bindings: KeyBindings,
  timers: SimulationTimers,
  callbacks: SimulationCallbacks,
  options?: SimulationStepOptions
): void {
  const difficulty: DifficultyMode = options?.difficulty ?? 'standard';
  const soundCaptions = options?.soundCaptions ?? true;
  const gp = options?.gamepadHeld;
  const stepDt = Number.isFinite(rawStepDt) && rawStepDt > 0 ? Math.min(0.1, rawStepDt) : 0;
  if (st.activeOverlay === 'none') {
    st.playTimeSeconds += stepDt;
  }

  // Update Finale
  if (st.finale.active) {
    timers.activeRadioSignal = null;
    const finStep = updateFinale(st, stepDt);
    if (finStep.newDialogue) {
      callbacks.enqueueDialogues([finStep.newDialogue], true);
    }
    if (st.finale.phase === 'approach' || st.finale.phase === 'fade') {
      timers.heartbeatTimer -= stepDt;
      if (timers.heartbeatTimer <= 0) {
        timers.heartbeatTimer = st.finale.phase === 'fade' ? 0.62 : 0.8;
        soundEngine.playSfx('heartbeat');
      }
    }
    if (finStep.finished) {
      const summary = buildRunSummary(st);
      callbacks.onFinaleFinished(summary);
    }
    return;
  }

  if (st.activeOverlay !== 'none') return;

  const left = isActionHeld(heldKeys, 'left', bindings) || Boolean(gp?.left);
  const right = isActionHeld(heldKeys, 'right', bindings) || Boolean(gp?.right);
  const run = isActionHeld(heldKeys, 'run', bindings) || Boolean(gp?.run);
  const crouch = isActionHeld(heldKeys, 'down', bindings) || Boolean(gp?.crouch);
  const brake = heldKeys.has('Space');

  // Synchronized thunder SFX with lightning cycle (11.4s period)
  if (st.player.zone !== 'house' && timers.rainPauseTimer <= 0) {
    const lightningIdx = Math.floor(timeSec / 11.4);
    const cyclePos = timeSec % 11.4;
    if (cyclePos > 10.22 && timers.thunderCycle !== lightningIdx) {
      timers.thunderCycle = lightningIdx;
      soundEngine.playSfx('thunder');
      if (soundCaptions && st.player.zone === 'forest') {
        callbacks.pushToast('caption', '[Звук снаружи: раскат грома]');
      }
    }
  }

  if (st.player.zone === 'car_prologue') {
    timers.activeRadioSignal = null;
    const msg = updatePrologue(st, { left, right, brake }, stepDt);
    if (msg) callbacks.enqueueDialogues([msg]);
    return;
  }

  updatePlayerMovement(st, { left, right, run, crouch }, stepDt, difficulty);
  callbacks.updateStaminaBar(st.player.stamina, st.player.exhausted);

  // Footstep cadence synced to movement speed
  if (Math.abs(st.player.vx) > 15) {
    timers.footstepTimer -= stepDt * (st.player.isRunning ? 1.55 : 1);
    if (timers.footstepTimer <= 0) {
      timers.footstepTimer = 0.38;
      if (st.player.zone === 'forest') {
        soundEngine.playFootstep('gravel');
      } else {
        const room = HOUSE_ROOMS.find(
          (r) =>
            r.floor === st.player.floor &&
            st.player.x >= r.x &&
            st.player.x <= r.x + r.width
        );
        soundEngine.playFootstep(room?.floorMaterial ?? 'wood');
      }
    }
  }

  // Atmospheric Forest Events (strictly one-shot)
  if (st.player.zone === 'forest') {
    timers.activeRadioSignal = null;
    if (timers.sparkSfxCooldown > 0) {
      timers.sparkSfxCooldown = Math.max(0, timers.sparkSfxCooldown - stepDt);
    }
    if (
      Math.abs(st.player.x - 1590) < 120 &&
      timers.sparkSfxCooldown <= 0 &&
      Math.sin(timeSec * 15) > 0.72
    ) {
      timers.sparkSfxCooldown = 1.8;
      soundEngine.playSfx('spark');
    }
    if (st.player.x > 1220 && !st.atmospheric.forestSilhouetteSeen) {
      st.atmospheric.forestSilhouetteSeen = true;
      st.player.startledTimer = 0.45;
      soundEngine.playSfx('creak');
      callbacks.enqueueDialogues([
        {
          speaker: 'thought',
          text: 'Между мокрых сосен промелькнул узкий силуэт — или ветка качнулась под дождём.',
          duration: 3.4,
        },
      ]);
    }
    if (st.player.x > 1680 && !st.atmospheric.rainPausedTriggered) {
      st.atmospheric.rainPausedTriggered = true;
      timers.rainPauseTimer = 3.8;
      callbacks.enqueueDialogues([
        {
          speaker: 'thought',
          text: 'Ливень оборвался на полуслове. Осталось только собственное дыхание.',
          duration: 3.2,
        },
      ]);
    }
    if (timers.rainPauseTimer > 0) {
      timers.rainPauseTimer = Math.max(0, timers.rainPauseTimer - stepDt);
    }
    return;
  }

  // House Zone Simulation
  if (timers.rainPauseTimer > 0) {
    timers.rainPauseTimer = 0;
  }
  timers.houseCreakTimer -= stepDt;
  if (timers.houseCreakTimer <= 0) {
    timers.houseCreakTimer = 11 + Math.random() * 7;
    soundEngine.playSfx('creak');
  }

  // TV white noise static whisper when passing f1_tv at stage >= 3
  if (timers.tvStaticCooldown > 0) {
    timers.tvStaticCooldown = Math.max(0, timers.tvStaticCooldown - stepDt);
  }
  if (
    st.atmospheric.tvStaticTriggered &&
    st.player.floor === 1 &&
    Math.abs(st.player.x - 392) < 62 &&
    timers.tvStaticCooldown <= 0
  ) {
    timers.tvStaticCooldown = 4.2;
    soundEngine.playSfx('static');
  }

  // Attic moved mannequin startled discovery when ascending to floor 4 at stage >= 5
  if (
    st.atmospheric.mannequinMoved &&
    st.player.floor === 4 &&
    Math.abs(st.player.x - 438) < 165 &&
    !st.journalObservations.some((o) => o.includes('Манекен на мансарде'))
  ) {
    st.player.startledTimer = 0.45;
    st.journalObservations.push('Манекен на мансарде сдвинулся ближе к центру чердака.');
    soundEngine.playSfx('creak');
    callbacks.enqueueDialogues([
      {
        speaker: 'thought',
        text: 'Манекен точно стоял в стороне. Кто подвинул его ближе к люку?',
        duration: 3.2,
      },
    ]);
  }

  // 2F hallway eerie silhouette startled reaction when approached at high assembly stage
  if (
    st.installedParts.length >= 5 &&
    !st.atmospheric.hallwaySilhouetteSeen &&
    st.player.floor === 2 &&
    Math.abs(st.player.x - 600) < 145
  ) {
    st.atmospheric.hallwaySilhouetteSeen = true;
    st.player.startledTimer = 0.5;
    soundEngine.playSfx('creak');
    callbacks.enqueueDialogues([
      {
        speaker: 'thought',
        text: 'В дальнем конце коридора кто-то стоял... Пока я не повернул голову.',
        duration: 3.2,
      },
    ]);
  }

  // Room-based Radio Signal Investigation (§13)
  if (timers.radioBlipCooldown > 0) {
    timers.radioBlipCooldown = Math.max(0, timers.radioBlipCooldown - stepDt);
  }
  const radioRes = detectNearbyRoomRadioSignal(st);
  if (radioRes.active && radioRes.strength > 0.16) {
    const pct = Math.round(radioRes.strength * 100);
    timers.activeRadioSignal = {
      id: radioRes.active.id,
      freqLabel: radioRes.active.freqLabel,
      title: radioRes.active.title,
      strength: pct,
      discovered: st.discoveredRadioSignals.includes(radioRes.active.id),
    };
    if (timers.radioBlipCooldown <= 0) {
      // Closer to the source = faster subtle pulse
      timers.radioBlipCooldown = Math.max(0.42, 1.55 - radioRes.strength * 1.05);
      soundEngine.playRadioProximityBlip(radioRes.strength);
    }
    if (radioRes.newlyDiscovered) {
      soundEngine.playSfx('tape');
      callbacks.pushToast(
        'radio',
        `Перехвачен сигнал ${radioRes.newlyDiscovered.freqLabel}`,
        radioRes.newlyDiscovered.title
      );
      callbacks.enqueueDialogues([
        {
          speaker: 'radio',
          text: radioRes.newlyDiscovered.transcript,
          duration: 4.5,
        },
      ]);
      callbacks.persistSave(st);
    }
  } else {
    timers.activeRadioSignal = null;
  }

  // Horror Director: room visit tracking + spatial anomalies + tension pacing
  const anom = updateHorrorDirector(st, stepDt, difficulty);
  if (anom) {
    soundEngine.playSfx(anom.sound, anom.pan);
    if (soundCaptions) {
      callbacks.pushToast('caption', formatDirectionalSoundCaption(anom.sound, anom.pan));
    }
    if (anom.dialogue) {
      callbacks.enqueueDialogues([anom.dialogue], false);
    }
    if (anom.observation) {
      callbacks.pushToast('observation', 'Новая заметка в дневнике', 'Откройте журнал [J]');
    }
  }

  // Multi-behavior Stealth Shadow Anomaly
  const shRes = updateShadowEncounter(st, stepDt, difficulty);
  if (shRes.guided) {
    soundEngine.playSfx('whisper');
    gameEventBus.emit('shadow:event', { kind: 'guide', floor: st.player.floor });
    callbacks.enqueueDialogues([
      {
        speaker: 'thought',
        text: 'Странный силуэт впереди будто указывает рукой в глубь комнаты...',
        duration: 3.4,
      },
    ]);
  } else if (shRes.spawned) {
    soundEngine.playSfx('creak');
    gameEventBus.emit('shadow:event', { kind: 'spawned', floor: st.player.floor });
  } else if (shRes.startled) {
    soundEngine.playSfx('spark');
    gameEventBus.emit('shadow:event', { kind: 'startled', floor: st.player.floor });
    callbacks.enqueueDialogues([
      {
        speaker: 'thought',
        text: 'Тень бросилась прямо на луч! Пригнись [S], погаси фонарь [F] или уйди в укрытие [E].',
        duration: 3.8,
      },
    ]);
  } else if (shRes.evaded) {
    gameEventBus.emit('shadow:event', { kind: 'evaded', floor: st.player.floor });
    callbacks.enqueueDialogues([
      {
        speaker: 'thought',
        text: 'Тень прошла мимо и растаяла в углу.',
        duration: 2.6,
      },
    ]);
  }
}
