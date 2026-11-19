export type DiagnosticSeverity = 'warn' | 'error' | 'fatal';

export interface DiagnosticEntry {
  id: string;
  source: string;
  message: string;
  severity: DiagnosticSeverity;
  firstTimestamp: number;
  lastTimestamp: number;
  repeatCount: number;
}

export interface DiagnosticsSnapshot {
  totalErrors: number;
  slowFrameCount: number;
  maxFrameMs: number;
  lastFrameMs: number;
  lastSimMs: number;
  lastRenderMs: number;
  avgSimMs: number;
  avgRenderMs: number;
  fps: number;
  minFps: number;
  low1PercentFps: number;
  eventsTraceCount: number;
  entries: DiagnosticEntry[];
}

const MAX_ENTRIES = 40;
const SLOW_FRAME_THRESHOLD_MS = 50;
const FPS_WINDOW_SIZE = 120;

export class GameDiagnostics {
  private entries = new Map<string, DiagnosticEntry>();
  private totalErrors = 0;
  private slowFrameCount = 0;
  private maxFrameMs = 0;
  private lastFrameMs = 0;
  private lastSimMs = 0;
  private lastRenderMs = 0;
  private simSamples: number[] = [];
  private renderSamples: number[] = [];
  private frameIntervalSamplesMs: number[] = [];
  private eventsTraceCount = 0;

  public recordError(
    source: string,
    error: unknown,
    severity: DiagnosticSeverity = 'error'
  ): DiagnosticEntry {
    const message =
      error instanceof Error
        ? error.message || error.name
        : typeof error === 'string'
        ? error
        : 'Неизвестная ошибка';
    const key = `${severity}:${source}:${message}`;
    const now = Date.now();
    this.totalErrors += 1;

    const existing = this.entries.get(key);
    if (existing) {
      existing.repeatCount += 1;
      existing.lastTimestamp = now;
      if (existing.repeatCount === 10 || existing.repeatCount % 100 === 0) {
        console.warn(`[QuietVoice:${source}] Повтор ошибки x${existing.repeatCount}: ${message}`);
      }
      return existing;
    }

    if (this.entries.size >= MAX_ENTRIES) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    const entry: DiagnosticEntry = {
      id: key,
      source,
      message,
      severity,
      firstTimestamp: now,
      lastTimestamp: now,
      repeatCount: 1,
    };
    this.entries.set(key, entry);

    if (severity === 'warn') {
      console.warn(`[QuietVoice:${source}] ${message}`);
    } else {
      console.error(`[QuietVoice:${source}] ${message}`, error);
    }

    return entry;
  }

  public recordFrameDuration(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.lastFrameMs = durationMs;
    if (durationMs > this.maxFrameMs) {
      this.maxFrameMs = durationMs;
    }
    if (durationMs > SLOW_FRAME_THRESHOLD_MS) {
      this.slowFrameCount += 1;
    }
  }

  public recordFrameInterval(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > 2000) return;
    this.frameIntervalSamplesMs.push(deltaMs);
    if (this.frameIntervalSamplesMs.length > FPS_WINDOW_SIZE) {
      this.frameIntervalSamplesMs.shift();
    }
  }

  public recordPhaseTimings(simMs: number, renderMs: number): void {
    if (Number.isFinite(simMs) && simMs >= 0) {
      this.lastSimMs = simMs;
      this.simSamples.push(simMs);
      if (this.simSamples.length > FPS_WINDOW_SIZE) {
        this.simSamples.shift();
      }
    }
    if (Number.isFinite(renderMs) && renderMs >= 0) {
      this.lastRenderMs = renderMs;
      this.renderSamples.push(renderMs);
      if (this.renderSamples.length > FPS_WINDOW_SIZE) {
        this.renderSamples.shift();
      }
    }
  }

  public recordEventTrace(): void {
    this.eventsTraceCount += 1;
  }

  public getSnapshot(): DiagnosticsSnapshot {
    const avg = (arr: number[]): number =>
      arr.length === 0 ? 0 : arr.reduce((sum, v) => sum + v, 0) / arr.length;

    let fps = 0;
    let minFps = 0;
    let low1PercentFps = 0;
    if (this.frameIntervalSamplesMs.length > 0) {
      const avgDelta = avg(this.frameIntervalSamplesMs);
      fps = avgDelta > 0 ? Math.round((1000 / avgDelta) * 10) / 10 : 0;
      const sorted = [...this.frameIntervalSamplesMs].sort((a, b) => b - a);
      const worstDelta = sorted[0] ?? avgDelta;
      minFps = worstDelta > 0 ? Math.round((1000 / worstDelta) * 10) / 10 : 0;
      const top1Count = Math.max(1, Math.ceil(sorted.length * 0.01));
      const low1AvgDelta = avg(sorted.slice(0, top1Count));
      low1PercentFps = low1AvgDelta > 0 ? Math.round((1000 / low1AvgDelta) * 10) / 10 : 0;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      totalErrors: this.totalErrors,
      slowFrameCount: this.slowFrameCount,
      maxFrameMs: round2(this.maxFrameMs),
      lastFrameMs: round2(this.lastFrameMs),
      lastSimMs: round2(this.lastSimMs),
      lastRenderMs: round2(this.lastRenderMs),
      avgSimMs: round2(avg(this.simSamples)),
      avgRenderMs: round2(avg(this.renderSamples)),
      fps,
      minFps,
      low1PercentFps,
      eventsTraceCount: this.eventsTraceCount,
      entries: Array.from(this.entries.values()),
    };
  }

  public reset(): void {
    this.entries.clear();
    this.totalErrors = 0;
    this.slowFrameCount = 0;
    this.maxFrameMs = 0;
    this.lastFrameMs = 0;
    this.lastSimMs = 0;
    this.lastRenderMs = 0;
    this.simSamples = [];
    this.renderSamples = [];
    this.frameIntervalSamplesMs = [];
    this.eventsTraceCount = 0;
  }
}

export const gameDiagnostics = new GameDiagnostics();

export function installGlobalDiagnosticsHandle(): void {
  try {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__quietVoiceDiagnostics = gameDiagnostics;
    }
  } catch {
    // Ignore non-writable window environments
  }
}
