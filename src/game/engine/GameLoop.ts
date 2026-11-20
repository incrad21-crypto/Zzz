import { gameDiagnostics } from '../diagnostics';

export type RenderFpsCap = 0 | 30 | 60 | 120;

export interface GameLoopCallbacks {
  onSimulationStep: (fixedDt: number, timeSec: number) => void;
  onFrameSync: (dt: number, timeSec: number) => void;
  onRender: (dt: number, timeSec: number) => void;
  onAfterFrame?: () => void;
  isHidden?: () => boolean;
}

export const FIXED_SIM_STEP = 1 / 60;
const MAX_SUBSTEPS = 6;

export class GameLoop {
  private rafId = 0;
  private running = false;
  private lastTimeMs = 0;
  private elapsedSec = 0;
  private simAccumulator = 0;
  private renderAccumulator = 0;
  private renderFpsCap: RenderFpsCap = 0;
  private callbacks: GameLoopCallbacks;

  constructor(callbacks: GameLoopCallbacks, renderFpsCap: RenderFpsCap = 0) {
    this.callbacks = callbacks;
    this.renderFpsCap = renderFpsCap;
  }

  public setRenderFpsCap(cap: RenderFpsCap): void {
    this.renderFpsCap = cap;
    this.renderAccumulator = 0;
  }

  public getRenderFpsCap(): RenderFpsCap {
    return this.renderFpsCap;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = performance.now();
    this.simAccumulator = 0;
    this.renderAccumulator = 0;

    const tick = (nowMs: number) => {
      if (!this.running) return;
      this.stepFrame(nowMs);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public stepFrame(nowMs: number): void {
    const frameStart = performance.now();
    let simDurationMs = 0;
    let renderDurationMs = 0;

    try {
      const rawDeltaMs = nowMs - this.lastTimeMs;
      this.lastTimeMs = nowMs;

      if (this.callbacks.isHidden?.()) {
        return;
      }

      if (rawDeltaMs > 0 && rawDeltaMs <= 500) {
        gameDiagnostics.recordFrameInterval(rawDeltaMs);
      }

      const rawDt = rawDeltaMs / 1000;
      const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0.001), 0.1) : 0.016;
      this.elapsedSec += dt;
      const timeSec = this.elapsedSec;

      const simStart = performance.now();
      this.simAccumulator = Math.min(this.simAccumulator + dt, FIXED_SIM_STEP * MAX_SUBSTEPS);
      let substeps = 0;
      while (this.simAccumulator >= FIXED_SIM_STEP && substeps < MAX_SUBSTEPS) {
        this.callbacks.onSimulationStep(FIXED_SIM_STEP, timeSec);
        this.simAccumulator -= FIXED_SIM_STEP;
        substeps += 1;
      }
      this.callbacks.onFrameSync(dt, timeSec);
      simDurationMs = performance.now() - simStart;

      let shouldRender = true;
      if (this.renderFpsCap > 0) {
        const minRenderInterval = 1 / this.renderFpsCap;
        this.renderAccumulator += dt;
        if (this.renderAccumulator < minRenderInterval) {
          shouldRender = false;
        } else {
          this.renderAccumulator = this.renderAccumulator % minRenderInterval;
        }
      }

      if (shouldRender) {
        const renderStart = performance.now();
        this.callbacks.onRender(dt, timeSec);
        renderDurationMs = performance.now() - renderStart;
      }
    } catch (err) {
      gameDiagnostics.recordError('frame_loop', err);
    } finally {
      gameDiagnostics.recordPhaseTimings(simDurationMs, renderDurationMs);
      gameDiagnostics.recordFrameDuration(performance.now() - frameStart);
      this.callbacks.onAfterFrame?.();
    }
  }
}
