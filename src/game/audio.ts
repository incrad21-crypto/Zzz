import { WorldZone } from './types';

const MAX_ACTIVE_SFX = 18;

function finiteOr(val: number, fallback: number): number {
  return Number.isFinite(val) ? val : fallback;
}

function safeFreq(val: number, fallback = 220): number {
  const n = finiteOr(val, fallback);
  return Math.max(20, Math.min(20000, n));
}

function safeExpGain(val: number, fallback = 0.0008): number {
  const n = finiteOr(val, fallback);
  return Math.max(0.0001, Math.min(1, n));
}

function safeTime(val: number, floor: number): number {
  const n = finiteOr(val, floor);
  return Math.max(floor, n);
}

class HorrorAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private hearthGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private sharedWhiteNoise: AudioBuffer | null = null;
  private activeVoiceExpiries: number[] = [];

  private muted = false;
  private masterVol = 0.78;
  private ambienceVol = 0.82;
  private sfxVol = 0.9;
  private voiceVol = 0.92;
  private dialogueDucking = false;
  private initialized = false;
  private hasUserGesture = false;
  private lastRainTarget = -1;
  private lastRainCutoff = -1;
  private lastWindTarget = -1;
  private lastWindFreq = -1;
  private lastEngineTarget = -1;
  private lastEngineFreq = -1;
  private lastDroneTarget = -1;
  private lastDroneFreq = -1;
  private lastHearthTarget = -1;
  private lastAmbienceTime = -1;

  private applyGainTargets(): void {
    if (!this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.55 * this.masterVol, now, 0.06);
      if (this.ambienceBus) {
        const duck = this.dialogueDucking ? 0.58 : 1;
        this.ambienceBus.gain.setTargetAtTime(this.ambienceVol * duck, now, 0.08);
      }
      if (this.sfxBus) {
        this.sfxBus.gain.setTargetAtTime(this.sfxVol, now, 0.06);
      }
      if (this.voiceBus) {
        this.voiceBus.gain.setTargetAtTime(this.voiceVol, now, 0.06);
      }
    } catch {
      // Ignore audio param errors
    }
  }

  public markUserGesture(): void {
    if (
      typeof navigator !== 'undefined' &&
      'userActivation' in navigator &&
      !navigator.userActivation.hasBeenActive
    ) {
      return;
    }
    this.hasUserGesture = true;
    this.unlock();
  }

  public unlock(): void {
    if (!this.hasUserGesture) return;
    if (
      typeof navigator !== 'undefined' &&
      'userActivation' in navigator &&
      !navigator.userActivation.hasBeenActive
    ) {
      return;
    }
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx
          .resume()
          .then(() => this.applyGainTargets())
          .catch(() => undefined);
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.55 * this.masterVol;
      this.masterGain.connect(this.ctx.destination);

      this.ambienceBus = this.ctx.createGain();
      this.ambienceBus.gain.value = this.ambienceVol;
      this.ambienceBus.connect(this.masterGain);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.masterGain);

      this.voiceBus = this.ctx.createGain();
      this.voiceBus.gain.value = this.voiceVol;
      this.voiceBus.connect(this.masterGain);

      // Pre-allocate shared white noise buffer to avoid per-SFX GC churn
      const noiseLen = Math.floor(this.ctx.sampleRate * 2.5);
      this.sharedWhiteNoise = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
      const ch = this.sharedWhiteNoise.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        ch[i] = Math.random() * 2 - 1;
      }

      this.setupRainLoop();
      this.setupWindLoop();
      this.setupDroneLoop();
      this.setupHearthLoop();
      this.setupCarEngineLoop();
      this.initialized = true;
      this.applyGainTargets();
    } catch {
      // Ignore audio initialization failures in headless environments
    }
  }

  public handleVisibilityChange(hidden: boolean): void {
    if (!this.ctx) return;
    try {
      if (hidden && this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => undefined);
      } else if (!hidden && this.hasUserGesture && this.ctx.state === 'suspended') {
        void this.ctx
          .resume()
          .then(() => this.applyGainTargets())
          .catch(() => undefined);
      }
    } catch {
      // Ignore audio state errors
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGainTargets();
  }

  public setMixerVolumes(vols: {
    master: number;
    ambience: number;
    sfx: number;
    voice: number;
  }): void {
    this.masterVol = Math.max(0, Math.min(1, finiteOr(vols.master, 0.78)));
    this.ambienceVol = Math.max(0, Math.min(1, finiteOr(vols.ambience, 0.82)));
    this.sfxVol = Math.max(0, Math.min(1, finiteOr(vols.sfx, 0.9)));
    this.voiceVol = Math.max(0, Math.min(1, finiteOr(vols.voice, 0.92)));
    this.applyGainTargets();
  }

  public setDialogueDucking(active: boolean): void {
    if (this.dialogueDucking === active) return;
    this.dialogueDucking = active;
    try {
      if (this.ambienceBus && this.ctx) {
        this.ambienceBus.gain.setTargetAtTime(
          this.ambienceVol * (active ? 0.58 : 1.0),
          this.ctx.currentTime,
          0.18
        );
      }
    } catch {
      // Ignore audio param errors
    }
  }

  private pruneExpiredVoices(now: number): void {
    if (this.activeVoiceExpiries.length === 0) return;
    this.activeVoiceExpiries = this.activeVoiceExpiries.filter((exp) => exp > now);
  }

  private hasVoiceCapacity(): boolean {
    if (!this.ctx) return false;
    this.pruneExpiredVoices(this.ctx.currentTime);
    return this.activeVoiceExpiries.length < MAX_ACTIVE_SFX;
  }

  private connectVoiceChain(
    source: AudioScheduledSourceNode,
    tail: AudioNode,
    durationSec: number,
    pan = 0,
    bus: 'sfx' | 'voice' = 'sfx',
    startAt?: number
  ): { release: () => void } | null {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return null;
    const now = this.ctx.currentTime;
    this.pruneExpiredVoices(now);
    if (this.activeVoiceExpiries.length >= MAX_ACTIVE_SFX) return null;

    const targetBus =
      bus === 'voice'
        ? this.voiceBus ?? this.masterGain
        : this.sfxBus ?? this.masterGain;

    let panner: StereoPannerNode | null = null;
    const clampedPan = Math.max(-1, Math.min(1, finiteOr(pan, 0)));
    if (Math.abs(clampedPan) >= 0.02 && typeof this.ctx.createStereoPanner === 'function') {
      panner = this.ctx.createStereoPanner();
      panner.pan.value = clampedPan;
      tail.connect(panner);
      panner.connect(targetBus);
    } else {
      tail.connect(targetBus);
    }

    const expiry = safeTime(startAt ?? now, now) + Math.max(0.05, finiteOr(durationSec, 0.25)) + 0.08;
    this.activeVoiceExpiries.push(expiry);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      const idx = this.activeVoiceExpiries.indexOf(expiry);
      if (idx >= 0) {
        this.activeVoiceExpiries.splice(idx, 1);
      }
      try {
        source.disconnect();
        tail.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Already disconnected
      }
    };

    source.onended = cleanup;
    return { release: cleanup };
  }

  private setupRainLoop(): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      const sample = (lastOut + 0.045 * white) / 1.045;
      data[i] = sample;
      lastOut = sample;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.value = 1800;
    this.rainFilter.Q.value = 0.55;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;

    noise.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.ambienceBus ?? this.masterGain);
    noise.start();
  }

  private setupWindLoop(): void {
    if (!this.ctx || !this.masterGain || !this.sharedWhiteNoise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.sharedWhiteNoise;
    src.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 260;
    this.windFilter.Q.value = 2.4;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;

    src.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ambienceBus ?? this.masterGain);
    src.start();
  }

  private setupDroneLoop(): void {
    if (!this.ctx || !this.masterGain) return;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 180;

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'triangle';
    this.droneOsc1.frequency.value = 48;

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.value = 72.5;

    this.droneOsc1.connect(lowpass);
    this.droneOsc2.connect(lowpass);
    lowpass.connect(this.droneGain);
    this.droneGain.connect(this.ambienceBus ?? this.masterGain);

    this.droneOsc1.start();
    this.droneOsc2.start();
  }

  private setupHearthLoop(): void {
    if (!this.ctx || !this.masterGain || !this.sharedWhiteNoise) return;
    this.hearthGain = this.ctx.createGain();
    this.hearthGain.gain.value = 0;

    const src = this.ctx.createBufferSource();
    src.buffer = this.sharedWhiteNoise;
    src.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 310;
    bandpass.Q.value = 1.0;

    src.connect(bandpass);
    bandpass.connect(this.hearthGain);
    this.hearthGain.connect(this.ambienceBus ?? this.masterGain);
    src.start();
  }

  private setupCarEngineLoop(): void {
    if (!this.ctx || !this.masterGain) return;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 115;

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'triangle';
    this.engineOsc.frequency.value = 42;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ambienceBus ?? this.masterGain);
    this.engineOsc.start();
  }

  private scheduleParam(
    param: AudioParam,
    value: number,
    prev: number,
    now: number,
    tc: number,
    epsilon = 0.002
  ): number {
    if (!Number.isFinite(value)) return prev;
    if (Math.abs(value - prev) <= epsilon) return prev;
    if (typeof param.cancelScheduledValues === 'function') {
      param.cancelScheduledValues(now);
    }
    param.setTargetAtTime(value, now, Math.max(0.01, tc));
    return value;
  }

  public updateAmbience(opts: {
    playing: boolean;
    titleScreen?: boolean;
    zone: WorldZone;
    floor?: number;
    carSpeed: number;
    installedParts: number;
    rainPaused: boolean;
    finaleActive: boolean;
  }): void {
    if (
      !this.ctx ||
      this.ctx.state !== 'running' ||
      !this.rainGain ||
      !this.rainFilter ||
      !this.droneGain ||
      !this.engineGain ||
      !this.engineOsc ||
      !this.droneOsc2
    ) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      if (now - this.lastAmbienceTime < 0.08 && this.lastAmbienceTime >= 0) {
        return;
      }
      this.lastAmbienceTime = now;

      if (opts.titleScreen) {
        this.lastRainCutoff = this.scheduleParam(this.rainFilter.frequency, 1500, this.lastRainCutoff, now, 0.3, 1);
        this.lastRainTarget = this.scheduleParam(this.rainGain.gain, 0.14, this.lastRainTarget, now, 0.4);
        this.lastDroneTarget = this.scheduleParam(this.droneGain.gain, 0.025, this.lastDroneTarget, now, 0.5);
        this.lastEngineTarget = this.scheduleParam(this.engineGain.gain, 0, this.lastEngineTarget, now, 0.15);
        if (this.hearthGain) {
          this.lastHearthTarget = this.scheduleParam(this.hearthGain.gain, 0, this.lastHearthTarget, now, 0.25);
        }
        if (this.windGain && this.windFilter) {
          this.lastWindTarget = this.scheduleParam(this.windGain.gain, 0.018, this.lastWindTarget, now, 0.5);
          this.lastWindFreq = this.scheduleParam(this.windFilter.frequency, 240 + Math.sin(now * 0.45) * 45, this.lastWindFreq, now, 0.4, 2);
        }
        return;
      }
      if (!opts.playing) {
        this.lastRainTarget = this.scheduleParam(this.rainGain.gain, 0, this.lastRainTarget, now, 0.2);
        this.lastDroneTarget = this.scheduleParam(this.droneGain.gain, 0, this.lastDroneTarget, now, 0.2);
        this.lastEngineTarget = this.scheduleParam(this.engineGain.gain, 0, this.lastEngineTarget, now, 0.15);
        if (this.hearthGain) {
          this.lastHearthTarget = this.scheduleParam(this.hearthGain.gain, 0, this.lastHearthTarget, now, 0.2);
        }
        if (this.windGain) {
          this.lastWindTarget = this.scheduleParam(this.windGain.gain, 0, this.lastWindTarget, now, 0.2);
        }
        return;
      }

      const isBasement = opts.zone === 'house' && (opts.floor ?? 1) === 0;
      const isFirstFloor = opts.zone === 'house' && (opts.floor ?? 1) === 1;
      const isAttic = opts.zone === 'house' && (opts.floor ?? 1) === 4;

      const rainTarget = opts.rainPaused
        ? 0.045
        : opts.zone === 'car_prologue'
        ? 0.15
        : opts.zone === 'forest'
        ? 0.22
        : isBasement
        ? 0.018
        : isAttic
        ? 0.085
        : 0.048;
      const rainCutoff =
        opts.zone === 'forest'
          ? 2050
          : opts.zone === 'car_prologue'
          ? 900
          : isAttic
          ? 620
          : 340;
      this.lastRainCutoff = this.scheduleParam(this.rainFilter.frequency, rainCutoff, this.lastRainCutoff, now, 0.35, 1);
      this.lastRainTarget = this.scheduleParam(this.rainGain.gain, rainTarget, this.lastRainTarget, now, 0.35);

      if (this.windGain && this.windFilter) {
        const gust = Math.sin(now * 0.38) * 0.5 + 0.5;
        const windTarget =
          opts.zone === 'forest'
            ? 0.022 + gust * 0.026
            : isAttic
            ? 0.018 + gust * 0.022
            : isBasement
            ? 0.014
            : 0.005;
        const windFreq =
          opts.zone === 'forest'
            ? 240 + gust * 150
            : isAttic
            ? 310 + gust * 120
            : isBasement
            ? 115
            : 185;
        this.lastWindTarget = this.scheduleParam(this.windGain.gain, windTarget, this.lastWindTarget, now, 0.45);
        this.lastWindFreq = this.scheduleParam(this.windFilter.frequency, windFreq, this.lastWindFreq, now, 0.4, 2);
      }

      if (this.hearthGain) {
        const hearthTarget = isFirstFloor && !opts.finaleActive ? 0.02 : isBasement ? 0.014 : 0;
        this.lastHearthTarget = this.scheduleParam(this.hearthGain.gain, hearthTarget, this.lastHearthTarget, now, 0.45);
      }

      const speed = Math.max(0, finiteOr(opts.carSpeed, 0));
      const engineTarget = opts.zone === 'car_prologue' && speed > 0.02 ? 0.095 : 0;
      const engineFreq = safeFreq(34 + speed * 20, 42);
      this.lastEngineTarget = this.scheduleParam(this.engineGain.gain, engineTarget, this.lastEngineTarget, now, 0.12);
      this.lastEngineFreq = this.scheduleParam(this.engineOsc.frequency, engineFreq, this.lastEngineFreq, now, 0.1, 0.2);

      const stageFactor = Math.max(0, Math.min(1, finiteOr(opts.installedParts, 0) / 8));
      const droneTarget = opts.finaleActive
        ? 0.22
        : opts.zone === 'house'
        ? 0.048 + stageFactor * 0.12
        : 0.016;
      const flutter = opts.installedParts >= 5 ? Math.sin(now * 2.1) * 1.2 : 0;
      const droneFreq = safeFreq((opts.finaleActive ? 53.5 : 72.5 - stageFactor * 6) + flutter, 72.5);
      this.lastDroneTarget = this.scheduleParam(this.droneGain.gain, droneTarget, this.lastDroneTarget, now, 0.4);
      this.lastDroneFreq = this.scheduleParam(this.droneOsc2.frequency, droneFreq, this.lastDroneFreq, now, 0.3, 0.15);
    } catch {
      // Prevent ambience math/API edge cases from interrupting the render loop
    }
  }

  private playNoiseBurst(
    duration: number,
    filterType: BiquadFilterType,
    freq: number,
    q: number,
    peakGain: number,
    pan = 0,
    delay = 0,
    bus: 'sfx' | 'voice' = 'sfx'
  ): void {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || !this.sharedWhiteNoise) return;
    if (!this.hasVoiceCapacity()) return;

    try {
      const dur = Math.max(0.018, Math.min(2.2, finiteOr(duration, 0.08)));
      const now = this.ctx.currentTime;
      const startAt = safeTime(now + Math.max(0, finiteOr(delay, 0)), now);
      const src = this.ctx.createBufferSource();
      src.buffer = this.sharedWhiteNoise;
      const maxOffset = Math.max(0.02, this.sharedWhiteNoise.duration - dur - 0.06);
      const offset = Math.random() * maxOffset;

      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(safeFreq(freq, 800), startAt);
      filter.Q.value = Math.max(0.2, Math.min(18, finiteOr(q, 1)));

      const gain = this.ctx.createGain();
      const peak = safeExpGain(peakGain, 0.04);
      gain.gain.setValueAtTime(peak, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0008, startAt + dur);

      src.connect(filter);
      filter.connect(gain);

      const slot = this.connectVoiceChain(src, gain, dur, pan, bus, startAt);
      if (!slot) return;
      try {
        src.start(startAt, offset, dur + 0.01);
        src.stop(startAt + dur + 0.015);
      } catch {
        slot.release();
      }
    } catch {
      // Ignore transient noise scheduling errors
    }
  }

  public playFootstep(material: 'gravel' | 'wood' | 'tile' | 'carpet' | 'concrete'): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterGain || this.muted) return;
    if (!this.hasVoiceCapacity()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const jitter = 0.92 + Math.random() * 0.16;

      lp.type = 'lowpass';
      lp.frequency.value = material === 'tile' ? 900 : material === 'carpet' ? 240 : 420;

      if (material === 'wood') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(safeFreq(104 * jitter), now);
        osc.frequency.exponentialRampToValueAtTime(44, now + 0.085);
        gain.gain.setValueAtTime(0.075, now);
        this.playNoiseBurst(0.042, 'bandpass', 640 * jitter, 1.9, 0.022);
      } else if (material === 'tile') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(safeFreq(310 * jitter), now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.05);
        gain.gain.setValueAtTime(0.055, now);
        this.playNoiseBurst(0.026, 'highpass', 2100 * jitter, 1.1, 0.016);
      } else if (material === 'carpet') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(safeFreq(72 * jitter), now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.06);
        gain.gain.setValueAtTime(0.038, now);
        this.playNoiseBurst(0.035, 'lowpass', 320, 0.8, 0.012);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(safeFreq(132 * jitter), now);
        osc.frequency.exponentialRampToValueAtTime(56, now + 0.07);
        gain.gain.setValueAtTime(0.055, now);
        if (material === 'gravel') {
          this.playNoiseBurst(0.068, 'bandpass', 1520 * jitter, 1.4, 0.036);
        } else {
          this.playNoiseBurst(0.035, 'bandpass', 520 * jitter, 1.5, 0.018);
        }
      }

      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);
      osc.connect(lp);
      lp.connect(gain);
      const slot = this.connectVoiceChain(osc, gain, 0.1, 0, 'sfx', now);
      if (!slot) return;
      try {
        osc.start(now);
        osc.stop(now + 0.105);
      } catch {
        slot.release();
      }
    } catch {
      // Ignore step scheduling error
    }
  }

  public playHideSfx(entering: boolean): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterGain || this.muted) return;
    if (!this.hasVoiceCapacity()) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(entering ? 150 : 96, now);
      osc.frequency.exponentialRampToValueAtTime(entering ? 78 : 165, now + 0.16);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
      osc.connect(gain);
      const slot = this.connectVoiceChain(osc, gain, 0.19, 0, 'sfx', now);
      if (!slot) return;
      try {
        osc.start(now);
        osc.stop(now + 0.195);
      } catch {
        slot.release();
      }
      this.playNoiseBurst(0.15, 'bandpass', entering ? 480 : 760, 1.5, 0.042);
    } catch {
      // Ignore hide SFX error
    }
  }

  public playTapePlayback(tapeNumber: number): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterGain || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const n = Math.max(1, finiteOr(tapeNumber, 1));
      this.playNoiseBurst(0.055, 'highpass', 1850, 1.2, 0.045, 0, 0, 'voice');
      this.playNoiseBurst(1.15, 'bandpass', 1050 + n * 100, 1.8, 0.024, 0, 0.05, 'voice');
      const notes = [205 + n * 16, 248 + n * 12, 190 + n * 14];
      notes.forEach((freq, idx) => {
        if (!this.ctx || this.ctx.state !== 'running' || !this.hasVoiceCapacity()) return;
        const t = now + 0.14 + idx * 0.28;
        const o = this.ctx.createOscillator();
        const f = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        o.type = idx === 2 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(safeFreq(freq), t);
        o.frequency.linearRampToValueAtTime(safeFreq(freq * 0.91), t + 0.19);
        f.type = 'bandpass';
        f.frequency.value = 1120;
        f.Q.value = 1.7;
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
        o.connect(f);
        f.connect(g);
        const slot = this.connectVoiceChain(o, g, 0.24, 0, 'voice', t);
        if (slot) {
          try {
            o.start(t);
            o.stop(t + 0.24);
          } catch {
            slot.release();
          }
        }
      });
    } catch {
      // Ignore tape playback error
    }
  }

  public playSfx(
    kind:
      | 'pickup'
      | 'paper'
      | 'door'
      | 'locked'
      | 'secret'
      | 'robot'
      | 'finale'
      | 'ignition'
      | 'flashlight'
      | 'install'
      | 'thunder'
      | 'creak'
      | 'spark'
      | 'heartbeat'
      | 'keypad'
      | 'unlock'
      | 'switch'
      | 'tape'
      | 'battery'
      | 'static'
      | 'steps_above'
      | 'knock'
      | 'whisper'
      | 'pipe_clang'
      | 'breath',
    pan = 0
  ): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterGain || this.muted) return;
    if (!this.hasVoiceCapacity()) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      filter.type = 'lowpass';
      filter.frequency.value = 6000;
      filter.Q.value = 0.7;

      osc.connect(filter);
      filter.connect(gain);

      const estDuration =
        kind === 'thunder' ? 1.4 : kind === 'finale' ? 1.2 : kind === 'breath' ? 0.76 : kind === 'whisper' ? 0.62 : 0.45;
      const slot = this.connectVoiceChain(osc, gain, estDuration, pan, 'sfx', now);
      if (!slot) return;

      const startOsc = (stopAt: number) => {
        try {
          osc.start(now);
          osc.stop(stopAt);
        } catch {
          slot.release();
        }
      };

      switch (kind) {
        case 'pickup':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(480, now);
          osc.frequency.exponentialRampToValueAtTime(720, now + 0.11);
          gain.gain.setValueAtTime(0.095, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
          startOsc(now + 0.19);
          this.playNoiseBurst(0.03, 'highpass', 2400, 1.2, 0.02, pan);
          break;
        case 'install':
          osc.type = 'triangle';
          filter.frequency.value = 950;
          osc.frequency.setValueAtTime(145, now);
          osc.frequency.exponentialRampToValueAtTime(280, now + 0.11);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);
          startOsc(now + 0.25);
          this.playNoiseBurst(0.055, 'bandpass', 1800, 2.4, 0.048, pan);
          break;
        case 'paper':
          osc.type = 'triangle';
          filter.frequency.value = 650;
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(140, now + 0.12);
          gain.gain.setValueAtTime(0.055, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
          startOsc(now + 0.15);
          this.playNoiseBurst(0.11, 'bandpass', 2200, 1.3, 0.042, pan);
          break;
        case 'door':
          osc.type = 'triangle';
          filter.frequency.value = 340;
          osc.frequency.setValueAtTime(112, now);
          osc.frequency.exponentialRampToValueAtTime(58, now + 0.19);
          gain.gain.setValueAtTime(0.095, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.21);
          startOsc(now + 0.22);
          this.playNoiseBurst(0.14, 'bandpass', 560, 1.8, 0.034, pan);
          break;
        case 'locked':
          // Heavy brass/iron latch rattle instead of raw beep
          osc.type = 'triangle';
          filter.frequency.value = 540;
          osc.frequency.setValueAtTime(142, now);
          osc.frequency.exponentialRampToValueAtTime(76, now + 0.06);
          osc.frequency.setValueAtTime(128, now + 0.08);
          osc.frequency.exponentialRampToValueAtTime(64, now + 0.15);
          gain.gain.setValueAtTime(0.095, now);
          gain.gain.setValueAtTime(0.085, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.17);
          startOsc(now + 0.18);
          this.playNoiseBurst(0.035, 'bandpass', 1750, 2.8, 0.045, pan, 0);
          this.playNoiseBurst(0.04, 'bandpass', 1520, 2.6, 0.04, pan, 0.075);
          break;
        case 'secret':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.36);
          gain.gain.setValueAtTime(0.095, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
          startOsc(now + 0.46);
          break;
        case 'flashlight':
          // Crisp mechanical switch click + housing thump
          osc.type = 'triangle';
          filter.frequency.value = 820;
          osc.frequency.setValueAtTime(290, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.028);
          gain.gain.setValueAtTime(0.065, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.035);
          startOsc(now + 0.04);
          this.playNoiseBurst(0.022, 'highpass', 2600, 1.4, 0.045, pan);
          break;
        case 'keypad':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(590 + Math.random() * 110, now);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.05);
          startOsc(now + 0.055);
          this.playNoiseBurst(0.018, 'highpass', 2200, 1.5, 0.02, pan);
          break;
        case 'unlock':
          osc.type = 'triangle';
          filter.frequency.value = 1800;
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.setValueAtTime(480, now + 0.08);
          osc.frequency.setValueAtTime(640, now + 0.16);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);
          startOsc(now + 0.3);
          this.playNoiseBurst(0.045, 'bandpass', 1400, 2.2, 0.035, pan, 0.06);
          break;
        case 'switch':
          osc.type = 'triangle';
          filter.frequency.value = 680;
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(98, now + 0.06);
          gain.gain.setValueAtTime(0.085, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
          startOsc(now + 0.08);
          this.playNoiseBurst(0.032, 'highpass', 1650, 1.2, 0.032, pan);
          break;
        case 'tape':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(840, now);
          osc.frequency.setValueAtTime(390, now + 0.09);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
          startOsc(now + 0.2);
          this.playNoiseBurst(0.14, 'bandpass', 1100, 1.3, 0.032, pan);
          break;
        case 'battery':
          osc.type = 'triangle';
          filter.frequency.value = 1600;
          osc.frequency.setValueAtTime(380, now);
          osc.frequency.exponentialRampToValueAtTime(690, now + 0.14);
          gain.gain.setValueAtTime(0.085, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
          startOsc(now + 0.19);
          break;
        case 'static':
          osc.type = 'triangle';
          filter.frequency.value = 920;
          osc.frequency.setValueAtTime(110, now);
          gain.gain.setValueAtTime(0.02, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);
          startOsc(now + 0.13);
          this.playNoiseBurst(0.12, 'bandpass', 1750, 1.8, 0.052, pan);
          break;
        case 'ignition':
          osc.type = 'sawtooth';
          filter.frequency.value = 420;
          osc.frequency.setValueAtTime(88, now);
          osc.frequency.setValueAtTime(68, now + 0.07);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.19);
          startOsc(now + 0.2);
          this.playNoiseBurst(0.14, 'bandpass', 650, 1.4, 0.045, pan);
          break;
        case 'robot':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(325, now);
          osc.frequency.linearRampToValueAtTime(280, now + 0.24);
          gain.gain.setValueAtTime(0.075, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);
          startOsc(now + 0.3);
          this.playNoiseBurst(0.09, 'bandpass', 1200, 3.0, 0.018, pan, 0, 'voice');
          break;
        case 'finale':
          // Deep ominous sub-swell + metallic servo lock instead of harsh saw buzz
          osc.type = 'sawtooth';
          filter.frequency.setValueAtTime(480, now);
          filter.frequency.exponentialRampToValueAtTime(140, now + 1.0);
          osc.frequency.setValueAtTime(98, now);
          osc.frequency.linearRampToValueAtTime(49, now + 0.95);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.12);
          startOsc(now + 1.15);
          this.playNoiseBurst(0.24, 'bandpass', 1450, 2.5, 0.06, pan);
          break;
        case 'thunder':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(68, now);
          osc.frequency.exponentialRampToValueAtTime(26, now + 1.3);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.35);
          startOsc(now + 1.4);
          this.playNoiseBurst(1.1, 'lowpass', 220, 0.7, 0.14, pan);
          break;
        case 'creak':
          // Filtered woody floorboard groan
          osc.type = 'sawtooth';
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(520, now);
          filter.Q.value = 3.2;
          osc.frequency.setValueAtTime(175, now);
          osc.frequency.linearRampToValueAtTime(118, now + 0.25);
          osc.frequency.linearRampToValueAtTime(142, now + 0.42);
          gain.gain.setValueAtTime(0.048, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
          startOsc(now + 0.46);
          break;
        case 'spark':
          // Brief electrical arc snap
          osc.type = 'triangle';
          filter.type = 'bandpass';
          filter.frequency.value = 2100;
          filter.Q.value = 2.0;
          osc.frequency.setValueAtTime(1180, now);
          osc.frequency.exponentialRampToValueAtTime(280, now + 0.075);
          gain.gain.setValueAtTime(0.045, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.085);
          startOsc(now + 0.095);
          this.playNoiseBurst(0.07, 'highpass', 2400, 1.3, 0.045, pan);
          break;
        case 'heartbeat': {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(56, now);
          osc.frequency.exponentialRampToValueAtTime(34, now + 0.14);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
          startOsc(now + 0.18);
          if (this.hasVoiceCapacity()) {
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(48, now + 0.2);
            osc2.frequency.exponentialRampToValueAtTime(31, now + 0.34);
            gain2.gain.setValueAtTime(0.15, now + 0.2);
            gain2.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);
            osc2.connect(gain2);
            const s2 = this.connectVoiceChain(osc2, gain2, 0.18, pan, 'sfx', now + 0.2);
            if (s2) {
              try {
                osc2.start(now + 0.2);
                osc2.stop(now + 0.38);
              } catch {
                s2.release();
              }
            }
          }
          break;
        }
        case 'steps_above': {
          osc.type = 'triangle';
          filter.frequency.value = 220;
          osc.frequency.setValueAtTime(80, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
          gain.gain.setValueAtTime(0.095, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
          startOsc(now + 0.15);
          for (let s = 1; s <= 2; s++) {
            if (!this.hasVoiceCapacity()) break;
            const t = now + s * 0.42;
            const o = this.ctx.createOscillator();
            const lp2 = this.ctx.createBiquadFilter();
            const g = this.ctx.createGain();
            lp2.type = 'lowpass';
            lp2.frequency.value = 220;
            o.type = 'triangle';
            o.frequency.setValueAtTime(76 - s * 4, t);
            o.frequency.exponentialRampToValueAtTime(37, t + 0.13);
            g.gain.setValueAtTime(0.08, t);
            g.gain.exponentialRampToValueAtTime(0.0008, t + 0.15);
            o.connect(lp2);
            lp2.connect(g);
            const s2 = this.connectVoiceChain(o, g, 0.16, pan, 'sfx', t);
            if (s2) {
              try {
                o.start(t);
                o.stop(t + 0.16);
              } catch {
                s2.release();
              }
            }
          }
          break;
        }
        case 'knock': {
          osc.type = 'triangle';
          filter.frequency.value = 420;
          osc.frequency.setValueAtTime(155, now);
          osc.frequency.exponentialRampToValueAtTime(66, now + 0.07);
          gain.gain.setValueAtTime(0.135, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.08);
          startOsc(now + 0.09);
          this.playNoiseBurst(0.048, 'bandpass', 520, 2.2, 0.055, pan, 0);
          for (let k = 1; k <= 2; k++) {
            if (!this.hasVoiceCapacity()) break;
            const t = now + k * 0.24;
            const o = this.ctx.createOscillator();
            const lp2 = this.ctx.createBiquadFilter();
            const g = this.ctx.createGain();
            lp2.type = 'lowpass';
            lp2.frequency.value = 420;
            o.type = 'triangle';
            o.frequency.setValueAtTime(148 + k * 6, t);
            o.frequency.exponentialRampToValueAtTime(64, t + 0.07);
            g.gain.setValueAtTime(0.115, t);
            g.gain.exponentialRampToValueAtTime(0.0008, t + 0.08);
            o.connect(lp2);
            lp2.connect(g);
            const s2 = this.connectVoiceChain(o, g, 0.09, pan, 'sfx', t);
            if (s2) {
              try {
                o.start(t);
                o.stop(t + 0.09);
              } catch {
                s2.release();
              }
            }
            this.playNoiseBurst(0.048, 'bandpass', 500, 2.2, 0.048, pan, k * 0.24);
          }
          break;
        }
        case 'whisper':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(225, now);
          osc.frequency.linearRampToValueAtTime(180, now + 0.55);
          gain.gain.setValueAtTime(0.028, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.6);
          startOsc(now + 0.62);
          this.playNoiseBurst(0.55, 'bandpass', 1380, 4.0, 0.052, pan, 0, 'voice');
          break;
        case 'pipe_clang':
          osc.type = 'triangle';
          filter.frequency.value = 1400;
          osc.frequency.setValueAtTime(415, now);
          osc.frequency.exponentialRampToValueAtTime(280, now + 0.5);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.55);
          startOsc(now + 0.56);
          this.playNoiseBurst(0.075, 'highpass', 1550, 1.5, 0.048, pan, 0);
          break;
        case 'breath':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(128, now);
          osc.frequency.linearRampToValueAtTime(92, now + 0.72);
          gain.gain.setValueAtTime(0.022, now);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.75);
          startOsc(now + 0.76);
          this.playNoiseBurst(0.68, 'bandpass', 740, 2.6, 0.056, pan, 0.04, 'voice');
          break;
      }
    } catch {
      // Never allow SFX scheduling failures to propagate
    }
  }

  public playVoiceBlip(
    speaker: 'robot' | 'thought' | 'radio' | 'tape',
    isRedMode: boolean,
    installedParts = 0
  ): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterGain || this.muted || speaker === 'thought') {
      return;
    }
    if (!this.hasVoiceCapacity()) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const formant1 = this.ctx.createBiquadFilter();
      const formant2 = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      formant1.type = 'bandpass';
      formant1.Q.value = 2.6;
      formant2.type = 'lowpass';
      formant2.frequency.value = 2350;

      if (speaker === 'radio' || speaker === 'tape') {
        osc.type = 'triangle';
        formant1.frequency.value = speaker === 'tape' ? 1080 : 1320;
        const base = safeFreq(170 + Math.random() * 145);
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.linearRampToValueAtTime(safeFreq(base * 0.94), now + 0.046);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.05);
        if (Math.random() < 0.35) {
          this.playNoiseBurst(0.032, 'bandpass', 1850, 2.4, 0.016, 0, 0, 'voice');
        }
      } else if (isRedMode) {
        // Colder, unsettling resonant harmonic shift in red mode
        osc.type = 'sawtooth';
        formant1.frequency.value = 860;
        formant2.frequency.value = 1750;
        const base = safeFreq(275 + Math.random() * 26);
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.linearRampToValueAtTime(safeFreq(base * 0.95), now + 0.068);
        gain.gain.setValueAtTime(0.068, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.072);
      } else if (installedParts >= 5) {
        osc.type = 'triangle';
        formant1.frequency.value = 1320;
        const base = safeFreq(244 + Math.random() * 38);
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.linearRampToValueAtTime(safeFreq(base * 0.9), now + 0.06);
        gain.gain.setValueAtTime(0.058, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.066);
      } else if (installedParts >= 3) {
        osc.type = 'triangle';
        formant1.frequency.value = 1420;
        const base = safeFreq(252 + Math.random() * 44);
        osc.frequency.setValueAtTime(base, now);
        gain.gain.setValueAtTime(0.052, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.058);
      } else {
        // Fragile, breathy damaged speaker early on
        osc.type = 'triangle';
        formant1.frequency.value = 1040;
        const base = safeFreq(205 + Math.random() * 64);
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.linearRampToValueAtTime(safeFreq(base * 0.88), now + 0.052);
        gain.gain.setValueAtTime(0.048, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.056);
        if (Math.random() < 0.22) {
          this.playNoiseBurst(0.036, 'bandpass', 1450, 3.0, 0.012, 0, 0, 'voice');
        }
      }

      osc.connect(formant1);
      formant1.connect(formant2);
      formant2.connect(gain);
      const slot = this.connectVoiceChain(osc, gain, 0.08, 0, 'voice', now);
      if (!slot) return;
      try {
        osc.start(now);
        osc.stop(now + 0.08);
      } catch {
        slot.release();
      }
    } catch {
      // Ignore voice blip error
    }
  }

  public playRadioProximityBlip(strength: number): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterGain || this.muted) return;
    if (!this.hasVoiceCapacity()) return;
    try {
      const clamped = Math.max(0.1, Math.min(1, finiteOr(strength, 0.25)));
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const baseFreq = safeFreq(620 + clamped * 440);
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(safeFreq(baseFreq * 1.09), now + 0.06);
      gain.gain.setValueAtTime(safeExpGain(0.014 + clamped * 0.022), now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
      osc.connect(gain);
      const slot = this.connectVoiceChain(osc, gain, 0.085, 0, 'sfx', now);
      if (!slot) return;
      try {
        osc.start(now);
        osc.stop(now + 0.082);
      } catch {
        slot.release();
      }
      this.playNoiseBurst(0.06, 'bandpass', 1900 + clamped * 900, 3.2, 0.014 + clamped * 0.018);
    } catch {
      // Ignore proximity blip error
    }
  }
}

export const soundEngine = new HorrorAudioEngine();
